/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// ejercicios.js — Ejercicios aleatorios con comprobación (versiones 1.4 y 1.5)
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
import { perdidasLinea, coaxial, rectangular, C0 } from './lineas.js';
import { ke999, alturasMinimasP530 } from './p530.js';
import { calcularDisponibilidad, datosClima } from './disponibilidad.js';
import { coeficientesLluvia } from './p838.js';
import { CLASES, valoresETSI } from './etsi.js';
import { calcularCapacidad, normalizarCapacidad, velocidadBinaria } from './capacidad.js';

// Emplazamiento de referencia de los ejercicios teóricos (como el ejemplo teórico)
export const A_EJ = { lat: 39.96, lon: -4.832 };

export const NIVELES = {
  1: { titulo: 'Nivel 1 · Presupuesto del enlace', corto: 'presupuesto', texto: 'Pérdidas en espacio libre, potencia recibida y margen (terreno plano).' },
  2: { titulo: 'Nivel 2 · Fresnel y curvatura', corto: 'Fresnel y curvatura', texto: 'Además: r₁ en el punto medio y en el obstáculo, y la flecha de la Tierra en el obstáculo.' },
  3: { titulo: 'Nivel 3 · Obstáculo y difracción', corto: 'difracción', texto: 'Además: altura del obstáculo sobre la línea de visión, ν, J(ν) y margen con difracción (UIT-R P.526).' },
  4: { titulo: 'Nivel 4 · Altura mínima de antena', corto: 'altura mínima', texto: 'Además: altura mínima de la antena B (con A fija) para despejar el 60 % de r₁.' },
  // Versión 1.5: niveles independientes (no acumulan las preguntas de los anteriores)
  5: { titulo: 'Nivel 5 · Línea coaxial', corto: 'línea coaxial', texto: 'Atenuación del cable coaxial (fórmula del fabricante) y de los conectores de cada lado, y presupuesto del enlace con esas pérdidas.' },
  6: { titulo: 'Nivel 6 · Coaxial frente a guía de onda', corto: 'coaxial o guía', texto: 'Bajada larga en A: frecuencia de corte y atenuación del modo TE10 de una guía WR frente a un coaxial, y margen con la guía.' },
  7: { titulo: 'Nivel 7 · Despeje según la UIT-R P.530', corto: 'despeje P.530', texto: 'kₑ del 99,9 %, flechas con k = 4/3 y con kₑ, y altura mínima de B con el criterio completo de la P.530-19 (§ 2.2.2.1).' },
  8: { titulo: 'Nivel 8 · Disponibilidad (UIT-R P.530)', corto: 'disponibilidad', texto: 'Desvanecimiento por multitrayecto (peor mes y año, P.841) y por lluvia (P.838 y P.530), indisponibilidad y tiempo fuera de servicio.' },
  9: { titulo: 'Nivel 9 · Capacidad y modulación adaptativa', corto: 'capacidad', texto: 'Velocidad binaria de tres modulaciones, su margen y su indisponibilidad (P.530), capacidad garantizada y capacidad media.' },
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
  // ---- Versión 1.5 ----
  { clave: 'alfaA', nivel: 5, texto: 'Atenuación del cable de A (dB/100 m)', unidad: 'dB/100 m', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'LA', nivel: 5, texto: 'Pérdidas totales del lado A (cable y conectores)', unidad: 'dB', dec: 2, abs: 0.1 },
  { clave: 'LB', nivel: 5, texto: 'Pérdidas totales del lado B (cable y conectores)', unidad: 'dB', dec: 2, abs: 0.1 },
  { clave: 'perdida', nivel: 5, texto: 'Pérdidas en espacio libre (L)', unidad: 'dB', dec: 2, abs: 0.2 },
  { clave: 'prx', nivel: 5, texto: 'Potencia recibida (Prx)', unidad: 'dBm', dec: 2, abs: 0.3 },
  { clave: 'margen', nivel: 5, texto: 'Margen sobre la sensibilidad (M)', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'fc', nivel: 6, texto: 'Frecuencia de corte del modo TE10 de la guía', unidad: 'GHz', dec: 3, rel: 0.005, abs: 0.01 },
  { clave: 'alfaCoax', nivel: 6, texto: 'Atenuación del coaxial (dB/100 m)', unidad: 'dB/100 m', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'alfaGuia', nivel: 6, texto: 'Atenuación de la guía, modo TE10 (dB/100 m)', unidad: 'dB/100 m', dec: 2, rel: 0.02, abs: 0.05 },
  { clave: 'LAcoax', nivel: 6, texto: 'Pérdidas del lado A con el coaxial (cable y 2 conectores)', unidad: 'dB', dec: 2, rel: 0.01, abs: 0.1 },
  { clave: 'LAguia', nivel: 6, texto: 'Pérdidas del lado A con la guía (guía y 2 transiciones)', unidad: 'dB', dec: 2, rel: 0.02, abs: 0.1 },
  { clave: 'margen', nivel: 6, texto: 'Margen sobre la sensibilidad con la guía (M)', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'ke', nivel: 7, texto: 'Factor kₑ superado el 99,9 % del tiempo (ec. 4)', unidad: '', dec: 4, abs: 0.002 },
  { clave: 'r1Obs', nivel: 7, texto: 'Radio r₁ en el obstáculo', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'flecha43', nivel: 7, texto: 'Flecha en el obstáculo con k = 4/3', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'flechaKe', nivel: 7, texto: 'Flecha en el obstáculo con kₑ', unidad: 'm', dec: 2, rel: 0.01, abs: 0.05 },
  { clave: 'hB1', nivel: 7, texto: 'Altura de B del paso 1 (1,0·r₁ con k = 4/3)', unidad: 'm', dec: 2, rel: 0.01, abs: 0.1 },
  { clave: 'hB3', nivel: 7, texto: 'Altura de B del paso 3 (0,0·r₁ con kₑ)', unidad: 'm', dec: 2, rel: 0.01, abs: 0.1 },
  { clave: 'hBmin', nivel: 7, texto: 'Altura mínima de B según la P.530 (la mayor)', unidad: 'm', dec: 2, rel: 0.01, abs: 0.1 },
  { clave: 'margen', nivel: 8, texto: 'Margen frente a desvanecimientos F (espacio libre)', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'hc', nivel: 8, texto: 'Despeje medio del trayecto hc (ec. 6)', unidad: 'm', dec: 2, abs: 0.5 },
  { clave: 'pw', nivel: 8, texto: 'Multitrayecto: % del peor mes en que se supera F (ec. 7)', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'pMp', nivel: 8, texto: 'Multitrayecto: % del año (P.841-7)', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'gammaR', nivel: 8, texto: 'Atenuación específica por lluvia γR', unidad: 'dB/km', dec: 4, rel: 0.02 },
  { clave: 'A001', nivel: 8, texto: 'Atenuación por lluvia superada el 0,01 % (A0,01)', unidad: 'dB', dec: 2, rel: 0.02 },
  { clave: 'pLluvia', nivel: 8, texto: 'Lluvia: % del año en que se supera F (ec. 34)', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'U', nivel: 8, texto: 'Indisponibilidad total del año', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'minAno', nivel: 8, texto: 'Tiempo fuera de servicio', unidad: 'min/año', dec: 1, rel: 0.05 },
  { clave: 'rb1', nivel: 9, texto: 'Velocidad binaria con la modulación 1', unidad: 'Mbit/s', dec: 2, rel: 0.005, abs: 0.1 },
  { clave: 'rb2', nivel: 9, texto: 'Velocidad binaria con la modulación 2', unidad: 'Mbit/s', dec: 2, rel: 0.005, abs: 0.1 },
  { clave: 'rb3', nivel: 9, texto: 'Velocidad binaria con la modulación 3', unidad: 'Mbit/s', dec: 2, rel: 0.005, abs: 0.1 },
  { clave: 'm1', nivel: 9, texto: 'Margen con el umbral de la modulación 1', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'm2', nivel: 9, texto: 'Margen con el umbral de la modulación 2', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'm3', nivel: 9, texto: 'Margen con el umbral de la modulación 3', unidad: 'dB', dec: 2, abs: 0.3 },
  { clave: 'u1', nivel: 9, texto: 'Indisponibilidad anual con la modulación 1', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'u2', nivel: 9, texto: 'Indisponibilidad anual con la modulación 2', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'u3', nivel: 9, texto: 'Indisponibilidad anual con la modulación 3', unidad: '%', dec: 4, sig: 4, rel: 0.05 },
  { clave: 'garantizada', nivel: 9, texto: 'Capacidad garantizada para el objetivo de disponibilidad', unidad: 'Mbit/s', dec: 2, rel: 0.005, abs: 0.1 },
  { clave: 'media', nivel: 9, texto: 'Capacidad media del año', unidad: 'Mbit/s', dec: 2, rel: 0.005, abs: 0.1 },
];
// Niveles 1–4: acumulativos (como en la 1.4). Niveles 5–9: solo sus preguntas.
export const preguntasDe = (nivel) => (nivel <= 4 ? PREGUNTAS.filter((p) => p.nivel <= nivel) : PREGUNTAS.filter((p) => p.nivel === nivel));
// Decimales con que se muestra un valor: los porcentajes pequeños, con 4 cifras significativas
export const decimales = (p, v) => (p.sig && Number.isFinite(v) && v !== 0 ? Math.max(p.dec ?? 0, p.sig - 1 - Math.floor(Math.log10(Math.abs(v)))) : p.dec);
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
  const n = [1, 2, 3, 4, 5, 6, 7, 8, 9].includes(+x.n) ? +x.n : 1;
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
  if (nivel >= 5) return generarDatos15(nivel, rand);   // versión 1.5 (los niveles 1–4 no cambian)
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
  if (datos.nivel >= 5) return datosAEstado15(datos);
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
  if (datos.nivel >= 5) return estadoCoincide15(estado, datos);
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
  if (nivel >= 5) return partesEnunciado15(datos, nivel);
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
  if (cfg.n >= 5) return filasSolucionario15(cfg, ids);
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

