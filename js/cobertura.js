/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// cobertura.js — Núcleo de los mapas de cobertura (sin DOM)
//
// Se usa igual en el Web Worker (cobertura-worker.js), en el respaldo sin
// worker y en las pruebas de Node.
//
// Método: un perfil propio desde A hasta el CENTRO de cada píxel, hecho
// con las mismas funciones que el cálculo punto a punto de la app:
//   · terreno.puntosPerfil(): mismo círculo máximo y mismo número de cotas
//     (una cada 25 m del MDT25, mínimo 65, máximo 1500);
//   · terreno.cotaPunto(): mismas teselas fijas del IGN y mismo respaldo
//     de Copernicus, con la misma interpolación bilineal;
//   · el modelo elegido en «Datos» (modelos.js): Longley–Rice (ITM) con los
//     mismos parámetros, o espacio libre más la difracción en filo de
//     cuchillo del obstáculo principal (UIT-R P.526) con el factor k;
//   · radio.presupuesto(): el mismo presupuesto de enlace.
// Por eso cada píxel da exactamente lo mismo (bit a bit) que el punto a
// punto con B en el centro de ese píxel y la antena receptora del mapa.
//
// La malla es regular en latitud y longitud (ETRS89 ≈ WGS84), centrada en
// A, con píxeles cuadrados sobre el terreno: Δφ = s / R (rad) y
// Δλ = Δφ / cos φ_A. Con N par, A queda en una esquina de píxel. Los
// centros se redondean a 6 decimales, como las coordenadas de la app,
// para que «Poner B aquí» use exactamente el mismo punto.
// =====================================================================
import * as R from './radio.js';
import { obtenerModelo } from './modelos.js';
import { FUENTES, puntosPerfil, asignarCotas, nuevoAlmacen, teselasDeCaja, urlTesela, cargarTeselasIGN, bloquesDudosos, cargarBloquesCopernicus, BLOQUE, NODOS_GRADO } from './terreno.js';

export const RADIOS_KM = [5, 10, 20, 30];
export const RESOLUCIONES = { normal: 200, fina: 400 };
export const COB_DEFECTO = { radio: 10, res: 'normal', rx: 'b', h: 10, g: 0, l: 0, opacidad: 60, visible: true };
export const D_MIN_KM = 0.05;     // como en el punto a punto: más cerca no se calcula

// Estado de cada píxel
export const PIXEL = { FUERA: 0, OK: 1, FALTAN: 2, MODELO: 3, CERCA: 4 };
export const TEXTO_ESTADO = {
  0: 'fuera del radio',
  1: 'calculado',
  2: 'sin cálculo: faltan cotas del relieve',
  3: 'sin cálculo: el modelo no se puede aplicar',
  4: 'sin cálculo: demasiado cerca de A',
};

// Bandas de margen sobre la sensibilidad (dB). Escala secuencial de claro a
// oscuro (amarillo → verde → azul), legible también con daltonismo; gris
// translúcido: por debajo de la sensibilidad; transparente: sin cálculo.
export const BANDAS = [
  { min: 0, max: 10, color: [253, 231, 37] },
  { min: 10, max: 20, color: [94, 201, 98] },
  { min: 20, max: 30, color: [33, 145, 140] },
  { min: 30, max: Infinity, color: [59, 82, 139] },
];
export const SIN_SERVICIO = { color: [120, 120, 120], alfa: 150 };
export function bandaDe(margen) {
  if (!(margen >= 0)) return -1;
  for (let i = BANDAS.length - 1; i >= 0; i--) if (margen >= BANDAS[i].min) return i;
  return 0;
}
export const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function normalizarCobertura(c = {}) {
  const r = { ...COB_DEFECTO, ...c };
  r.radio = RADIOS_KM.includes(+r.radio) ? +r.radio : COB_DEFECTO.radio;
  if (!RESOLUCIONES[r.res]) r.res = COB_DEFECTO.res;
  if (r.rx !== 'b' && r.rx !== 'propio') r.rx = 'b';
  for (const [k, lo, hi] of [['h', 0.5, 500], ['g', -10, 70], ['l', 0, 100]]) {
    r[k] = Number(r[k]);
    if (!(r[k] >= lo && r[k] <= hi)) r[k] = COB_DEFECTO[k];
  }
  r.opacidad = Math.min(100, Math.max(10, Number(r.opacidad) || COB_DEFECTO.opacidad));
  r.visible = r.visible !== false;
  return r;
}

