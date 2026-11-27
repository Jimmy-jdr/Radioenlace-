/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// ejercicios.js — Ejercicios aleatorios con comprobación (versión 1.4)
// Sin DOM: se usa en la página y en las pruebas de Node.
//
// · El enlace de un ejercicio solo lleva su configuración (código, nivel y
//   si se permite ver la solución). Los datos y las soluciones se generan en
//   el dispositivo del alumno a partir de una semilla = código + nivel +
//   identificador del alumno: cada alumno tiene sus datos y salen iguales en
//   cualquier dispositivo.
// · Las soluciones se calculan con las MISMAS funciones que la app
//   (radio.js y terreno.js), con el mismo perfil: lo que se comprueba es
//   exactamente lo que la app muestra al revelar los resultados.
// · Ejercicios con el mapa de cobertura: elección de puntos (aleatorios por
//   alumno o fijos) y corrección de «¿llega la señal?» y de la banda de margen.
// =====================================================================
import * as R from './radio.js';
import { puntosPerfil } from './terreno.js';
import { bandaDe, BANDAS, PIXEL } from './cobertura.js';
import { num } from './informe.js';

// Emplazamiento de referencia de los ejercicios teóricos (como el ejemplo teórico)
export const A_EJ = { lat: 39.96, lon: -4.832 };

export const NIVELES = {
  1: { titulo: 'Nivel 1 · Presupuesto del enlace', corto: 'presupuesto', texto: 'Pérdidas en espacio libre, potencia recibida y margen (terreno plano).' },
  2: { titulo: 'Nivel 2 · Fresnel y curvatura', corto: 'Fresnel y curvatura', texto: 'Además: r₁ en el punto medio y en el obstáculo, y la flecha de la Tierra en el obstáculo.' },
  3: { titulo: 'Nivel 3 · Obstáculo y difracción', corto: 'difracción', texto: 'Además: altura del obstáculo sobre la línea de visión, ν, J(ν) y margen con difracción (UIT-R P.526).' },
  4: { titulo: 'Nivel 4 · Altura mínima de antena', corto: 'altura mínima', texto: 'Además: altura mínima de la antena B (con A fija) para despejar el 60 % de r₁.' },
};

// Preguntas: tolerancia absoluta (abs) o relativa (rel, con mínimo abs)
// Se aceptan c = 3·10⁸ m/s, la constante 32,44 dB, R = 6370 km y redondeos intermedios.
export const PREGUNTAS = [
  { clave: 'perdida', nivel: 1, texto: 'Pérdidas en espacio libre (L)', unidad: 'dB', dec: 2, abs: 0.2 },
  { clave: 'prx', nivel: 1, texto: 'Potencia recibida en espacio libre (Prx)', unidad: 'dBm', dec: 2, abs: 0.2 },
  { clave: 'margen', nivel: 1, texto: 'Margen sobre la sensibilidad (M)', unidad: 'dB', dec: 2, abs: 0.2 },
  { clave: 'r1Medio', nivel: 2, texto: 'Radio r₁ en el punto medio', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'r1Obs', nivel: 2, texto: 'Radio r₁ en el obstáculo', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'flechaObs', nivel: 2, texto: 'Flecha de la Tierra en el obstáculo', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'hObs', nivel: 3, texto: 'Altura del obstáculo sobre la línea de visión (h)', unidad: 'm', dec: 2, abs: 0.1 },
  { clave: 'nu', nivel: 3, texto: 'Parámetro de difracción ν', unidad: '', dec: 3, abs: 0.02 },
  { clave: 'J', nivel: 3, texto: 'Pérdida por difracción J(ν)', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'margenDif', nivel: 3, texto: 'Margen con difracción (Md)', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'hBmin', nivel: 4, texto: 'Altura mínima de la antena B (A fija) para despejar el 60 % de r₁', unidad: 'm', dec: 2, rel: 0.01, abs: 0.1 },
];
export const preguntasDe = (nivel) => PREGUNTAS.filter((p) => p.nivel <= nivel);
export const tolerancia = (p, sol) => Math.max(p.abs ?? 0, (p.rel ?? 0) * Math.abs(sol));

// ---------------------------------------------------------------------
// Semillas y números aleatorios reproducibles
// cyrb128 (hash de 128 bits) + sfc32 (Small Fast Counter, PractRand):
// solo operaciones enteras de 32 bits → el mismo resultado en cualquier navegador.
// ---------------------------------------------------------------------
export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
export function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
export function aleatorio(semilla) {
  const r = sfc32(...cyrb128(String(semilla)));
  for (let i = 0; i < 12; i++) r();     // descarta los primeros valores
  return r;
}