// =====================================================================
// Versión 1.5: niveles 5 a 9
// Cada nivel tiene su propia rama de generación (los niveles 1–4 no cambian ni
// consumen números distintos del generador). Las soluciones salen del estado que
// se carga en la app y de las MISMAS funciones que usa la app: lineas.js
// (catálogo de Times Microwave y modo TE10 de Pozar), p530.js, disponibilidad.js
// (P.530-19, P.838-3, P.841-7), etsi.js (EN 302 217-2) y capacidad.js.
// =====================================================================
const LMR_EJ = ['LMR-195', 'LMR-240', 'LMR-400', 'LMR-600', 'LMR-900', 'LMR-1200'];
const GUIA_EJ = { 5.8: 'WR-159', 7: 'WR-137' };
// Modulaciones del nivel 9: tres clases crecientes del cuadro 0 de la EN 302 217-2 y separaciones
// de canal del plan de cada banda (en 18 GHz, 13,75/27,5/55 MHz: cuadro E.5b)
const CLASES_EJ = ['2', '3', '4L', '4H', '5L', '5H', '6L', '6H', '7', '8'];
const CS_EJ = (fGHz) => (fGHz === 18 ? [7, 13.75, 27.5, 55] : [7, 14, 28, 56]);
const P841_LIM = (2.85 / 12) ** (1 / 0.13);   // % por debajo del cual Q = 12 (P.841-7, ec. 4)

