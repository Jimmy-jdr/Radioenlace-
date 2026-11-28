// Pruebas de las versiones 1.4 y 1.5 (sin red): node pruebas/prueba-ejercicios.mjs
//  · generador de ejercicios aleatorios: reproducible, datos distintos por alumno,
//    soluciones === las que muestra la app por su camino de cálculo (app.js);
//  · tolerancias: se aceptan c = 3·10⁸ m/s, 32,44 dB, R = 6370 km y redondeos;
//  · altura mínima de las antenas (60 % de r1);
//  · ejercicios con el mapa de cobertura: elección y corrección de puntos;
//  · enlaces comprimidos (?z=) y de ejercicio (?g=).
import * as R from '../js/radio.js';
import { obtenerPerfil, puntosPerfil } from '../js/terreno.js';
import { obtenerModelo } from '../js/modelos.js';
import * as E from '../js/ejercicios.js';
import * as C from '../js/cobertura.js';
import { codificarDatos, decodificarDatos } from '../js/enlace.js';
import { aCSV } from '../js/informe.js';
import { perdidasLinea, coaxial, rectangular } from '../js/lineas.js';
import { alturasMinimasP530, criterioDespejeP530 } from '../js/p530.js';
import { calcularDisponibilidad, datosClima, puntoMedio, normalizarDisponibilidad } from '../js/disponibilidad.js';
import { calcularCapacidad, normalizarCapacidad } from '../js/capacidad.js';
import { coeficientesLluvia } from '../js/p838.js';