// Identificador del alumno: sin tildes, sin espacios ni signos y en mayúsculas
// («nº 7», «Nº7» y «n7» dan lo mismo; «07» y «7» también)
export function normalizarId(t) {
  let s = String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  s = s.replace(/^NO?(?=\d)/, '');          // «Nº 7» → «7»
  if (/^\d+$/.test(s)) s = String(Number(s)); // «07» → «7»
  return s;
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin I, O, 0 ni 1
export function nuevoCodigo(rand = Math.random) {
  let c = '';
  for (let i = 0; i < 6; i++) c += ALFABETO_CODIGO[Math.floor(rand() * ALFABETO_CODIGO.length)];
  return c;
}
export const codigoValido = (c) => typeof c === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(c);

// Configuración que viaja en el enlace (?g=…)
export function normalizarConfig(x) {
  if (!x || !codigoValido(x.c)) return null;
  const n = [1, 2, 3, 4].includes(+x.n) ? +x.n : 1;
  return { v: 1, c: x.c, n, s: x.s === 0 || x.s === false ? 0 : 1 };
}
export const configAParam = (cfg) => btoa(JSON.stringify({ v: 1, c: cfg.c, n: cfg.n, s: cfg.s ? 1 : 0 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function paramAConfig(t) {
  try { return normalizarConfig(JSON.parse(atob(String(t).replace(/-/g, '+').replace(/_/g, '/')))); } catch { return null; }
}

// ---------------------------------------------------------------------
// Datos del enunciado
// ---------------------------------------------------------------------
// Bandas habituales de radioenlaces y rangos realistas de ganancia y distancia
export const BANDAS_EJ = [
  { f: 2.4, g: [14, 24], d: [2, 15] },
  { f: 5.8, g: [23, 32], d: [3, 25] },
  { f: 7, g: [30, 38], d: [10, 40] },
  { f: 11, g: [32, 40], d: [8, 30] },
  { f: 13, g: [32, 40], d: [5, 25] },
  { f: 18, g: [32, 41], d: [3, 15] },
  { f: 23, g: [34, 41], d: [2, 10] },
];
const POTENCIAS_W = [0.1, 0.2, 0.25, 0.5, 1, 2];

export function montarEnlace(datos) {
  return { a: { ...A_EJ }, b: R.destino(A_EJ, 90, datos.d) };
}

// Soluciones, con el mismo camino de cálculo que app.js (espacio libre + P.526)
export function resolver(datos) {
  const { a, b } = montarEnlace(datos);
  const fMHz = R.aMHz(datos.f.v, datos.f.u), ptxDbm = R.potenciaDbm(datos.p.v, datos.p.u), k = R.leerK(datos.k);
  const dKm = R.distanciaKm(a, b);
  const perdida = R.perdidasEspacioLibre(dKm, fMHz);
  const pres = R.presupuesto({ ptxDbm, gtx: datos.a.g, grx: datos.b.g, ltx: datos.a.l, lrx: datos.b.l, perdidaTrayecto: perdida, sensibilidad: datos.sens });
  const base = puntosPerfil(a, b, datos.obst ? 'obstaculo' : 'plano', datos.obst);
  const an = R.analizarPerfil({ perfil: base.puntos, hA: datos.a.h, hB: datos.b.h, fMHz, k });
  const dif = R.difraccionObstaculoPrincipal(an, fMHz);
  const alt = R.alturasMinimas(an);
  const iObs = base.puntos.findIndex((p) => p.origen === 'obstaculo');
  const po = iObs >= 0 ? an.puntos[iObs] : null;
  return {
    perdida, prx: pres.prx, margen: pres.margen, ptxDbm,
    r1Medio: an.r1Medio,
    r1Obs: po?.r1 ?? null, flechaObs: po?.flecha ?? null, hObs: po ? -po.despeje : null, relObs: po?.relacion ?? null,
    nu: dif?.nu ?? null, J: dif?.J ?? 0, margenDif: pres.margen - (dif?.J ?? 0),
    hBmin: alt.b?.h ?? null,
    peorEsObstaculo: !!po && an.peor === po, limitaObstaculo: !!po && alt.b?.punto === po,
    estado: an.estado, an, dif, alt,
  };
}

// Genera los datos de un alumno (determinista)
export function generarDatos(cfg, id) {
  const nivel = cfg.n;
  const rand = aleatorio(`${cfg.c}|${nivel}|${normalizarId(id)}`);
  const ent = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const elegir = (arr) => arr[Math.floor(rand() * arr.length)];
  const paso = (a, b, s) => +(a + s * ent(0, Math.round((b - a) / s))).toFixed(6);
  const unif = (a, b) => a + (b - a) * rand();
  for (let intento = 0; intento < 5000; intento++) {
    const banda = elegir(BANDAS_EJ);
    const d = paso(banda.d[0], banda.d[1], 0.1);
    const datos = {
      f: { v: banda.f, u: 'GHz' },
      p: rand() < 0.5 ? { v: elegir(POTENCIAS_W), u: 'W' } : { v: ent(10, 30), u: 'dBm' },
      d,
      a: { h: paso(10, 60, 5), g: paso(banda.g[0], banda.g[1], 0.5), l: paso(0.5, 3, 0.5) },
      b: { h: paso(10, 60, 5), g: paso(banda.g[0], banda.g[1], 0.5), l: paso(0.5, 3, 0.5) },
      sens: 0,
      k: nivel >= 3 ? elegir(['4/3', '4/3', '1', '2/3']) : '4/3',
      obst: null,
    };
    // Sensibilidad para un margen en espacio libre entre −5 y 45 dB
    const s0 = resolver({ ...datos, sens: 0 });
    datos.sens = Math.round(s0.prx - unif(-5, 45));
    if (datos.sens < -95 || datos.sens > -55) continue;

    if (nivel === 1) {
      // Terreno plano y antenas que despejan el 60 % (solo se pregunta el presupuesto)
      let s = resolver(datos);
      if (s.estado !== 'despejado') {
        const h = Math.ceil((s.alt.igual.h + 1) / 5) * 5;
        if (h > 100) continue;
        datos.a.h = datos.b.h = h;
        s = resolver(datos);
        if (s.estado !== 'despejado') continue;
      }
      return { datos, sol: s };
    }

    // Niveles 2 a 4: un obstáculo agudo (filo de cuchillo) en el trayecto
    const d1 = paso(Math.ceil(Math.max(0.5, 0.2 * d) * 10) / 10, Math.floor(Math.min(d - 0.5, 0.8 * d) * 10) / 10, 0.1);
    if (!(d1 > 0 && d1 < d)) continue;
    const fMHz = R.aMHz(datos.f.v, datos.f.u), k = R.leerK(datos.k);
    const d1m = d1 * 1000, d2m = (d - d1) * 1000;
    const flecha = R.flechaTierra(d1m, d2m, k), r1 = R.radioFresnel(d1m, d2m, fMHz);
    const los = datos.a.h + ((datos.b.h - datos.a.h) * d1) / d;
    const rho = elegir([[-1.2, -0.15], [0.1, 0.5], [0.7, 1.3]]);
    const z = Math.round(los - flecha - unif(rho[0], rho[1]) * r1);
    if (z < 1) continue;
    datos.obst = { d: d1, z };
    const s = resolver(datos);
    if (!s.peorEsObstaculo || Math.abs(s.relObs - 0.6) < 0.02 || s.flechaObs < 0.1) continue;
    if (nivel >= 3 && (Math.abs(s.nu + 0.78) < 0.02 || s.margenDif < -30 || s.margenDif > 45)) continue;
    if (nivel >= 4 && (!s.limitaObstaculo || !(s.hBmin >= 1 && s.hBmin <= 200))) continue;
    return { datos, sol: s };
  }
  throw new Error('No se pudo generar el ejercicio');
}

// Pasa los datos del enunciado al estado de la app
export function datosAEstado(datos) {
  const { a, b } = montarEnlace(datos);
  return {
    terreno: datos.obst ? 'obstaculo' : 'plano',
    obstaculo: datos.obst ? { ...datos.obst } : undefined,
    a: { nombre: 'Extremo A', lat: a.lat, lon: a.lon, h: datos.a.h, g: datos.a.g, l: datos.a.l },
    b: { nombre: 'Extremo B', lat: b.lat, lon: b.lon, h: datos.b.h, g: datos.b.g, l: datos.b.l },
    f: { ...datos.f }, p: { ...datos.p }, sens: datos.sens, k: datos.k, modelo: 'espacio-libre',
  };
}

// ¿El estado sigue teniendo los datos del enunciado? (si el alumno los cambia)
export function estadoCoincide(estado, datos) {
  const e = datosAEstado(datos);
  const igual = (x, y) => Math.abs(Number(x) - Number(y)) < 1e-9;
  return estado.terreno === e.terreno && estado.modelo === 'espacio-libre' && String(estado.k) === String(e.k) &&
    igual(estado.a.lat, e.a.lat) && igual(estado.a.lon, e.a.lon) && igual(estado.b.lat, e.b.lat) && igual(estado.b.lon, e.b.lon) &&
    ['h', 'g', 'l'].every((c) => igual(estado.a[c], e.a[c]) && igual(estado.b[c], e.b[c])) &&
    igual(estado.f.v, e.f.v) && estado.f.u === e.f.u && igual(estado.p.v, e.p.v) && estado.p.u === e.p.u && igual(estado.sens, e.sens) &&
    (!e.obstaculo || (igual(estado.obstaculo?.d, e.obstaculo.d) && igual(estado.obstaculo?.z, e.obstaculo.z)));
}

// Números del enunciado: coma decimal y signo menos tipográfico
export const n = (x, dec = 2) => String(+Number(x).toFixed(dec)).replace('.', ',').replace('-', '−');

export function enunciado(datos, nivel) { return partesEnunciado(datos, nivel).join(' '); }

// Párrafos del enunciado (la interfaz los muestra por separado)
export function partesEnunciado(datos, nivel) {
  const p = datos.p.u === 'W' ? `${n(datos.p.v)} W` : `${n(datos.p.v)} dBm`;
  const partes = [
    `Radioenlace de ${n(datos.f.v)} GHz entre A y B, separados ${n(datos.d, 1)} km, sobre terreno plano (cota 0 m)` +
      (datos.obst ? ` con un obstáculo agudo («filo de cuchillo») de ${n(datos.obst.z, 0)} m de cota a ${n(datos.obst.d, 1)} km de A.` : '.'),
    `Lado A (transmisor): potencia de ${p}, ${n(datos.a.l)} dB de pérdidas en cables y conectores y antena de ${n(datos.a.g, 1)} dBi a ${n(datos.a.h, 0)} m sobre el suelo.`,
    `Lado B (receptor): antena de ${n(datos.b.g, 1)} dBi a ${n(datos.b.h, 0)} m sobre el suelo, ${n(datos.b.l)} dB de pérdidas y sensibilidad de ${n(datos.sens, 0)} dBm.`,
    nivel >= 2 ? `Factor de radio terrestre equivalente k = ${datos.k}; radio terrestre R = 6371 km.` : '',
    'Toma c = 299\u202f792\u202f458 m/s (con 3·10⁸ m/s el resultado también se acepta).',
    nivel >= 3 ? 'Para la difracción, usa la ecuación del filo de cuchillo de la UIT-R P.526: J(ν) = 6,9 + 20·log(√((ν − 0,1)² + 1) + ν − 0,1) para ν > −0,78 (si no, J = 0).' : '',
    nivel >= 4 ? 'Altura mínima: la línea de visión debe pasar al menos un 60 % de r₁ por encima del obstáculo (más la flecha), con la antena A a la altura del enunciado.' : '',
  ];
  return partes.filter(Boolean);
}

// Corrección de las respuestas: [{ clave, texto, unidad, dec, sol, tol, valor, vacia, ok }]
export function corregir(respuestas, sol, nivel) {
  return preguntasDe(nivel).map((p) => {
    const v = R.leerNumero(respuestas?.[p.clave]);
    const s = sol[p.clave];
    const tol = tolerancia(p, s);
    const vacia = !Number.isFinite(v);
    return { ...p, sol: s, tol, valor: vacia ? null : v, vacia, ok: !vacia && Math.abs(v - s) <= tol + 1e-9 };
  });
}

// Solucionario para el profesor: una fila por alumno (CSV del formato de la app)
export function filasSolucionario(cfg, ids) {
  const preg = preguntasDe(cfg.n);
  const cab = ['identificador', 'identificador normalizado', 'frecuencia (GHz)', 'potencia', 'unidad de potencia', 'distancia (km)',
    'ganancia A (dBi)', 'pérdidas A (dB)', 'altura A (m)', 'ganancia B (dBi)', 'pérdidas B (dB)', 'altura B (m)', 'sensibilidad (dBm)', 'k',
    'obstáculo: distancia a A (km)', 'obstáculo: cota (m)', ...preg.map((p) => `${p.texto}${p.unidad ? ` (${p.unidad})` : ''}`)];
  cab.numericas = [];
  const numericas = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, ...preg.map((_, i) => 16 + i)];
  const filas = [cab];
  for (const id of ids) {
    const { datos, sol } = generarDatos(cfg, id);
    const r = [id, normalizarId(id), num(datos.f.v, 1), num(datos.p.v, 2), datos.p.u, num(datos.d, 1),
      num(datos.a.g, 1), num(datos.a.l, 1), num(datos.a.h, 0), num(datos.b.g, 1), num(datos.b.l, 1), num(datos.b.h, 0), num(datos.sens, 0), datos.k,
      datos.obst ? num(datos.obst.d, 1) : '', datos.obst ? num(datos.obst.z, 0) : '', ...preg.map((p) => num(sol[p.clave], p.dec))];
    r.numericas = numericas;
    filas.push(r);
  }
  return filas;
}

// Lista de identificadores del solucionario: líneas de texto o 1…N
export function listaIds(texto, nMax = 30) {
  const ids = String(texto || '').split(/[\r\n;,\t]+/).map((s) => s.trim()).filter((s) => normalizarId(s));
  if (ids.length) {
    const vistos = new Set();
    return ids.filter((s) => { const k = normalizarId(s); if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  return Array.from({ length: Math.max(1, Math.min(200, nMax | 0)) }, (_, i) => String(i + 1));
}

// ---------------------------------------------------------------------
// Ejercicios con el mapa de cobertura
// ---------------------------------------------------------------------
export const OPCIONES_COB = [
  { v: -1, texto: 'No llega (por debajo de la sensibilidad)' },
  ...BANDAS.map((b, i) => ({ v: i, texto: `Llega con ${b.max === Infinity ? `≥ ${b.min}` : `${b.min}–${b.max}`} dB de margen` })),
];
const LIMITES_BANDA = [0, ...BANDAS.slice(1).map((b) => b.min)];

export function normalizarEjCob(x) {
  if (!x || !codigoValido(x.c)) return null;
  const r = { c: x.c, modo: x.modo === 'lectura' ? 'lectura' : 'prediccion', n: Math.min(8, Math.max(3, Math.round(+x.n) || 5)), s: x.s === 0 || x.s === false ? 0 : 1, fijos: null };
  if (Array.isArray(x.fijos) && x.fijos.length) {
    r.fijos = x.fijos.slice(0, 8).filter((p) => Number.isFinite(+p?.lat) && Number.isFinite(+p?.lon)).map((p) => ({ lat: +(+p.lat).toFixed(6), lon: +(+p.lon).toFixed(6) }));
    if (!r.fijos.length) r.fijos = null;
    else r.n = r.fijos.length;
  }
  // En el dispositivo del alumno (no viajan en el enlace): identificador, respuestas y B original
  if (typeof x.id === 'string' && normalizarId(x.id)) r.id = x.id.slice(0, 40);
  r.resp = limpiarResp(x.resp);
  if (x.corregido) r.corregido = true;
  const b = x.bOrig;
  if (b && ['lat', 'lon', 'h', 'g', 'l'].every((k) => Number.isFinite(+b[k]))) r.bOrig = { lat: +b.lat, lon: +b.lon, h: +b.h, g: +b.g, l: +b.l };
  return r;
}

function limpiarResp(x) {
  const r = {};
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (/^\w{1,12}$/.test(k) && v != null) r[k] = String(v).slice(0, 20);
  return r;
}

// Ejercicio aleatorio en curso (estado guardado en el dispositivo del alumno)
export function normalizarGenerado(x) {
  const cfg = normalizarConfig(x);
  if (!cfg || typeof x.id !== 'string' || !normalizarId(x.id)) return null;
  return { ...cfg, id: x.id.slice(0, 40), resp: limpiarResp(x.resp), ...(x.corregido ? { corregido: true } : {}) };
}

// Puntos aleatorios de un alumno a partir del mapa calculado:
// píxeles calculados sin cotas de Copernicus, entre el 10 % y el 95 % del radio
// (y a más de 0,5 km de A), lejos (≥ 1 dB) de los límites de las bandas para que
// no haya dudas; mitad sin señal y mitad con señal (repartidos por bandas) y
// separados entre sí al menos el 15 % del radio (o menos si no caben).
export function elegirPuntos(res, malla, params, ej, id) {
  const N = malla.N;
  if (ej.fijos) {
    return ej.fijos.map((p, k) => {
      const r = Math.floor((malla.norte - p.lat) / malla.dlat), c = Math.floor((p.lon - malla.oeste) / malla.dlon);
      const dentro = r >= 0 && c >= 0 && r < N && c < N;
      return { k, r, c, lat: dentro ? malla.latC[r] : p.lat, lon: dentro ? malla.lonC[c] : p.lon, i: dentro ? r * N + c : -1 };
    });
  }
  const rand = aleatorio(`${ej.c}|cob|${normalizarId(id)}`);
  const dMin = Math.max(0.5, 0.1 * params.radioKm), dMax = 0.95 * params.radioKm;
  const sin = [], con = BANDAS.map(() => []);
  for (let i = 0; i < N * N; i++) {
    if (res.estado[i] !== PIXEL.OK || res.cop[i]) continue;
    const dk = res.dKm[i];
    if (dk < dMin || dk > dMax) continue;
    const m = res.margen[i];
    if (LIMITES_BANDA.some((l) => Math.abs(m - l) < 1)) continue;
    const b = bandaDe(m);
    (b < 0 ? sin : con[b]).push(i);
  }
  const mezclar = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  mezclar(sin); con.forEach(mezclar);
  const nCon0 = Math.ceil(ej.n / 2);
  const hayCon = con.reduce((s, x) => s + x.length, 0);
  let nSin = Math.min(sin.length, ej.n - Math.min(nCon0, hayCon));
  let nCon = Math.min(hayCon, ej.n - nSin);
  const centro = (i) => ({ lat: malla.latC[Math.floor(i / N)], lon: malla.lonC[i % N] });
  const elegidos = [];
  const lejos = (i, sep) => elegidos.every((j) => R.distanciaKm(centro(i), centro(j)) >= sep);
  for (const sep of [0.15 * params.radioKm, 0.075 * params.radioKm, 0]) {
    elegidos.length = 0;
    const cola = [...sin];
    for (const i of cola) { if (elegidos.length >= nSin) break; if (lejos(i, sep)) elegidos.push(i); }
    const colas = con.map((x) => [...x]);
    let hechos = 0;
    for (let vuelta = 0; hechos < nCon && vuelta < 100000; vuelta++) {
      const q = colas[vuelta % colas.length];
      while (q.length) { const i = q.shift(); if (lejos(i, sep)) { elegidos.push(i); hechos++; break; } }
      if (colas.every((x) => !x.length)) break;
    }
    if (elegidos.length >= nSin + nCon) break;
  }
  return mezclar(elegidos).map((i, k) => ({ k, r: Math.floor(i / N), c: i % N, i, lat: centro(i).lat, lon: centro(i).lon }));
}

// Solución de un punto: banda (−1 sin señal) o null si no hay cálculo
export function solucionPunto(res, p) {
  if (p.i < 0 || res.estado[p.i] !== PIXEL.OK) return null;
  return { banda: bandaDe(res.margen[p.i]), margen: res.margen[p.i], prx: res.prx[p.i] };
}

export function corregirPunto(resp, sol) {
  if (!sol) return { cuenta: false };
  const v = resp === '' || resp == null ? null : Number(resp);
  if (v == null || !Number.isFinite(v)) return { cuenta: true, vacia: true, llega: false, banda: false };
  return { cuenta: true, vacia: false, llega: (v >= 0) === (sol.banda >= 0), banda: v === sol.banda };
}

export function filasSolucionarioCob(res, malla, params, ej, ids) {
  const cab = ['identificador', 'identificador normalizado', 'punto', 'latitud (°)', 'longitud (°)', 'distancia a A (km)', 'respuesta correcta', 'margen (dB)', 'nivel recibido (dBm)'];
  cab.numericas = [];
  const filas = [cab];
  const lista = ej.fijos ? ['(todos)'] : ids;
  for (const id of lista) {
    for (const p of elegirPuntos(res, malla, params, ej, id)) {
      const s = solucionPunto(res, p);
      const r = [id, ej.fijos ? '' : normalizarId(id), `P${p.k + 1}`, num(p.lat, 6), num(p.lon, 6), num(R.distanciaKm(params.a, p), 3),
        s ? OPCIONES_COB.find((o) => o.v === s.banda).texto : 'sin cálculo (no cuenta)', s ? num(s.margen, 2) : '', s ? num(s.prx, 2) : ''];
      r.numericas = [3, 4, 5, 7, 8];
      filas.push(r);
    }
  }
  return filas;
}