const tramoCoaxial = (modelo, longitud) => [{ tipo: 'coaxial', modelo, longitud }, { tipo: 'accesorio', id: 'conector', n: 2, valor: null }];
const tramoGuia = (modelo, longitud) => [{ tipo: 'rectangular', modelo, material: 'cobre', longitud }, { tipo: 'accesorio', id: 'transicion', n: 2, valor: null }];
const lineaCalc = (elementos) => ({ modo: 'calculada', elementos });

function datosAEstado15(datos) {
  const { a, b } = montarEnlace(datos);
  const fMHz = R.aMHz(datos.f.v, datos.f.u);
  const lado = (s, nombre, pos) => {
    const x = datos[s];
    const ln = x.cable ? lineaCalc(tramoCoaxial(x.cable, x.long)) : x.guia ? lineaCalc(tramoGuia(x.guia, x.long)) : null;
    const l = ln ? perdidasLinea(ln, fMHz).total : x.l;
    return { nombre, lat: pos.lat, lon: pos.lon, h: x.h, g: x.g, l, linea: ln || { modo: 'manual', elementos: [] } };
  };
  const e = {
    terreno: datos.obst ? 'obstaculo' : 'plano',
    obstaculo: datos.obst ? { ...datos.obst } : undefined,
    a: lado('a', 'Extremo A', a), b: lado('b', 'Extremo B', b),
    f: { ...datos.f }, p: { ...datos.p }, sens: datos.sens, k: datos.k, modelo: 'espacio-libre',
    gases: false,
  };
  if (datos.nivel === 7) e.altcrit = { criterio: 'p530', obstaculo: 'aislado', clima: 'templado' };
  if (datos.clima) {
    e.disp = { nieve: false, propios: { ...datos.clima } };
    e.itm = { pol: datos.pol };
  }
  if (datos.cap) e.cap = { cs: datos.cap.cs, alfa: datos.cap.alfa, r: datos.cap.r, objetivo: datos.cap.objetivo, sel: [...datos.cap.mods], umbrales: {} };
  return e;
}

function estadoCoincide15(estado, datos) {
  const e = datosAEstado15(datos);
  const igual = (x, y) => Math.abs(Number(x) - Number(y)) < 1e-9;
  const mismaLinea = (x, y) => JSON.stringify(x?.modo === 'calculada' ? x.elementos : []) === JSON.stringify(y.modo === 'calculada' ? y.elementos : []) &&
    (x?.modo === 'calculada') === (y.modo === 'calculada');
  let ok = estado.terreno === e.terreno && estado.modelo === 'espacio-libre' && String(estado.k) === String(e.k) && !estado.gases &&
    igual(estado.a.lat, e.a.lat) && igual(estado.a.lon, e.a.lon) && igual(estado.b.lat, e.b.lat) && igual(estado.b.lon, e.b.lon) &&
    ['h', 'g'].every((c) => igual(estado.a[c], e.a[c]) && igual(estado.b[c], e.b[c])) &&
    ['a', 'b'].every((s) => mismaLinea(estado[s].linea, e[s].linea) && (e[s].linea.modo === 'calculada' || igual(estado[s].l, e[s].l))) &&
    igual(estado.f.v, e.f.v) && estado.f.u === e.f.u && igual(estado.p.v, e.p.v) && estado.p.u === e.p.u && igual(estado.sens, e.sens) &&
    (!e.obstaculo || (igual(estado.obstaculo?.d, e.obstaculo.d) && igual(estado.obstaculo?.z, e.obstaculo.z)));
  if (ok && e.altcrit) ok = estado.altcrit?.criterio === 'p530' && estado.altcrit.obstaculo === 'aislado' && estado.altcrit.clima === 'templado';
  if (ok && e.disp) {
    ok = estado.disp?.nieve === false && estado.itm?.pol === e.itm.pol &&
      Object.keys(e.disp.propios).every((k) => igual(estado.disp.propios?.[k], e.disp.propios[k]));
  }
  if (ok && e.cap) {
    const c = estado.cap || {};
    ok = igual(c.cs, e.cap.cs) && igual(c.alfa, e.cap.alfa) && igual(c.r, e.cap.r) && igual(c.objetivo, e.cap.objetivo) &&
      [...(c.sel || [])].sort().join() === [...e.cap.sel].sort().join() && e.cap.sel.every((k) => c.umbrales?.[k] == null);
  }
  return ok;
}

