// Pruebas de la versión 1.4 (sin red): node pruebas/prueba-ejercicios.mjs
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

console.log(`\n${fallos ? `${fallos} FALLOS de ${total}` : `Todas las pruebas de la versión 1.4 superadas (${total})`}`);
process.exit(fallos ? 1 : 0);