// ---------------------------------------------------------------------
// Malla de píxeles
// ---------------------------------------------------------------------
export function definirMalla(params) {
  const { a, radioKm, N } = params;
  const s = (2 * radioKm * 1000) / N;                       // lado del píxel (m)
  const dlat = (s / 1000 / R.R_TIERRA_KM) * (180 / Math.PI);
  const dlon = dlat / Math.cos((a.lat * Math.PI) / 180);
  const latC = new Float64Array(N), lonC = new Float64Array(N);
  for (let r = 0; r < N; r++) latC[r] = +(a.lat + ((N - 1) / 2 - r) * dlat).toFixed(6);
  for (let c = 0; c < N; c++) lonC[c] = +(a.lon + (c - (N - 1) / 2) * dlon).toFixed(6);
  return {
    N, s, dlat, dlon, latC, lonC,
    norte: a.lat + (N / 2) * dlat, sur: a.lat - (N / 2) * dlat,
    oeste: a.lon - (N / 2) * dlon, este: a.lon + (N / 2) * dlon,
  };
}

// Caja [oeste, sur, este, norte] que contiene todos los perfiles
export function cajaCobertura(malla) { return [malla.oeste, malla.sur, malla.este, malla.norte]; }

// Píxel que contiene un punto (o null si queda fuera de la malla)
export function pixelDe(malla, lat, lon) {
  const r = Math.floor((malla.norte - lat) / malla.dlat), c = Math.floor((lon - malla.oeste) / malla.dlon);
  return r >= 0 && c >= 0 && r < malla.N && c < malla.N ? { r, c } : null;
}

// ---------------------------------------------------------------------
// Cálculo de un píxel: idéntico al punto a punto de app.js
// ---------------------------------------------------------------------
export function calcularPixel(params, malla, alm, r, c, modelo = obtenerModelo(params.modelo)) {
  const a = params.a;
  const b = { lat: malla.latC[r], lon: malla.lonC[c] };
  const dKm = R.distanciaKm(a, b);
  if (dKm > params.radioKm) return { estado: PIXEL.FUERA, dKm };
  if (dKm < D_MIN_KM) return { estado: PIXEL.CERCA, dKm };
  const base = puntosPerfil(a, b, params.terreno === 'plano' ? 'plano' : 'ign');
  const puntos = base.puntos;
  if (base.fuente.id !== 'plano') asignarCotas(puntos, alm);
  let cop = false;
  for (const p of puntos) {
    if (p.z == null) return { estado: PIXEL.FALTAN, dKm };
    if (p.origen === 'copernicus') cop = true;
  }
  const hB = params.rx.h;
  const res = modelo.calcular({ dKm, fMHz: params.fMHz, perfil: puntos, hA: params.hA, hB, itm: params.itm });
  if (res.aviso) return { estado: PIXEL.MODELO, dKm, aviso: res.aviso };
  const pres = R.presupuesto({ ptxDbm: params.ptxDbm, gtx: params.gtx, grx: params.rx.g, ltx: params.ltx, lrx: params.rx.l, perdidaTrayecto: res.perdida, sensibilidad: params.sens });
  // Con Longley–Rice el relieve ya está en la pérdida; con espacio libre se
  // descuenta la difracción del obstáculo principal (como evaluarEnlace()).
  let J = 0;
  if (!res.incluyeTerreno) {
    const an = R.analizarPerfil({ perfil: puntos, hA: params.hA, hB, fMHz: params.fMHz, k: params.k });
    const dif = R.difraccionObstaculoPrincipal(an, params.fMHz);
    J = dif?.J ?? 0;
  }
  return {
    estado: PIXEL.OK, dKm, cop,
    perdidaModelo: res.perdida, J,
    perdida: res.perdida + J,
    prx: pres.prx - J,
    margen: pres.margen - J,
    cota: puntos[puntos.length - 1].z,
    modo: res.detalle?.inter?.mode ?? 0,
    avisos: res.detalle?.warnings ?? 0,
  };
}