// Soluciones de los niveles 5 a 9 (mismo camino que app.js: aplicarLineas, presupuesto en espacio libre,
// analizarPerfil, alturasMinimasP530, entradaDisponibilidad + calcularDisponibilidad y calcularCapacidad)
export function resolver15(datos) {
  const est = datosAEstado15(datos);
  const fMHz = R.aMHz(est.f.v, est.f.u), fGHz = fMHz / 1000, ptxDbm = R.potenciaDbm(est.p.v, est.p.u), k = R.leerK(est.k);
  const lin = (s) => (est[s].linea.modo === 'calculada' ? perdidasLinea(est[s].linea, fMHz) : null);
  const la = lin('a'), lb = lin('b');
  const dKm = R.distanciaKm(est.a, est.b);
  const perdida = R.perdidasEspacioLibre(dKm, fMHz);
  const pres = R.presupuesto({ ptxDbm, gtx: est.a.g, grx: est.b.g, ltx: est.a.l, lrx: est.b.l, perdidaTrayecto: perdida, sensibilidad: est.sens });
  const base = puntosPerfil(est.a, est.b, est.terreno, est.obstaculo);
  const analizar = (kk) => R.analizarPerfil({ perfil: base.puntos, hA: est.a.h, hB: est.b.h, fMHz, k: kk });
  const an = analizar(k);
  const dif = R.difraccionObstaculoPrincipal(an, fMHz);
  const sol = { perdida, prx: pres.prx, margen: pres.margen, ptxDbm, dKm, estado: an.estado, an, dif, J: dif?.J ?? 0 };

  if (datos.nivel === 5) Object.assign(sol, { alfaA: la.elementos[0].dB100m, LA: la.total, LB: lb.total });
  if (datos.nivel === 6) {
    const coax = perdidasLinea(lineaCalc(tramoCoaxial(datos.coax, datos.a.long)), fMHz);
    Object.assign(sol, {
      fc: la.elementos[0].fc, alfaGuia: la.elementos[0].dB100m, LAguia: la.total,
      alfaCoax: coax.elementos[0].dB100m, LAcoax: coax.total, ahorro: coax.total - la.total,
      margenCoax: pres.margen - (coax.total - la.total),
    });
  }
  const iObs = base.puntos.findIndex((p) => p.origen === 'obstaculo');
  if (datos.nivel === 7 && iObs >= 0) {
    const ke = ke999(dKm);
    const an43 = analizar(4 / 3), anKe = analizar(ke);
    const m1 = R.alturasMinimas(an43, 1.0), m3 = R.alturasMinimas(anKe, 0);
    const p530 = alturasMinimasP530({ dKm, clima: 'templado', obstaculo: 'aislado', analizar, minimas: R.alturasMinimas });
    Object.assign(sol, {
      ke, r1Obs: an43.puntos[iObs].r1, flecha43: an43.puntos[iObs].flecha, flechaKe: anKe.puntos[iObs].flecha,
      hB1: m1.b.h, hB3: m3.b.h, hBmin: p530.b.h, pasoLimita: p530.b.paso,
      limitaObstaculo: m1.b.punto === an43.puntos[iObs] && m3.b.punto === anKe.puntos[iObs],
    });
  }
  if (datos.nivel >= 8) {
    const F = pres.margen - sol.J;
    const ptos = base.puntos.filter((p) => p.z != null);
    const ht = ptos.reduce((s, p) => s + p.z, 0) / ptos.length;
    const clima = datosClima(null, puntoMedio15(est.a, est.b), 0, est.disp.propios);
    const ent = { dKm, fGHz, pol: est.itm.pol, yA: an.yA, yB: an.yB, ht, F, clima, nieve: false };
    const d = calcularDisponibilidad(ent);
    Object.assign(sol, {
      F, ent, disp: d,
      margen: F, hc: d.mp.hc, ep: d.mp.ep, pw: d.mp.pwMes, pMp: d.mp.pAnual, gammaR: d.ll.gammaR, A001: d.ll.A001,
      pLluvia: d.ll.p, U: d.indisp, minAno: d.minAno, k838: d.ll.k, alfa838: d.ll.alfa,
    });
    if (datos.nivel === 9) {
      const cap = normalizarCapacidad(est.cap);
      const c = calcularCapacidad({ fGHz, cap, F, sens: est.sens, dispCon: (FF) => calcularDisponibilidad({ ...ent, F: FF }) });
      sol.capacidad = c;
      c.usadas.forEach((x, i) => { sol[`rb${i + 1}`] = x.Rb; sol[`m${i + 1}`] = x.margen; sol[`u${i + 1}`] = x.indisp; });
      sol.garantizada = c.garantizada ? c.garantizada.Rb : 0;
      sol.media = c.media;
      sol.dispMods = c.usadas.map((x) => calcularDisponibilidad({ ...ent, F: x.margen }));
    }
  }
  return sol;
}
// Punto medio (el mismo de disponibilidad.js; se repite aquí para no depender de la interfaz)
import { puntoMedio as puntoMedio15 } from './disponibilidad.js';