let fallos = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${n}${extra ? ` (${extra})` : ''}`); };

// ---------- 1. Reproducible y distinto por alumno ----------
{
  const cfg = { c: 'K7M2QX', n: 3, s: 1 };
  const r1 = E.generarDatos(cfg, '12'), r2 = E.generarDatos(cfg, ' nº 12 ');
  ok('Mismo código y alumno → mismos datos («12» = « nº 12 »)', JSON.stringify(r1.datos) === JSON.stringify(r2.datos));
  // Instantánea: si cambia, los enlaces ya repartidos darían otros datos
  ok('Instantánea del generador (K7M2QX, nivel 3, alumno 12)', JSON.stringify(r1.datos) ===
    '{"f":{"v":7,"u":"GHz"},"p":{"v":0.25,"u":"W"},"d":22.2,"a":{"h":25,"g":36,"l":2},"b":{"h":20,"g":32,"l":1.5},"sens":-56,"k":"4/3","obst":{"d":16,"z":10}}');
  ok('Instantánea del generador (K7M2QX, nivel 4, alumna «Ana»)', JSON.stringify(E.generarDatos({ ...cfg, n: 4 }, 'Ana').datos) ===
    '{"f":{"v":2.4,"u":"GHz"},"p":{"v":0.25,"u":"W"},"d":11.5,"a":{"h":10,"g":23.5,"l":3},"b":{"h":60,"g":22,"l":1.5},"sens":-72,"k":"4/3","obst":{"d":2.5,"z":14}}');
  const vistos = new Set();
  for (let i = 1; i <= 40; i++) vistos.add(JSON.stringify(E.generarDatos(cfg, String(i)).datos));
  ok('40 alumnos → 40 enunciados distintos', vistos.size === 40, `${vistos.size}`);
  ok('Otro código → otros datos', JSON.stringify(E.generarDatos({ ...cfg, c: 'K7M2QY' }, '12').datos) !== JSON.stringify(r1.datos));
  ok('Identificadores normalizados', E.normalizarId('Nº 07') === '7' && E.normalizarId('José Pérez') === 'JOSEPEREZ' && E.normalizarId('n7') === '7' && E.normalizarId('Nuria') === 'NURIA');
  const p = E.configAParam({ c: 'K7M2QX', n: 4, s: 0 });
  ok('Configuración en el enlace (?g=) ida y vuelta', JSON.stringify(E.paramAConfig(p)) === '{"v":1,"c":"K7M2QX","n":4,"s":0}', p);
  ok('Configuración no válida → null', E.paramAConfig('xxx') === null && E.paramAConfig(E.configAParam({ c: 'abc', n: 1, s: 1 })) === null);
  ok('Códigos nuevos válidos (sin I, O, 0 ni 1)', Array.from({ length: 200 }, () => E.nuevoCodigo()).every(E.codigoValido));
  ok('Lista del solucionario: 1…N o líneas sin repetir', E.listaIds('', 25).length === 25 && E.listaIds('Ana\nLuis\n ana \n\n7').join('|') === 'Ana|Luis|7');
}

// ---------- 2. Soluciones === camino de cálculo de app.js ----------
async function comoLaApp(datos) {
  const est = E.datosAEstado(datos);
  const a = est.a, b = est.b;
  const p = await obtenerPerfil(a, b, { modo: est.terreno, obstaculo: est.obstaculo });
  const fMHz = R.aMHz(est.f.v, est.f.u), ptxDbm = R.potenciaDbm(est.p.v, est.p.u), k = R.leerK(est.k);
  const dKm = R.distanciaKm(a, b);
  const modelo = obtenerModelo(est.modelo);
  const res = modelo.calcular({ dKm, fMHz, perfil: p.puntos, hA: a.h, hB: b.h });
  const pres = R.presupuesto({ ptxDbm, gtx: a.g, grx: b.g, ltx: a.l, lrx: b.l, perdidaTrayecto: res.perdida, sensibilidad: est.sens });
  const an = R.analizarPerfil({ perfil: p.puntos, hA: a.h, hB: b.h, fMHz, k });
  const dif = R.difraccionObstaculoPrincipal(an, fMHz);
  const alt = R.alturasMinimas(an);
  const po = an.puntos.find((q) => p.puntos[q.i].origen === 'obstaculo');
  return { perdida: res.perdida, prx: pres.prx, margen: pres.margen, r1Medio: an.r1Medio, r1Obs: po?.r1, flechaObs: po?.flecha,
    hObs: po ? -po.despeje : undefined, nu: dif?.nu, J: dif?.J, margenDif: pres.margen - (dif?.J ?? 0), hBmin: alt.b.h, peor: an.peor === po };
}
{
  let iguales = 0, casos = 0, peorObs = 0, conObst = 0;
  const estados = { despejado: 0, fresnel: 0, obstruido: 0 };
  for (const n of [1, 2, 3, 4]) {
    for (let i = 1; i <= 100; i++) {
      const { datos, sol } = E.generarDatos({ c: 'PRUEBA'.replace('U', 'V'), n, s: 1 }, String(i));
      const app = await comoLaApp(datos);
      casos++;
      if (E.preguntasDe(n).every((q) => app[q.clave] === sol[q.clave])) iguales++;
      if (datos.obst) { conObst++; if (app.peor) peorObs++; estados[sol.estado]++; }
    }
  }
  ok('Soluciones del generador === resultados por el camino de app.js (400 alumnos, niveles 1–4)', iguales === casos, `${iguales}/${casos}`);
  ok('El obstáculo es siempre el punto más comprometido', peorObs === conObst, `${peorObs}/${conObst}`);
  ok('Obstáculos despejados, que invaden el 60 % y que cortan la visión', estados.despejado > 30 && estados.fresnel > 30 && estados.obstruido > 30, JSON.stringify(estados));
}

// ---------- 3. Tolerancias: respuestas «de alumno» con otras constantes ----------
{
  let aceptadas = 0, n = 0;
  const r2 = (x) => Math.round(x * 100) / 100;
  for (const nivel of [1, 2, 3, 4]) {
    for (let i = 1; i <= 60; i++) {
      const { datos, sol } = E.generarDatos({ c: 'TQLRZ8', n: nivel, s: 1 }, String(i));
      // Como en clase: c = 3·10⁸, R = 6370 km, 32,44 dB y resultados intermedios con 2 decimales
      const lam = r2(3e8 / (datos.f.v * 1e9) * 1e4) / 1e4;           // λ con 4 decimales (m)
      const ptx = r2(datos.p.u === 'W' ? 10 * Math.log10(datos.p.v * 1000) : datos.p.v);
      const L = r2(32.44 + 20 * Math.log10(datos.d) + 20 * Math.log10(datos.f.v * 1000));
      const prx = r2(ptx - datos.a.l + datos.a.g - L + datos.b.g - datos.b.l);
      const resp = { perdida: L, prx, margen: r2(prx - datos.sens) };
      const k = R.leerK(datos.k), D = datos.d * 1000;
      resp.r1Medio = r2(Math.sqrt(lam * D / 4));
      if (datos.obst) {
        const d1 = datos.obst.d * 1000, d2 = D - d1;
        resp.r1Obs = r2(Math.sqrt(lam * d1 * d2 / D));
        resp.flechaObs = r2(d1 * d2 / (2 * k * 6370e3));
        const los = r2(datos.a.h + (datos.b.h - datos.a.h) * d1 / D);
        resp.hObs = r2(datos.obst.z + resp.flechaObs - los);
        resp.nu = Math.round(resp.hObs * Math.sqrt(2 * D / (lam * d1 * d2)) * 1000) / 1000;
        resp.J = resp.nu > -0.78 ? r2(6.9 + 20 * Math.log10(Math.sqrt((resp.nu - 0.1) ** 2 + 1) + resp.nu - 0.1)) : 0;
        resp.margenDif = r2(resp.margen - resp.J);
        const t = d1 / D;
        resp.hBmin = r2((datos.obst.z + resp.flechaObs + 0.6 * resp.r1Obs - datos.a.h * (1 - t)) / t);
      }
      const c = E.corregir(resp, sol, nivel);
      n++;
      if (c.every((x) => x.ok)) aceptadas++;
      else if (n - aceptadas <= 3) console.log('      no aceptada:', c.filter((x) => !x.ok).map((x) => `${x.clave} ${x.valor} vs ${x.sol.toFixed(4)} ±${x.tol.toFixed(3)}`).join('; '));
    }
  }
  ok('Respuestas con c = 3·10⁸, R = 6370 km, 32,44 dB y redondeos: todas aceptadas', aceptadas === n, `${aceptadas}/${n}`);
  const { sol } = E.generarDatos({ c: 'TQLRZ8', n: 4, s: 1 }, '3');
  const mitad = Object.fromEntries(E.preguntasDe(4).map((q) => [q.clave, String(sol[q.clave] + 0.9 * E.tolerancia(q, sol[q.clave])).replace('.', ',')]));
  const fuera = Object.fromEntries(E.preguntasDe(4).map((q) => [q.clave, sol[q.clave] - 1.1 * E.tolerancia(q, sol[q.clave])]));
  ok('Dentro de la tolerancia (con coma decimal) → correcto', E.corregir(mitad, sol, 4).every((x) => x.ok));
  ok('Fuera de la tolerancia → incorrecto', E.corregir(fuera, sol, 4).every((x) => !x.ok));
  ok('Casillas vacías → sin contestar', E.corregir({}, sol, 4).every((x) => x.vacia && !x.ok));
  ok('Tolerancias: 0,2 dB; r1 y flecha 1 % (mín. 0,05 m); ν 0,02; J 0,3 dB',
    E.tolerancia(E.PREGUNTAS[0], 130) === 0.2 && E.tolerancia(E.PREGUNTAS[3], 20) === 0.2 && E.tolerancia(E.PREGUNTAS[5], 1) === 0.05 && E.PREGUNTAS[7].abs === 0.02 && E.PREGUNTAS[8].abs === 0.3);
  const csv = aCSV(E.filasSolucionario({ c: 'TQLRZ8', n: 4, s: 1 }, ['1', '2', 'Ana']));
  const lineas = csv.trim().split('\r\n');
  ok('Solucionario CSV: cabecera + 3 alumnos, «;» y coma decimal', lineas.length === 4 && lineas[0].includes('Altura mínima de la antena B') && /;\d+,\d+;/.test(lineas[1]));
  ok('Enunciado con los datos y la fórmula de la P.526 en el nivel 3', /UIT-R P\.526/.test(E.enunciado(E.generarDatos({ c: 'TQLRZ8', n: 3, s: 1 }, '1').datos, 3)));
}

// ---------- 4. Altura mínima de las antenas ----------
{
  const a = { lat: 40.1, lon: -4.5 }, b = R.destino(a, 37, 18.3);
  // Relieve sintético: plano con dos obstáculos (el segundo es el que limita a B)
  const base = puntosPerfil(a, b, 'plano').puntos.map((p) => ({ ...p, z: 100 + 60 * Math.exp(-(((p.d - 5000) / 400) ** 2)) + 75 * Math.exp(-(((p.d - 14000) / 300) ** 2)) }));
  const an = R.analizarPerfil({ perfil: base, hA: 20, hB: 15, fMHz: 5800, k: 4 / 3 });
  const m = R.alturasMinimas(an);
  const conA = R.analizarPerfil({ perfil: base, hA: m.a.h, hB: 15, fMHz: 5800, k: 4 / 3 });
  const conB = R.analizarPerfil({ perfil: base, hA: 20, hB: m.b.h, fMHz: 5800, k: 4 / 3 });
  const conI = R.analizarPerfil({ perfil: base, hA: m.igual.h, hB: m.igual.h, fMHz: 5800, k: 4 / 3 });
  ok('Con la altura mínima de A el despeje mínimo es 60 %', Math.abs(conA.peor.relacion - 0.6) < 1e-9, conA.peor.relacion.toFixed(12));
  ok('Con la altura mínima de B el despeje mínimo es 60 %', Math.abs(conB.peor.relacion - 0.6) < 1e-9);
  ok('Con la misma altura mínima en A y B el despeje mínimo es 60 %', Math.abs(conI.peor.relacion - 0.6) < 1e-9);
  const menos = R.analizarPerfil({ perfil: base, hA: 20, hB: m.b.h - 0.01, fMHz: 5800, k: 4 / 3 });
  ok('1 cm menos ya no despeja el 60 %', menos.peor.relacion < 0.6);
  ok('Punto que limita = punto crítico con esa altura, en uno de los cerros', conB.peor.d === m.b.punto.d && conA.peor.d === m.a.punto.d &&
    [5000, 14000].some((x) => Math.abs(m.b.punto.d - x) < 600), `${(m.a.punto.d / 1000).toFixed(2)} y ${(m.b.punto.d / 1000).toFixed(2)} km`);
  const conHueco = base.map((p, i) => (i === 50 ? { ...p, z: null } : p));
  ok('Puntos sin cota: se excluyen y se cuentan', R.alturasMinimas(R.analizarPerfil({ perfil: conHueco, hA: 20, hB: 15, fMHz: 5800, k: 4 / 3 })).sinCota === 1);
  const pe = puntosPerfil(a, b, 'obstaculo', { d: 7.25, z: 140 });
  const ob = pe.puntos.find((p) => p.origen === 'obstaculo');
  ok('Terreno con obstáculo: punto exacto a 7,25 km con su cota', ob && ob.d === 7250 && ob.z === 140 && pe.puntos.length === 242);
  ok('Terreno con obstáculo fuera del trayecto: perfil plano', !puntosPerfil(a, b, 'obstaculo', { d: 30, z: 140 }).puntos.some((p) => p.origen === 'obstaculo'));
  const lat = pe.puntos.map((p) => p.lat), ordenado = pe.puntos.every((p, i) => i === 0 || p.d > pe.puntos[i - 1].d);
  ok('Perfil con obstáculo ordenado por distancia y sobre el círculo máximo', ordenado && lat.every(Number.isFinite));
}

// ---------- 5. Ejercicios con el mapa de cobertura ----------
{
  const params = { a: { lat: 40.0, lon: -4.8 }, radioKm: 10, N: 120 };
  const malla = C.definirMalla(params);
  const res = C.nuevoResultado(malla.N);
  const rnd = E.aleatorio('mapa');
  for (let r = 0; r < malla.N; r++) for (let c = 0; c < malla.N; c++) {
    const i = r * malla.N + c, dKm = R.distanciaKm(params.a, { lat: malla.latC[r], lon: malla.lonC[c] });
    res.dKm[i] = dKm;
    res.estado[i] = dKm > params.radioKm ? C.PIXEL.FUERA : C.PIXEL.OK;
    res.margen[i] = 45 - 6 * dKm + 10 * Math.sin(r / 7) + (rnd() - 0.5) * 4;
    res.prx[i] = res.margen[i] - 80;
    res.cop[i] = rnd() < 0.05 ? 1 : 0;
  }
  const ej = E.normalizarEjCob({ c: 'CXB234', modo: 'prediccion', n: 6, s: 1 });
  const p1 = E.elegirPuntos(res, malla, params, ej, '5'), p2 = E.elegirPuntos(res, malla, params, ej, ' 05 ');
  ok('Puntos reproducibles por alumno', JSON.stringify(p1) === JSON.stringify(p2) && p1.length === 6);
  ok('Puntos distintos para otro alumno', JSON.stringify(E.elegirPuntos(res, malla, params, ej, '6')) !== JSON.stringify(p1));
  const sol = p1.map((p) => E.solucionPunto(res, p));
  ok('Mitad sin señal y mitad con señal', sol.filter((s) => s.banda < 0).length === 3 && sol.filter((s) => s.banda >= 0).length === 3, sol.map((s) => s.banda).join(','));
  ok('Lejos de los límites de banda (≥ 1 dB) y sin Copernicus', p1.every((p) => [0, 10, 20, 30].every((l) => Math.abs(res.margen[p.i] - l) >= 1) && !res.cop[p.i]));
  ok('Dentro del 10–95 % del radio', p1.every((p) => res.dKm[p.i] >= 1 && res.dKm[p.i] <= 9.5));
  let sepMin = Infinity;
  for (const p of p1) for (const q of p1) if (p !== q) sepMin = Math.min(sepMin, R.distanciaKm(p, q));
  ok('Separados al menos el 15 % del radio', sepMin >= 1.5, `${sepMin.toFixed(2)} km`);
  ok('Cada punto en el centro de su píxel', p1.every((p) => p.lat === malla.latC[p.r] && p.lon === malla.lonC[p.c]));
  const fijos = E.normalizarEjCob({ ...ej, fijos: [{ lat: 40.03, lon: -4.77 }, { lat: 39.99, lon: -4.85 }] });
  const pf = E.elegirPuntos(res, malla, params, fijos, 'cualquiera');
  ok('Puntos fijos: llevados al centro de su píxel', pf.length === 2 && pf.every((p) => p.lat === malla.latC[p.r] && p.lon === malla.lonC[p.c]) && Math.abs(pf[0].lat - 40.03) < malla.dlat);
  const s0 = { banda: 1 };
  const c1 = E.corregirPunto('1', s0), c2 = E.corregirPunto('2', s0), c3 = E.corregirPunto('-1', s0), c4 = E.corregirPunto('', s0);
  ok('Corrección de un punto: banda y «llega»', c1.banda && c1.llega && !c2.banda && c2.llega && !c3.llega && c4.vacia && !E.corregirPunto('1', null).cuenta);
  const filas = E.filasSolucionarioCob(res, malla, params, ej, ['1', '2']);
  ok('Solucionario de cobertura: 6 puntos por alumno', filas.length === 13);
  ok('Opciones: «no llega» y las 4 bandas', E.OPCIONES_COB.length === 5 && E.OPCIONES_COB[4].texto.includes('≥ 30'));
}

// ---------- 6. Enlaces comprimidos ----------
{
  const estado = { a: { nombre: 'Talavera de la Reina (centro)', lat: 39.96, lon: -4.832, h: 20, g: 30, l: 1 }, b: { nombre: 'Cerro Cruces', lat: 40.1541, lon: -4.7434, h: 15, g: 30, l: 1 }, f: { v: 5.8, u: 'GHz' }, sens: -80, ejercicio: true, nota: 'ñ á € 𝜈' };
  const z = await codificarDatos(estado);
  const e = await codificarDatos(estado, { comprimir: false });
  ok('?z= comprimido y más corto que ?e=', z.clave === 'z' && z.valor.length < e.valor.length * 0.8, `${z.valor.length} frente a ${e.valor.length} caracteres`);
  const vuelta = await decodificarDatos(new URLSearchParams(`z=${z.valor}`));
  const vueltaE = await decodificarDatos(new URLSearchParams(`e=${e.valor}`));
  ok('?z= y ?e= ida y vuelta (UTF-8)', JSON.stringify(vuelta) === JSON.stringify(estado) && JSON.stringify(vueltaE) === JSON.stringify(estado));
  // Un enlace ?e= de la 1.3 (btoa(unescape(encodeURIComponent(json))))
  const antiguo = Buffer.from(JSON.stringify(estado), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  ok('Los enlaces ?e= de versiones anteriores se siguen leyendo', JSON.stringify(await decodificarDatos(new URLSearchParams(`e=${antiguo}`))) === JSON.stringify(estado));
}

// ---------- 7. Versión 1.5: niveles 5 a 9 ----------
// Camino de cálculo de app.js con el estado del ejercicio: aplicarLineas, presupuesto en espacio libre,
// alturasSegunCriterio (P.530), entradaDisponibilidad + calcularDisponibilidad y capacidadActual
async function comoLaApp15(datos) {
  const est = JSON.parse(JSON.stringify(E.datosAEstado(datos)));
  est.disp = normalizarDisponibilidad(est.disp);
  if (est.cap) est.cap = normalizarCapacidad(est.cap);
  const fMHz = R.aMHz(est.f.v, est.f.u), ptxDbm = R.potenciaDbm(est.p.v, est.p.u), k = R.leerK(est.k);
  const lin = {};
  for (const s of ['a', 'b']) {
    const ln = est[s].linea;
    if (ln?.modo !== 'calculada') continue;
    const r = perdidasLinea(ln, fMHz);
    lin[s] = r;
    if (r.valido) est[s].l = r.total;
  }
  const a = est.a, b = est.b, dKm = R.distanciaKm(a, b);
  const p = await obtenerPerfil(a, b, { modo: est.terreno, obstaculo: est.obstaculo });
  const modelo = obtenerModelo(est.modelo);
  const res = modelo.calcular({ dKm, fMHz, perfil: p.puntos, hA: a.h, hB: b.h });
  const pres = R.presupuesto({ ptxDbm, gtx: a.g, grx: b.g, ltx: a.l, lrx: b.l, perdidaTrayecto: res.perdida, sensibilidad: est.sens });
  const analizar = (kk) => R.analizarPerfil({ perfil: p.puntos, hA: a.h, hB: b.h, fMHz, k: kk });
  const an = analizar(k), dif = R.difraccionObstaculoPrincipal(an, fMHz);
  const o = { perdida: res.perdida, prx: pres.prx, margen: pres.margen };
  if (datos.nivel === 5) Object.assign(o, { alfaA: lin.a.elementos[0].dB100m, LA: a.l, LB: b.l });
  if (datos.nivel === 6) {
    const cx = perdidasLinea({ modo: 'calculada', elementos: [{ tipo: 'coaxial', modelo: datos.coax, longitud: datos.a.long }, { tipo: 'accesorio', id: 'conector', n: 2, valor: null }] }, fMHz);
    Object.assign(o, { fc: lin.a.elementos[0].fc, alfaGuia: lin.a.elementos[0].dB100m, LAguia: a.l, alfaCoax: cx.elementos[0].dB100m, LAcoax: cx.total });
  }
  if (datos.nivel === 7) {
    const alt = alturasMinimasP530({ dKm, clima: est.altcrit.clima, obstaculo: est.altcrit.obstaculo, analizar, minimas: R.alturasMinimas });
    const c = criterioDespejeP530({ dKm, clima: est.altcrit.clima, obstaculo: est.altcrit.obstaculo });
    const iO = p.puntos.findIndex((q) => q.origen === 'obstaculo');
    Object.assign(o, { ke: alt.ke, r1Obs: analizar(4 / 3).puntos[iO].r1, flecha43: analizar(4 / 3).puntos[iO].flecha, flechaKe: analizar(alt.ke).puntos[iO].flecha,
      hB1: R.alturasMinimas(analizar(c.paso1.k), c.paso1.fraccion).b.h, hB3: R.alturasMinimas(analizar(c.paso3.k), c.paso3.fraccion).b.h, hBmin: alt.b.h });
  }
  if (datos.nivel >= 8) {
    const J = !res.incluyeTerreno && dif ? dif.J : 0;
    const F = pres.margen - J;
    const ptos = p.puntos.filter((q) => q.z != null);
    const ht = ptos.reduce((s, q) => s + q.z, 0) / ptos.length;
    const clima = datosClima(null, puntoMedio(a, b), 0, est.disp.propios);
    const ent = { dKm, fGHz: fMHz / 1000, pol: est.itm.pol, yA: an.yA, yB: an.yB, ht, F, clima, nieve: est.disp.nieve };
    const d = calcularDisponibilidad(ent);
    Object.assign(o, { margen: F, hc: d.mp.hc, pw: d.mp.pwMes, pMp: d.mp.pAnual, gammaR: d.ll.gammaR, A001: d.ll.A001, pLluvia: d.ll.p, U: d.indisp, minAno: d.minAno });
    if (datos.nivel === 9) {
      const c = calcularCapacidad({ fGHz: fMHz / 1000, cap: est.cap, sens: est.sens, F, dispCon: (FF) => calcularDisponibilidad({ ...ent, F: FF }) });
      c.usadas.forEach((x, i) => { o[`rb${i + 1}`] = x.Rb; o[`m${i + 1}`] = x.margen; o[`u${i + 1}`] = x.indisp; });
      o.garantizada = c.garantizada ? c.garantizada.Rb : 0;
      o.media = c.media;
    }
  }
  return o;
}

// Resolución «de alumno» con las fórmulas del enunciado, constantes redondeadas (c = 3·10⁸ m/s,
// R = 6370 km) y la vía cerrada de la P.841 y de la inversa de la ec. (34)
function comoAlumno15(datos, sol) {
  const n = datos.nivel, f = datos.f.v, fMHz = f * 1000, c = 3e8, lam = c / (f * 1e9), D = datos.d * 1000;
  const ptx = datos.p.u === 'W' ? 10 * Math.log10(datos.p.v * 1000) : datos.p.v;
  const L = 32.44 + 20 * Math.log10(datos.d) + 20 * Math.log10(fMHz);
  const coaxA = (id) => { const cb = coaxial(id); return (cb.k1 * Math.sqrt(fMHz) + cb.k2 * fMHz) / 0.3048; };
  const conector = 0.05 * Math.sqrt(f);
  const r = { perdida: L };
  let la = datos.a.l, lb = datos.b.l;
  if (n === 5) {
    r.alfaA = coaxA(datos.a.cable);
    la = r.LA = r.alfaA * datos.a.long / 100 + 2 * conector;
    lb = r.LB = coaxA(datos.b.cable) * datos.b.long / 100 + 2 * conector;
  }
  if (n === 6) {
    const g = rectangular(datos.a.guia), aa = g.a * 0.0254, bb = g.b * 0.0254, sigma = 5.8e7, eta = 376.73;
    r.fc = c / (2 * aa) / 1e9;
    const k = 2 * Math.PI * f * 1e9 / c, beta = Math.sqrt(k * k - (Math.PI / aa) ** 2), Rs = Math.sqrt(2 * Math.PI * f * 1e9 * 4e-7 * Math.PI / (2 * sigma));
    r.alfaGuia = Rs * (2 * bb * Math.PI ** 2 + aa ** 3 * k * k) / (aa ** 3 * bb * beta * k * eta) * 8.686 * 100;
    la = r.LAguia = r.alfaGuia * datos.a.long / 100 + 0.5;
    r.alfaCoax = coaxA(datos.coax);
    r.LAcoax = r.alfaCoax * datos.a.long / 100 + 2 * conector;
  }
  r.prx = ptx - la + datos.a.g - L + datos.b.g - lb;
  r.margen = r.prx - datos.sens;
  if (n === 7) {
    const d1 = datos.obst.d * 1000, d2 = D - d1, t = d1 / D;
    r.ke = 157 / (144 + 2670 / datos.d);
    r.r1Obs = Math.sqrt(lam * d1 * d2 / D);
    r.flecha43 = d1 * d2 / (2 * (4 / 3) * 6370e3);
    r.flechaKe = d1 * d2 / (2 * r.ke * 6370e3);
    r.hB1 = (datos.obst.z + r.flecha43 + 1.0 * r.r1Obs - datos.a.h * (1 - t)) / t;
    r.hB3 = (datos.obst.z + r.flechaKe - datos.a.h * (1 - t)) / t;
    r.hBmin = Math.max(r.hB1, r.hB3);
  }
  if (n >= 8) {
    const cl = datos.clima, d = datos.d;
    const kR = +sol.k838.toFixed(5), aR = +sol.alfa838.toFixed(4);     // como los da el enunciado
    const U = (F) => {
      const he = datos.a.h, hr = datos.b.h;
      const ep = Math.abs(hr - he) / d, hc = (hr + he) / 2 - d * d / 102, hL = Math.min(he, hr);
      const vsr = Math.min((cl.dN75 / 50) ** 1.8 * Math.exp(-hc / (2.5 * Math.sqrt(d))), cl.dN75 * d ** 1.5 * f ** 0.5 / 24730);
      const e0 = -0.376 * Math.tanh((hc - 147) / 125) - 0.334 * ep ** 0.39 - 0.00027 * hL + 17.85 * vsr;
      const pw = 10 ** datos.logK * d ** 3.51 * (f * f + 13) ** 0.447 * 10 ** (e0 - F / 10);
      const pMp = (pw / 2.85) ** (1 / 0.87);
      const gammaR = kR * cl.R001 ** aR;
      const rr = 1 / (0.477 * d ** 0.633 * cl.R001 ** (0.073 * aR) * f ** 0.123 - 10.579 * (1 - Math.exp(-0.024 * d)));
      const A001 = gammaR * d * rr;
      const C0 = 0.12 + 0.4 * Math.log10(f / 10) ** 0.8, C1 = 0.07 ** C0 * 0.12 ** (1 - C0), C2 = 0.855 * C0 + 0.546 * (1 - C0), C3 = 0.139 * C0 + 0.043 * (1 - C0);
      const Lq = Math.log10(F / (A001 * C1));
      const pLl = 10 ** ((-C2 + Math.sqrt(C2 * C2 - 4 * C3 * Lq)) / (2 * C3));
      return { hc, pw, pMp, gammaR, A001, pLl, U: pMp + pLl };
    };
    if (n === 8) {
      const x = U(r.margen);
      Object.assign(r, { hc: x.hc, pw: x.pw, pMp: x.pMp, gammaR: x.gammaR, A001: x.A001, pLluvia: x.pLl, U: x.U, minAno: x.U / 100 * 365.25 * 1440 });
    } else {
      const cp = datos.cap, M = { 2: 4, 3: 8, '4L': 16, '4H': 32, '5L': 64, '5H': 128, '6L': 256, '6H': 512, 7: 1024, 8: 2048 };
      const us = cp.mods.map((m, i) => {
        r[`rb${i + 1}`] = cp.cs / (1 + cp.alfa) * Math.log2(M[m]) * cp.r;
        r[`m${i + 1}`] = r.prx - cp.umbrales[i];
        return (r[`u${i + 1}`] = U(r[`m${i + 1}`]).U);
      });
      const okm = [0, 1, 2].filter((i) => 100 - us[i] >= cp.objetivo);
      r.garantizada = okm.length ? r[`rb${okm[okm.length - 1] + 1}`] : 0;
      r.media = [0, 1, 2].reduce((s, i) => s + r[`rb${i + 1}`] * ((i < 2 ? us[i + 1] : 100) - us[i]) / 100, 0);
    }
  }
  return r;
}
{
  // Instantáneas: si cambian, los enlaces ya repartidos darían otros datos
  const inst = {
    5: '{"nivel":5,"f":{"v":5.8,"u":"GHz"},"p":{"v":11,"u":"dBm"},"d":15.7,"a":{"h":15,"g":26.5,"cable":"LMR-240","long":30},"b":{"h":40,"g":27,"cable":"LMR-900","long":5},"sens":-85,"k":"4/3","obst":null}',
    6: '{"nivel":6,"f":{"v":7,"u":"GHz"},"p":{"v":20,"u":"dBm"},"d":17.3,"a":{"h":40,"g":32.5,"guia":"WR-137","long":70},"b":{"h":40,"g":35.5,"l":1},"sens":-57,"k":"4/3","obst":null,"coax":"LMR-400"}',
    7: '{"nivel":7,"f":{"v":7,"u":"GHz"},"p":{"v":0.1,"u":"W"},"d":15.8,"a":{"h":50,"g":32,"l":1},"b":{"h":20,"g":30,"l":1},"sens":-71,"k":"4/3","obst":{"d":3.7,"z":32}}',
    8: '{"nivel":8,"f":{"v":23,"u":"GHz"},"p":{"v":16,"u":"dBm"},"d":8.3,"a":{"h":30,"g":36,"l":3},"b":{"h":30,"g":37.5,"l":2.5},"sens":-84,"k":"4/3","obst":null,"pol":"V","logK":-4.35,"clima":{"K":0.00004466835921509635,"dN75":53,"R001":33,"P0":5.05,"h0":2.502}}',
    9: '{"nivel":9,"f":{"v":23,"u":"GHz"},"p":{"v":23,"u":"dBm"},"d":7.9,"a":{"h":45,"g":40,"l":1.5},"b":{"h":80,"g":35.5,"l":2},"sens":-78,"k":"4/3","obst":null,"pol":"V","logK":-4.05,"clima":{"K":0.00008912509381337459,"dN75":41,"R001":48,"P0":7.18,"h0":3.398},"cap":{"cs":14,"alfa":0.25,"r":0.8,"objetivo":99.995,"mods":["3","4H","5L"],"umbrales":[-78,-73,-70],"tablas":["F.5a","F.5a","F.5a"]}}',
  };
  ok('Instantáneas de los niveles 5 a 9 (K7M2QX, alumna «Ana»)', [5, 6, 7, 8, 9].every((n) => JSON.stringify(E.generarDatos({ c: 'K7M2QX', n, s: 1 }, 'Ana').datos) === inst[n]));
  ok('Niveles 1–9 en la configuración y en el enlace (?g=)', [5, 9].every((n) => E.paramAConfig(E.configAParam({ c: 'K7M2QX', n, s: 1 }))?.n === n) && E.normalizarConfig({ c: 'K7M2QX', n: 10 }).n === 1);
  ok('Niveles 5–9: solo sus preguntas (no acumulan las de 1–4)', [5, 6, 7, 8, 9].every((n) => E.preguntasDe(n).every((q) => q.nivel === n)) &&
    E.preguntasDe(4).length === E.PREGUNTAS.filter((q) => q.nivel <= 4).length && E.preguntasDe(9).length === 11);
  let iguales = 0, casos = 0, alumno = 0, coincide = 0, distintos = 0, validos = 0;
  const noAcept = [];
  const cuenta = { pasoLimita: { 1: 0, 3: 0 }, garantizada: { 1: 0, 2: 0 }, bandas: {}, pol: { V: 0, H: 0 } };
  for (const n of [5, 6, 7, 8, 9]) {
    const vistos = new Set();
    for (let i = 1; i <= (n === 9 ? 40 : 60); i++) {
      const { datos, sol } = E.generarDatos({ c: 'PRVEBA', n, s: 1 }, String(i));
      vistos.add(JSON.stringify(datos));
      const app = await comoLaApp15(datos);
      casos++;
      const preg = E.preguntasDe(n);
      if (preg.every((q) => app[q.clave] === sol[q.clave])) iguales++;
      else if (casos - iguales <= 3) console.log('      distinto:', n, i, preg.filter((q) => app[q.clave] !== sol[q.clave]).map((q) => `${q.clave} ${app[q.clave]} ${sol[q.clave]}`).join('; '));
      if (E.estadoCoincide(E.datosAEstado(datos), datos)) coincide++;
      const c = E.corregir(comoAlumno15(datos, sol), sol, n);
      if (c.every((x) => x.ok)) alumno++;
      else if (noAcept.length < 4) noAcept.push(`n${n} #${i}: ` + c.filter((x) => !x.ok).map((x) => `${x.clave} ${x.valor} vs ${x.sol} ±${x.tol}`).join('; '));
      // Zona de validez: sin avisos de la P.530, desvanecimiento profundo y rama central de la P.841
      if (n <= 6) validos += sol.estado === 'despejado' && sol.J === 0 ? 1 : 0;
      if (n === 7) { validos += sol.limitaObstaculo && sol.hBmin === Math.max(sol.hB1, sol.hB3) ? 1 : 0; cuenta.pasoLimita[sol.pasoLimita]++; }
      if (n >= 8) {
        const ds = n === 8 ? [sol.disp] : sol.dispMods;
        validos += ds.every((d) => !d.avisos.length && d.mp.profundo && d.ll.p >= 0.001 && d.ll.p <= 1 && d.mp.pAnual < 3 && d.mp.pAnual > (2.85 / 12) ** (1 / 0.13)) && sol.J === 0 ? 1 : 0;
        cuenta.bandas[datos.f.v] = (cuenta.bandas[datos.f.v] || 0) + 1; cuenta.pol[datos.pol]++;
      }
      if (n === 9) cuenta.garantizada[sol.garantizada === sol.rb2 ? 2 : 1]++;
    }
    distintos += vistos.size;
  }
  noAcept.forEach((x) => console.log('      no aceptada:', x));
  ok(`Soluciones del generador === camino de app.js (${casos} alumnos, niveles 5–9)`, iguales === casos, `${iguales}/${casos}`);
  ok('Enunciados distintos para cada alumno', distintos === casos, `${distintos}/${casos}`);
  ok('El estado cargado coincide con el enunciado (estadoCoincide)', coincide === casos);
  ok('Resolución a mano con las fórmulas del enunciado (c = 3·10⁸, R = 6370 km, P.841 y ec. 34 cerradas): aceptada', alumno === casos, `${alumno}/${casos}`);
  ok('Todos los ejercicios en la zona de validez de las fórmulas', validos === casos, `${validos}/${casos}`);
  // En clima templado con obstáculo aislado (0,0·r₁ con kₑ), la flecha adicional con kₑ no llega a r₁ en estos trayectos
  // (máximo en el centro: d²·(1/kₑ − 3/4)/(8R) frente a √(λd)/2; a 7 GHz y 40 km, 18,6 m frente a 20,7 m): limita el paso 1
  ok('Nivel 7: limita el paso 1 (1,0·r₁ con k = 4/3), como corresponde a clima templado y obstáculo aislado', cuenta.pasoLimita[1] === 60, JSON.stringify(cuenta.pasoLimita));
  ok('Niveles 8–9: las cuatro bandas y las dos polarizaciones', Object.keys(cuenta.bandas).length === 4 && cuenta.pol.V > 10 && cuenta.pol.H > 10, JSON.stringify(cuenta));
  ok('Nivel 9: la capacidad garantizada es unas veces la modulación 1 y otras la 2', cuenta.garantizada[1] > 3 && cuenta.garantizada[2] > 3, JSON.stringify(cuenta.garantizada));

  // Datos del enunciado cambiados → aviso
  const d8 = E.generarDatos({ c: 'PRVEBA', n: 8, s: 1 }, '1').datos;
  const e8 = E.datosAEstado(d8);
  ok('Cambiar la polarización, R0,01 o la nieve húmeda se detecta', !E.estadoCoincide({ ...e8, itm: { pol: d8.pol === 'V' ? 'H' : 'V' } }, d8) &&
    !E.estadoCoincide({ ...e8, disp: { nieve: false, propios: { ...e8.disp.propios, R001: 99 } } }, d8) && !E.estadoCoincide({ ...e8, disp: { ...e8.disp, nieve: true } }, d8));
  const d5 = E.generarDatos({ c: 'PRVEBA', n: 5, s: 1 }, '1').datos, e5 = E.datosAEstado(d5);
  const e5b = JSON.parse(JSON.stringify(e5)); e5b.a.linea.elementos[0].longitud += 1;
  ok('Cambiar la longitud del cable se detecta', E.estadoCoincide(e5, d5) && !E.estadoCoincide(e5b, d5));
  const d9 = E.generarDatos({ c: 'PRVEBA', n: 9, s: 1 }, '1').datos, e9 = E.datosAEstado(d9);
  ok('Cambiar la separación de canal o un umbral se detecta', !E.estadoCoincide({ ...e9, cap: { ...e9.cap, cs: 28.5 } }, d9) &&
    !E.estadoCoincide({ ...e9, cap: { ...e9.cap, umbrales: { [d9.cap.mods[0]]: -90 } } }, d9));
  // Nivel 6: la guía pierde menos que el coaxial; nivel 9: Rb de la ficha SAF (256QAM, 28 MHz, α 0,25, r 0,9 → 161,28 Mbit/s)
  const s6 = E.generarDatos({ c: 'PRVEBA', n: 6, s: 1 }, '2').sol;
  ok('Nivel 6: guía con menos pérdidas que el coaxial y fc por debajo de la banda', s6.LAguia < s6.LAcoax && s6.fc < 5.85);
  // Enunciado y solucionario
  const t9 = E.enunciado(d9, 9), t8 = E.enunciado(d8, 8), t5 = E.enunciado(d5, 5);
  ok('Enunciados con las fórmulas y fuentes (P.530-19, P.838-3, P.841-7, ETSI, Times Microwave)', /P\.530-19/.test(t8) && /P\.838-3/.test(t8) && /P\.841-7/.test(t8) && /EN 302 217-2/.test(t9) && /k₁ = /.test(t5));
  for (const n of [5, 6, 7, 8, 9]) {
    const csv = aCSV(E.filasSolucionario({ c: 'PRVEBA', n, s: 1 }, ['1', 'Ana']));
    const l = csv.trim().split('\r\n');
    const cols = l.map((x) => x.split(';').length);
    ok(`Solucionario CSV del nivel ${n}: cabecera + 2 alumnos con las mismas columnas`, l.length === 3 && cols.every((x) => x === cols[0]) && l[0].includes(E.preguntasDe(n).at(-1).texto));
  }
}

console.log(`\n${fallos ? `${fallos} FALLOS de ${total}` : `Todas las pruebas de ejercicios (versiones 1.4 y 1.5) superadas (${total})`}`);
process.exit(fallos ? 1 : 0);