// Calcula una fila completa y la devuelve en vectores (transferibles)
export function calcularFila(params, malla, alm, r) {
  const N = malla.N;
  const fila = {
    estado: new Uint8Array(N), modo: new Uint8Array(N), cop: new Uint8Array(N), avisos: new Uint16Array(N),
    prx: new Float64Array(N).fill(NaN), margen: new Float64Array(N).fill(NaN), perdida: new Float64Array(N).fill(NaN),
    J: new Float64Array(N).fill(NaN), cota: new Float64Array(N).fill(NaN), dKm: new Float64Array(N),
  };
  const modelo = obtenerModelo(params.modelo);
  for (let c = 0; c < N; c++) {
    const p = calcularPixel(params, malla, alm, r, c, modelo);
    fila.estado[c] = p.estado;
    fila.dKm[c] = p.dKm;
    if (p.estado !== PIXEL.OK) continue;
    fila.prx[c] = p.prx; fila.margen[c] = p.margen; fila.perdida[c] = p.perdida; fila.J[c] = p.J;
    fila.cota[c] = p.cota; fila.modo[c] = p.modo; fila.avisos[c] = p.avisos; fila.cop[c] = p.cop ? 1 : 0;
  }
  return fila;
}
export const transferiblesFila = (f) => Object.values(f).map((v) => v.buffer);

// Resultado completo (N × N) a partir de las filas
export function nuevoResultado(N) {
  const n = N * N;
  return {
    estado: new Uint8Array(n), modo: new Uint8Array(n), cop: new Uint8Array(n), avisos: new Uint16Array(n),
    prx: new Float64Array(n).fill(NaN), margen: new Float64Array(n).fill(NaN), perdida: new Float64Array(n).fill(NaN),
    J: new Float64Array(n).fill(NaN), cota: new Float64Array(n).fill(NaN), dKm: new Float64Array(n),
    filasHechas: 0,
  };
}
export function ponerFila(res, N, r, fila) {
  for (const k of Object.keys(fila)) res[k].set(fila[k], r * N);
  res.filasHechas++;
}

// ---------------------------------------------------------------------
// Almacén de relieve ↔ mensaje para el Web Worker
// ---------------------------------------------------------------------
export function almacenAMensaje(alm) {
  return {
    fuente: alm.fuente.id,
    ign: [...alm.ign].map(([k, m]) => [k, m && { ncols: m.ncols, nrows: m.nrows, x0: m.x0, y0: m.y0, dx: m.dx, dy: m.dy, nodata: m.nodata, datos: m.datos }]),
    cop: [...alm.cop].filter(([, v]) => v),
  };
}
export function almacenDeMensaje(m) {
  const alm = nuevoAlmacen(FUENTES[m.fuente]);
  for (const [k, v] of m.ign) alm.ign.set(k, v);
  for (const [k, v] of m.cop) alm.cop.set(k, v);
  return alm;
}

// Huella de los datos que influyen en el mapa: si cambia, queda desactualizado
export function huella(params) {
  const { a, terreno, fMHz, ptxDbm, gtx, ltx, hA, sens, k, rx, modelo, itm, radioKm, N } = params;
  return JSON.stringify({ a: [a.lat, a.lon], terreno, fMHz, ptxDbm, gtx, ltx, hA, sens, rx, modelo, radioKm, N,
    k: modelo === 'longley-rice' ? null : String(k), itm: modelo === 'longley-rice' ? itm : null });
}