// Comprobaciones de que el ejercicio cae en la zona de validez de las fórmulas del enunciado
function dispValida(d) {
  return d && !d.error && d.mp.aplica && d.mp.profundo && !d.avisos.length && !d.ll.fuera &&
    d.mp.pAnual > P841_LIM * 1.01 && d.mp.pAnual < 3 && d.ll.p >= 0.001 && d.ll.p <= 1;
}

function generarDatos15(nivel, rand) {
  const ent = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const elegir = (arr) => arr[Math.floor(rand() * arr.length)];
  const paso = (a, b, s) => +(a + s * ent(0, Math.round((b - a) / s))).toFixed(6);
  const unif = (a, b) => a + (b - a) * rand();
  const bandas = { 5: [2.4, 5.8], 6: [5.8, 7], 7: BANDAS_EJ.map((b) => b.f), 8: [11, 13, 18, 23], 9: [11, 13, 18, 23] }[nivel];
  for (let intento = 0; intento < 5000; intento++) {
    const fb = elegir(bandas), banda = BANDAS_EJ.find((b) => b.f === fb);
    const dmin = nivel >= 8 ? Math.max(7.5, banda.d[0]) : banda.d[0], dmax = nivel >= 8 ? Math.min(30, banda.d[1]) : banda.d[1];
    if (dmin > dmax) continue;
    const d = paso(dmin, dmax, 0.1);
    const hMin = nivel >= 8 ? 20 : 10, hMax = nivel >= 8 ? 80 : 60;
    const datos = {
      nivel,
      f: { v: banda.f, u: 'GHz' },
      p: rand() < 0.5 ? { v: elegir(POTENCIAS_W), u: 'W' } : { v: ent(10, 30), u: 'dBm' },
      d,
      a: { h: paso(hMin, hMax, 5), g: paso(banda.g[0], banda.g[1], 0.5), l: paso(0.5, 3, 0.5) },
      b: { h: paso(hMin, hMax, 5), g: paso(banda.g[0], banda.g[1], 0.5), l: paso(0.5, 3, 0.5) },
      sens: 0, k: '4/3', obst: null,
    };
    const fMHz = banda.f * 1000;
    if (nivel === 5) {
      const cables = LMR_EJ.filter((m) => coaxial(m).banda[1] >= fMHz);
      for (const s of ['a', 'b']) { delete datos[s].l; datos[s].cable = elegir(cables); datos[s].long = ent(5, 40); }
    }
    if (nivel === 6) {
      delete datos.a.l;
      datos.a.guia = GUIA_EJ[banda.f]; datos.a.long = ent(20, 80);
      datos.coax = elegir(['LMR-400', 'LMR-600']);
    }
    if (nivel >= 8) {
      datos.pol = elegir(['V', 'H']);
      datos.logK = paso(-5, -3.8, 0.05);
      datos.clima = {
        K: 10 ** datos.logK, dN75: ent(20, 60), R001: ent(20, 60),
        P0: paso(2, 8, 0.01), h0: paso(2.5, 3.5, 0.001),
      };
    }
    if (nivel === 9) {
      const i1 = ent(0, 5), i2 = i1 + ent(1, 2), i3 = i2 + ent(1, 2);
      const mods = [i1, i2, i3].map((i) => CLASES_EJ[i]);
      // Solo separaciones de canal que estén en el cuadro para las tres clases (umbral no derivado)
      const validos = CS_EJ(banda.f).filter((c) => mods.every((m) => valoresETSI(banda.f, m, c)?.derivado === false));
      if (!validos.length) continue;
      const cs = elegir(validos);
      const umb = mods.map((m) => valoresETSI(banda.f, m, cs));
      datos.cap = { cs, alfa: elegir([0.2, 0.25, 0.3, 0.35]), r: elegir([0.8, 0.85, 0.9, 0.95]), objetivo: elegir([99.99, 99.995, 99.999]), mods, umbrales: umb.map((u) => u.rsl), tablas: umb.map((u) => u.tabla) };
    }

    // Sensibilidad: margen en espacio libre entre −5 y 45 dB (niveles 5–7) o entre 15 y 50 dB (nivel 8).
    // Nivel 9: la sensibilidad es el umbral de la modulación 1 (se ajusta después la potencia).
    if (nivel === 9) datos.sens = datos.cap.umbrales[0];
    else {
      const s0 = resolver15({ ...datos, sens: 0 });
      datos.sens = Math.round(s0.prx - (nivel === 8 ? unif(15, 50) : unif(-5, 45)));
      if (datos.sens < -95 || datos.sens > -55) continue;
    }

    if (nivel !== 7) {
      // Terreno plano y antenas que despejan el 60 % de r₁ (J = 0)
      let s = resolver15(datos);
      if (s.estado !== 'despejado') {
        const h = Math.ceil((s.an && R.alturasMinimas(s.an).igual.h + 1) / 5) * 5;
        if (!(h <= 100)) continue;
        datos.a.h = datos.b.h = h;
        s = resolver15(datos);
        if (s.estado !== 'despejado') continue;
      }
      if (s.J !== 0) continue;
      if (nivel === 9) {
        // Potencia (dBm entera) para que la modulación más alta quede en la zona de desvanecimiento
        // profundo de la ec. (7) (margen ≥ At, ec. 12) con una holgura aleatoria
        const At = s.disp?.mp?.At;
        if (!Number.isFinite(At)) continue;
        const ptx = Math.round(unif(At + 0.5, At + 15) + (datos.cap.umbrales[2] - datos.cap.umbrales[0]) - s.margen + s.ptxDbm);
        if (ptx < 0 || ptx > 33) continue;
        datos.p = { v: ptx, u: 'dBm' };
        s = resolver15(datos);
      }
      if (nivel === 5 && !(s.LA > 0 && s.LB > 0)) continue;
      if (nivel === 6 && !(s.ahorro > 0.5 && s.margen > -10 && s.margen < 45)) continue;
      if (nivel === 8 && !dispValida(s.disp)) continue;
      if (nivel === 9) {
        if (!s.dispMods || !s.dispMods.every(dispValida)) continue;
        const Uobj = 100 - datos.cap.objetivo;
        if (!(s.u1 <= Uobj && s.u3 > Uobj)) continue;
        if ([s.u1, s.u2, s.u3].some((u) => Math.abs(u - Uobj) / Uobj < 0.15)) continue;
      }
      return { datos, sol: s };
    }

    // Nivel 7: obstáculo agudo que limita la altura de B en los dos pasos del criterio
    const d1 = paso(Math.ceil(Math.max(0.5, 0.2 * d) * 10) / 10, Math.floor(Math.min(d - 0.5, 0.8 * d) * 10) / 10, 0.1);
    if (!(d1 > 0 && d1 < d)) continue;
    const d1m = d1 * 1000, d2m = (d - d1) * 1000;
    const flecha = R.flechaTierra(d1m, d2m, 4 / 3), r1 = R.radioFresnel(d1m, d2m, fMHz);
    const los = datos.a.h + ((datos.b.h - datos.a.h) * d1) / d;
    const z = Math.round(los - flecha - unif(-0.6, 1.2) * r1);
    if (z < 1) continue;
    datos.obst = { d: d1, z };
    const s = resolver15(datos);
    if (!s.limitaObstaculo || !(s.hB1 >= 1 && s.hB3 >= 1 && s.hBmin <= 200) || Math.abs(s.hB1 - s.hB3) < 0.5 || s.flecha43 < 0.1) continue;
    return { datos, sol: s };
  }
  throw new Error('No se pudo generar el ejercicio');
}

// ---------- Enunciados de los niveles 5 a 9 ----------
const POL_TXT = { V: 'vertical', H: 'horizontal' };
const nomMod = (clase) => CLASES.find((c) => c.clase === clase)?.nombre || clase;
function partesEnunciado15(datos, nivel) {
  const p = datos.p.u === 'W' ? `${n(datos.p.v)} W` : `${n(datos.p.v)} dBm`;
  const ant = (x) => `antena de ${n(x.g, 1)} dBi a ${n(x.h, 0)} m sobre el suelo`;
  const cab = (s) => coaxial(s);
  const fCoax = (ids) => `Atenuación del cable según el fabricante (Times Microwave): α (dB/100 ft) = k₁·√f + k₂·f, con f en MHz; ` +
    [...new Set(ids)].map((id) => `${id}: k₁ = ${n(cab(id).k1, 8)} y k₂ = ${n(cab(id).k2, 8)}`).join('; ') + '. 1 ft = 0,3048 m.';
  const conector = 'Pérdida de cada conector coaxial: 0,05·√f dB, con f en GHz.';
  const enlace = `Radioenlace de ${n(datos.f.v)} GHz entre A y B, separados ${n(datos.d, 1)} km, sobre terreno plano (cota 0 m)` +
    (datos.obst ? ` con un obstáculo agudo («filo de cuchillo») de ${n(datos.obst.z, 0)} m de cota a ${n(datos.obst.d, 1)} km de A` : '') +
    (datos.pol ? `, con polarización ${POL_TXT[datos.pol]}.` : '.');
  const cte = 'Toma c = 299 792 458 m/s (con 3·10⁸ m/s el resultado también se acepta).';
  const partes = [enlace];

  if (nivel === 5) {
    partes.push(
      `Lado A (transmisor): potencia de ${p}, ${ant(datos.a)} y bajada de ${n(datos.a.long, 0)} m de cable coaxial ${datos.a.cable} con un conector en cada extremo.`,
      `Lado B (receptor): ${ant(datos.b)}, bajada de ${n(datos.b.long, 0)} m de cable coaxial ${datos.b.cable} con un conector en cada extremo y sensibilidad de ${n(datos.sens, 0)} dBm.`,
      fCoax([datos.a.cable, datos.b.cable]), conector,
      'El trayecto está despejado (k = 4/3; la línea de visión libra el 60 % de r₁): solo hay pérdidas en espacio libre.', cte);
  } else if (nivel === 6) {
    const g = rectangular(datos.a.guia), mm = (x) => n(x * 25.4, 2);
    partes.push(
      `Lado A (transmisor): potencia de ${p}, ${ant(datos.a)} y bajada de ${n(datos.a.long, 0)} m entre el equipo y la antena. ` +
        `Se comparan dos soluciones: guía de onda rectangular ${g.id} de cobre con una transición guía–coaxial en cada extremo (la que se instala) o cable coaxial ${datos.coax} con un conector en cada extremo.`,
      `Lado B (receptor): ${ant(datos.b)}, ${n(datos.b.l)} dB de pérdidas en cables y conectores y sensibilidad de ${n(datos.sens, 0)} dBm.`,
      `Guía ${g.id} (EIA RS-261): a = ${n(g.a, 3)}″ (${mm(g.a)} mm) y b = ${n(g.b, 3)}″ (${mm(g.b)} mm). Cobre: σ = 1/(1,7241·10⁻⁸ Ω·m) ≈ 5,800·10⁷ S/m; μ₀ = 4π·10⁻⁷ H/m; η = 376,73 Ω.`,
      'Modo TE10 (D. M. Pozar, Microwave Engineering, ec. 3.96): fc = c/(2a); k = 2πf/c; β = √(k² − (π/a)²); Rs = √(2πf·μ₀/(2σ)); αc = Rs·(2bπ² + a³k²)/(a³·b·β·k·η) Np/m; 1 Np = 8,686 dB. Pérdida de cada transición guía–coaxial: 0,25 dB.',
      fCoax([datos.coax]), conector,
      'El trayecto está despejado (k = 4/3; la línea de visión libra el 60 % de r₁): solo hay pérdidas en espacio libre.', cte);
  } else {
    const sensTxt = nivel === 9 ? `sensibilidad de ${n(datos.sens, 0)} dBm (umbral de la modulación 1)` : `sensibilidad de ${n(datos.sens, 0)} dBm`;
    partes.push(
      `Lado A (transmisor): potencia de ${p}, ${n(datos.a.l)} dB de pérdidas en cables y conectores y ${ant(datos.a)}.`,
      `Lado B (receptor): ${ant(datos.b)}, ${n(datos.b.l)} dB de pérdidas y ${sensTxt}.`);
    if (nivel === 7) {
      partes.push(
        'Radio terrestre R = 6371 km; flecha = d₁·d₂/(2·k·R).',
        'Criterio de despeje de la UIT-R P.530-19 (§ 2.2.2.1) para clima templado y obstáculo aislado: paso 1, despejar 1,0·r₁ con k = 4/3; ' +
          'paso 3, despejar 0,0·r₁ (rozando) con kₑ, el valor de k superado el 99,9 % del tiempo: kₑ = 157/(144 + 2670/d), con d en km (ec. 4). ' +
          'La altura mínima de B (con A a la altura del enunciado) es la mayor de las dos.', cte);
    } else {
      const s = resolver15(datos), c = datos.clima;
      partes.push(
        `Clima del punto medio (valores locales): factor geoclimático K = 10^(${n(datos.logK, 2)}), dN₇₅ = ${n(c.dN75, 0)} N e intensidad de lluvia R₀,₀₁ = ${n(c.R001, 0)} mm/h. ` +
          `(P₀ = ${n(c.P0, 2)} % e isoterma de 0 °C h₀ = ${n(c.h0, 3)} km solo intervienen en el método de lluvia y nieve húmeda del § 2.4.2, que no se aplica en este ejercicio.)`,
        `Coeficientes de la UIT-R P.838-3 para ${n(datos.f.v)} GHz y polarización ${POL_TXT[datos.pol]}: k = ${n(s.k838, 5)} y α = ${n(s.alfa838, 4)}.`,
        `${nivel === 9 ? 'Margen de cada modulación: Fᵢ = Prx − umbralᵢ' : 'Margen F = Prx − sensibilidad'}, con pérdidas en espacio libre (el trayecto está despejado con k = 4/3: J = 0).`,
        'Multitrayecto (UIT-R P.530-19, § 2.3.1, con he y hr las cotas de las antenas y ht = 0): εp = |hr − he|/d (mrad); hc = (hr + he)/2 − d²/102 − ht (m); hL = mín(he, hr); ' +
          'vsr = mín[(dN₇₅/50)^1,8·e^(−hc/(2,5·√d)); dN₇₅·d^1,5·f^0,5/24730]; ' +
          'pw = K·d^3,51·(f² + 13)^0,447·10^(−0,376·tanh((hc − 147)/125) − 0,334·εp^0,39 − 0,00027·hL + 17,85·vsr − F/10) % del peor mes (ec. 7; F supera At = 25 + 1,2·log p₀, ec. 12, donde p₀ es pw con F = 0).',
        'Paso al año medio (P.530-19, ec. 24, con la P.841-7, ec. 4: Q₁ = 2,85 y β = 0,13): p = pw/Q con Q = 2,85·p^(−0,13), es decir, p = (pw/2,85)^(1/0,87) %.',
        'Lluvia (P.530-19, § 2.4.1): γR = k·R₀,₀₁^α; r = 1/(0,477·d^0,633·R₀,₀₁^(0,073·α)·f^0,123 − 10,579·(1 − e^(−0,024·d))); A₀,₀₁ = γR·d·r; ' +
          'Ap = A₀,₀₁·C₁·p^(−(C₂ + C₃·log p)), con C₀ = 0,12 + 0,4·[log(f/10)]^0,8 (f ≥ 10 GHz), C₁ = 0,07^C₀·0,12^(1 − C₀), C₂ = 0,855·C₀ + 0,546·(1 − C₀) y C₃ = 0,139·C₀ + 0,043·(1 − C₀). ' +
          'El porcentaje de lluvia es el p para el que Ap = F (raíz de una ecuación de 2.º grado en log p).',
        'Indisponibilidad del año: U = p(multitrayecto) + p(lluvia) (§ 7); año medio de 365,25 días.');
      if (nivel === 9) {
        const cp = datos.cap;
        partes.push(
          `Equipo: separación de canal CS = ${n(cp.cs, 2)} MHz, factor de caída (roll-off) ${n(cp.alfa, 2)} y rendimiento del código r = ${n(cp.r, 2)}: Rb = CS/(1 + roll-off)·log₂M·r.`,
          'Modulaciones (umbral para BER ≤ 10⁻⁶ de la ETSI EN 302 217-2 V3.4.1): ' +
            cp.mods.map((m, i) => `${i + 1}) ${nomMod(m)} (clase ${m}): ${n(cp.umbrales[i], 1)} dBm, cuadro ${cp.tablas[i]}`).join('; ') + '.',
          `Objetivo de disponibilidad: ${n(cp.objetivo, 3)} % del año. Capacidad garantizada: la Rb de la modulación más alta que cumple el objetivo. ` +
            'Capacidad media con modulación adaptativa: Σ Rbᵢ·(Uᵢ₊₁ − Uᵢ), con las U en tanto por uno y U = 1 después de la modulación 3.');
      }
    }
  }
  return partes;
}