// Recuento final
export function resumen(res) {
  const r = { calculados: 0, conServicio: 0, sinServicio: 0, faltan: 0, modelo: 0, cerca: 0, conCopernicus: 0, bandas: BANDAS.map(() => 0) };
  for (let i = 0; i < res.estado.length; i++) {
    const e = res.estado[i];
    if (e === PIXEL.OK) {
      r.calculados++;
      if (res.cop[i]) r.conCopernicus++;
      const b = bandaDe(res.margen[i]);
      if (b < 0) r.sinServicio++; else { r.conServicio++; r.bandas[b]++; }
    } else if (e === PIXEL.FALTAN) r.faltan++;
    else if (e === PIXEL.MODELO) r.modelo++;
    else if (e === PIXEL.CERCA) r.cerca++;
  }
  return r;
}

// ---------------------------------------------------------------------
// Relieve de la zona: teselas fijas del MDT25 y, donde haga falta,
// bloques de Copernicus. (El radio máximo, 30 km, es menor que los 80 km
// en los que el punto a punto pasa al MDT200: siempre es el MDT25.)
// ---------------------------------------------------------------------
export const MAX_BLOQUES = 600;            // peticiones máximas a Open-Meteo por mapa
export const BYTES_TESELA = 204 * 204 * 7.5; // tamaño aproximado de una tesela ArcGrid

export function teselasCobertura(malla) { return teselasDeCaja(FUENTES.mdt25, cajaCobertura(malla)); }
export function urlsTeselasCobertura(malla) { return teselasCobertura(malla).map((k) => urlTesela(FUENTES.mdt25, k)); }

export async function prepararRelieve(params, malla, { señal, alProgreso, maxBloques = MAX_BLOQUES } = {}) {
  const alm = nuevoAlmacen(FUENTES.mdt25);
  const out = { alm, urls: [], avisos: [], bytes: 0, red: 0, teselas: 0, bloques: 0, bloquesOmitidos: 0 };
  if (params.terreno === 'plano') return out;
  const caja = cajaCobertura(malla);
  const claves = teselasCobertura(malla);
  out.teselas = claves.length;
  const r1 = await cargarTeselasIGN(alm, claves, { señal, urls: out.urls, alProgreso: (x, s) => alProgreso?.('ign', x, s) });
  if (r1.errores.length) out.avisos.push(`No se pudieron descargar ${r1.errores.length} de ${claves.length} zonas del relieve del IGN (${r1.errores[0]}); se completan con Copernicus.`);
  let bloques = bloquesDudosos(alm, caja, claves);
  if (bloques.length > maxBloques) {
    const dist = (k) => {
      const [I, J] = k.split(',').map(Number);
      const lat = ((J + 0.5) * BLOQUE) / NODOS_GRADO, lon = ((I + 0.5) * BLOQUE) / NODOS_GRADO;
      return R.distanciaKm(params.a, { lat, lon });
    };
    bloques = bloques.map((k) => [dist(k), k]).sort((x, y) => x[0] - y[0]).map(([, k]) => k);
    out.bloquesOmitidos = bloques.length - maxBloques;
    bloques = bloques.slice(0, maxBloques);
    out.avisos.push(`Hay mucho terreno fuera del MDT del IGN (mar u otro país): se han completado con Copernicus solo las ${maxBloques} zonas más cercanas a A; el resto queda sin cálculo.`);
  }
  out.bloques = bloques.length;
  const r2 = await cargarBloquesCopernicus(alm, bloques, { señal, urls: out.urls, alProgreso: (x) => alProgreso?.('cop', x) });
  if (r2.errores.length) out.avisos.push(`El servicio de respaldo (Copernicus) no respondió en ${r2.errores.length} de ${bloques.length} zonas (${r2.errores[0]}): esos píxeles quedan sin cálculo.`);
  out.bytes = r1.bytes + r2.bytes;
  out.red = r1.red + r2.red;
  return out;
}

// Cálculo completo en el hilo principal (respaldo sin Web Worker y pruebas)
export async function calcularEnHilo(params, malla, alm, { alFila, cancelado, pausa } = {}) {
  const res = nuevoResultado(malla.N);
  for (let r = 0; r < malla.N; r++) {
    if (cancelado?.()) return null;
    const fila = calcularFila(params, malla, alm, r);
    ponerFila(res, malla.N, r, fila);
    alFila?.(r, fila);
    if (pausa) await pausa();
  }
  return res;
}