// ---------- Solucionario de los niveles 5 a 9 ----------
function filasSolucionario15(cfg, ids) {
  const preg = preguntasDe(cfg.n), nv = cfg.n;
  const comunes = [['frecuencia (GHz)', (d) => num(d.f.v, 1)], ['potencia', (d) => num(d.p.v, 2)], ['unidad de potencia', (d) => d.p.u, false], ['distancia (km)', (d) => num(d.d, 1)],
    ['ganancia A (dBi)', (d) => num(d.a.g, 1)], ['altura A (m)', (d) => num(d.a.h, 0)], ['ganancia B (dBi)', (d) => num(d.b.g, 1)], ['altura B (m)', (d) => num(d.b.h, 0)],
    ['sensibilidad (dBm)', (d) => num(d.sens, 1)]];
  const lA = ['pérdidas A (dB)', (d) => num(d.a.l, 1)], lB = ['pérdidas B (dB)', (d) => num(d.b.l, 1)];
  const clima = [['polarización', (d) => d.pol, false], ['log K', (d) => num(d.logK, 2)], ['dN75 (N)', (d) => num(d.clima.dN75, 0)], ['R0,01 (mm/h)', (d) => num(d.clima.R001, 0)],
    ['P0 (%)', (d) => num(d.clima.P0, 2)], ['h0 (km)', (d) => num(d.clima.h0, 3)], ['k (P.838)', (d, s) => num(s.k838, 5)], ['α (P.838)', (d, s) => num(s.alfa838, 4)]];
  const extra = {
    5: [['cable A', (d) => d.a.cable, false], ['longitud A (m)', (d) => num(d.a.long, 0)], ['cable B', (d) => d.b.cable, false], ['longitud B (m)', (d) => num(d.b.long, 0)]],
    6: [['guía A', (d) => d.a.guia, false], ['longitud de la bajada A (m)', (d) => num(d.a.long, 0)], ['coaxial comparado', (d) => d.coax, false], lB],
    7: [lA, lB, ['obstáculo: distancia a A (km)', (d) => num(d.obst.d, 1)], ['obstáculo: cota (m)', (d) => num(d.obst.z, 0)]],
    8: [lA, lB, ...clima],
    9: [lA, lB, ...clima, ['CS (MHz)', (d) => num(d.cap.cs, 2)], ['roll-off', (d) => num(d.cap.alfa, 2)], ['rendimiento r', (d) => num(d.cap.r, 2)], ['objetivo (%)', (d) => num(d.cap.objetivo, 3)],
      ...[0, 1, 2].flatMap((i) => [[`modulación ${i + 1}`, (d) => nomMod(d.cap.mods[i]), false], [`umbral ${i + 1} (dBm)`, (d) => num(d.cap.umbrales[i], 1)]])],
  }[nv];
  const cols = [...comunes, ...extra];
  const cab = ['identificador', 'identificador normalizado', ...cols.map((c) => c[0]), ...preg.map((p) => `${p.texto}${p.unidad ? ` (${p.unidad})` : ''}`)];
  cab.numericas = [];
  const numericas = [...cols.map((c, i) => (c[2] === false ? -1 : 2 + i)).filter((i) => i >= 0), ...preg.map((_, i) => 2 + cols.length + i)];
  const filas = [cab];
  for (const id of ids) {
    const { datos, sol } = generarDatos(cfg, id);
    const r = [id, normalizarId(id), ...cols.map((c) => c[1](datos, sol)), ...preg.map((p) => num(sol[p.clave], decimales(p, sol[p.clave])))];
    r.numericas = numericas;
    filas.push(r);
  }
  return filas;
}
