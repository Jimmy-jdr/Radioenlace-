/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// terreno.js — Obtención de cotas del terreno
//
// Fuente principal: Modelo Digital del Terreno del IGN/CNIG servido por
// el WCS INSPIRE de la IDEE (https://servicios.idee.es/wcs-inspire/mdt)
//   · MDT25  (Elevacion4258_25)  → malla de 25 m, trayectos ≤ 80 km
//   · MDT200 (Elevacion4258_200) → malla de 200 m, trayectos más largos
// No necesita claves ni cuentas.
//
// Versión 1.3: el relieve se pide por ZONAS FIJAS («teselas»). La Tierra
// se divide en una cuadrícula fija de 200 × 200 celdas del MDT (0,05° en
// el MDT25 y 0,4° en el MDT200), alineada a múltiplos de la celda, y cada
// tesela se pide siempre con la misma petición (con 2 celdas de margen).
// Así la cota de un punto es siempre la misma, venga del perfil punto a
// punto o del mapa de cobertura: cada píxel del mapa da exactamente lo
// mismo que el cálculo punto a punto con B en ese píxel.
//
// Respaldo: Copernicus GLO-90 a través de la API pública de Open-Meteo,
// solo para las cotas que el IGN no devuelva. También por bloques fijos:
// nodos de la malla de 3″ (la del propio GLO-90), en bloques de 10 × 10
// nodos (una petición de 100 puntos), con interpolación bilineal.
//
// Las respuestas se guardan en una caché propia que NO se borra al
// actualizar la app («radioenlace-relieve»): el punto a punto y los mapas
// de cobertura funcionan sin conexión en las zonas ya descargadas.
// =====================================================================
import { distanciaKm, puntosTrayecto, puntoEnTrayecto } from './radio.js';

export const WCS_IGN = 'https://servicios.idee.es/wcs-inspire/mdt';
export const API_COPERNICUS = 'https://api.open-meteo.com/v1/elevation';
export const CACHE_RELIEVE = 'radioenlace-relieve';      // persistente: no depende de la versión
const CLAVE_ZONAS = 'radioenlace-zonas-v1';              // registro de zonas guardadas (no toca los datos del enlace)

export const CELDAS_TESELA = 200;    // celdas por lado de cada tesela fija
export const MARGEN_TESELA = 2;      // celdas de margen a cada lado (204 × 204 por petición)

export const FUENTES = {
  mdt25: {
    id: 'mdt25', cobertura: 'Elevacion4258_25', celda: 0.00025, celdaM: 25, tesela: 0.05,
    nombre: 'IGN/CNIG · MDT25 (WCS INSPIRE de la IDEE)',
    resolucion: 'malla de 25 m (0,00025°), ETRS89',
    enlace: 'https://centrodedescargas.cnig.es/',
  },
  mdt200: {
    id: 'mdt200', cobertura: 'Elevacion4258_200', celda: 0.002, celdaM: 200, tesela: 0.4,
    nombre: 'IGN/CNIG · MDT200 (WCS INSPIRE de la IDEE)',
    resolucion: 'malla de 200 m (0,002°), ETRS89',
    enlace: 'https://centrodedescargas.cnig.es/',
  },
  copernicus: {
    id: 'copernicus', celdaM: 90,
    nombre: 'Copernicus GLO-90 (API Open-Meteo)',
    resolucion: 'malla de 3″ (≈ 90 m)',
    enlace: 'https://open-meteo.com/en/docs/elevation-api',
  },
  plano: {
    id: 'plano', celdaM: null,
    nombre: 'Terreno plano teórico (cota 0 m)',
    resolucion: 'sin relieve; solo curvatura terrestre',
    enlace: null,
  },
  obstaculo: {
    id: 'obstaculo', celdaM: null,
    nombre: 'Terreno plano teórico (cota 0 m) con un obstáculo agudo',
    resolucion: 'sin relieve salvo el obstáculo (filo de cuchillo); curvatura terrestre',
    enlace: null,
  },
};

const MAX_PUNTOS = 1500;       // muestras máximas del perfil
export const NODOS_GRADO = 1200;   // malla de Copernicus GLO-90: 3″ = 1/1200°
export const BLOQUE = 9;           // celdas por bloque de Copernicus (10 × 10 nodos)

// ---------- Formato ArcGrid (ESRI ASCII) ----------
export function leerArcGrid(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const cab = {};
  let i = 0;
  for (; i < lineas.length; i++) {
    const p = lineas[i].trim().split(/\s+/);
    if (p[0] === '') continue;
    if (isNaN(Number(p[0]))) cab[p[0].toLowerCase()] = Number(p[1]);
    else break;
  }
  const ncols = cab.ncols, nrows = cab.nrows;
  if (!ncols || !nrows) throw new Error('Respuesta del servicio de relieve no válida');
  const dx = cab.cellsize ?? cab.dx, dy = cab.cellsize ?? cab.dy;
  // xllcorner = esquina; xllcenter = centro de la celda inferior izquierda
  const x0 = cab.xllcorner ?? cab.xllcenter - dx / 2;
  const y0 = cab.yllcorner ?? cab.yllcenter - dy / 2;
  const datos = new Float32Array(ncols * nrows);
  let k = 0;
  for (; i < lineas.length && k < datos.length; i++) {
    const l = lineas[i].trim();
    if (!l) continue;
    for (const v of l.split(/\s+/)) datos[k++] = Number(v);
  }
  return { ncols, nrows, x0, y0, dx, dy, nodata: cab.nodata_value, datos, completos: k === datos.length };
}

// Interpolación bilineal; null si cae fuera o falta alguna cota vecina
export function muestrearMalla(m, lat, lon) {
  const fx = (lon - m.x0) / m.dx - 0.5;
  const fyAbajo = (lat - m.y0) / m.dy - 0.5;       // filas desde abajo
  const c0 = Math.floor(fx), r0 = Math.floor(fyAbajo);
  if (c0 < 0 || r0 < 0 || c0 + 1 >= m.ncols || r0 + 1 >= m.nrows) return null;
  const tx = fx - c0, ty = fyAbajo - r0;
  const v = (c, rAbajo) => {
    const fila = m.nrows - 1 - rAbajo;              // el fichero empieza por el norte
    const x = m.datos[fila * m.ncols + c];
    if (!isFinite(x) || x === m.nodata || x <= -1000) return null;
    return x;
  };
  const a = v(c0, r0), b = v(c0 + 1, r0), c = v(c0, r0 + 1), d = v(c0 + 1, r0 + 1);
  if (a == null || b == null || c == null || d == null) return null;
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

export function urlMallaIGN(fuente, caja, ancho, alto) {
  const [oeste, sur, este, norte] = caja;
  return `${WCS_IGN}?service=WCS&version=1.0.0&request=GetCoverage&coverage=${fuente.cobertura}` +
    `&crs=EPSG:4258&bbox=${oeste.toFixed(6)},${sur.toFixed(6)},${este.toFixed(6)},${norte.toFixed(6)}` +
    `&width=${ancho}&height=${alto}&format=ArcGrid`;
}

// ---------------------------------------------------------------------
// Teselas fijas del MDT
// ---------------------------------------------------------------------
// Tesela «dueña» de un punto: la que contiene su longitud y su latitud
export function teselaDe(fuente, lat, lon) {
  return [Math.floor(lon / fuente.tesela), Math.floor(lat / fuente.tesela)];
}
// Caja pedida para la tesela (i, j): sus 200 × 200 celdas más 2 de margen,
// con los bordes en múltiplos exactos de la celda (enteros × celda).
export function cajaTesela(fuente, i, j) {
  const k = CELDAS_TESELA, m = MARGEN_TESELA, c = fuente.celda;
  return [(i * k - m) * c, (j * k - m) * c, ((i + 1) * k + m) * c, ((j + 1) * k + m) * c];
}
export function urlTesela(fuente, clave) {
  const [i, j] = clave.split(',').map(Number);
  const lado = CELDAS_TESELA + 2 * MARGEN_TESELA;
  return urlMallaIGN(fuente, cajaTesela(fuente, i, j), lado, lado);
}
export function teselasDePuntos(fuente, puntos) {
  const s = new Set();
  for (const p of puntos) s.add(teselaDe(fuente, p.lat, p.lon).join(','));
  return [...s];
}
export function teselasDeCaja(fuente, [oeste, sur, este, norte]) {
  const [i0, j0] = teselaDe(fuente, sur, oeste), [i1, j1] = teselaDe(fuente, norte, este);
  const r = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) r.push(`${i},${j}`);
  return r;
}

// ---------------------------------------------------------------------
// Bloques fijos de Copernicus GLO-90 (nodos de 3″)
// ---------------------------------------------------------------------
export function bloqueDe(lat, lon) {
  const i0 = Math.floor(lon * NODOS_GRADO), j0 = Math.floor(lat * NODOS_GRADO);
  return [Math.floor(i0 / BLOQUE), Math.floor(j0 / BLOQUE)];
}
export function urlBloque(clave) {
  const [I, J] = clave.split(',').map(Number);
  const la = [], lo = [];
  for (let jj = 0; jj <= BLOQUE; jj++) {
    for (let ii = 0; ii <= BLOQUE; ii++) {
      la.push(((J * BLOQUE + jj) / NODOS_GRADO).toFixed(6));
      lo.push(((I * BLOQUE + ii) / NODOS_GRADO).toFixed(6));
    }
  }
  return `${API_COPERNICUS}?latitude=${la.join(',')}&longitude=${lo.join(',')}`;
}
export function bloquesDePuntos(puntos) {
  const s = new Set();
  for (const p of puntos) s.add(bloqueDe(p.lat, p.lon).join(','));
  return [...s];
}
// Bloques que cubren una caja [oeste, sur, este, norte]
function bloquesDeCaja([oeste, sur, este, norte], s) {
  const [I0, J0] = bloqueDe(sur, oeste), [I1, J1] = bloqueDe(norte, este);
  for (let J = J0; J <= J1; J++) for (let I = I0; I <= I1; I++) s.add(`${I},${J}`);
}
function leerBloque(texto) {
  const j = JSON.parse(texto);
  const n = (BLOQUE + 1) ** 2;
  if (!Array.isArray(j.elevation) || j.elevation.length !== n) throw new Error('Respuesta de Open-Meteo no válida');
  const v = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const z = j.elevation[k];
    v[k] = typeof z === 'number' && isFinite(z) && z > -1000 ? z : NaN;
  }
  return v;
}

// ---------------------------------------------------------------------
// Almacén de relieve: teselas del IGN y bloques de Copernicus ya leídos.
// El perfil punto a punto y el mapa de cobertura (también en su Web
// Worker) obtienen las cotas con la misma función cotaPunto().
// ---------------------------------------------------------------------
export function nuevoAlmacen(fuente) { return { fuente, ign: new Map(), cop: new Map() }; }

export function cotaIGN(alm, lat, lon) {
  const m = alm.ign.get(teselaDe(alm.fuente, lat, lon).join(','));
  if (!m) return null;
  const z = muestrearMalla(m, lat, lon);
  // El servicio devuelve 0 fuera de su cobertura (mar, Portugal, Francia…):
  // una cota exactamente 0 se trata como dato dudoso.
  return z != null && z !== 0 ? z : null;
}

export function cotaCopernicus(alm, lat, lon) {
  const x = lon * NODOS_GRADO, y = lat * NODOS_GRADO;
  const i0 = Math.floor(x), j0 = Math.floor(y);
  const I = Math.floor(i0 / BLOQUE), J = Math.floor(j0 / BLOQUE);
  const b = alm.cop.get(`${I},${J}`);
  if (!b) return null;
  const li = i0 - I * BLOQUE, lj = j0 - J * BLOQUE, w = BLOQUE + 1;
  const a = b[lj * w + li], bb = b[lj * w + li + 1], c = b[(lj + 1) * w + li], d = b[(lj + 1) * w + li + 1];
  if (!(isFinite(a) && isFinite(bb) && isFinite(c) && isFinite(d))) return null;
  const tx = x - i0, ty = y - j0;
  return a * (1 - tx) * (1 - ty) + bb * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

// Cota de un punto: IGN; si no hay, Copernicus; si tampoco, null
export function cotaPunto(alm, lat, lon) {
  const z = cotaIGN(alm, lat, lon);
  if (z != null) return [z, alm.fuente.id];
  const zc = cotaCopernicus(alm, lat, lon);
  if (zc != null) return [zc, 'copernicus'];
  return [null, null];
}

export function asignarCotas(puntos, alm) {
  for (const p of puntos) {
    const [z, o] = cotaPunto(alm, p.lat, p.lon);
    p.z = z; p.origen = o;
  }
}

// ---------------------------------------------------------------------
// Descarga con caché persistente (Cache API) y caché en memoria
// ---------------------------------------------------------------------
const hayCache = () => typeof caches !== 'undefined';
const memoria = new Map();           // url → promesa del dato leído
const MAX_MEMORIA = 96;              // teselas y bloques en memoria (≈ 16 MB de teselas)

function recordar(url, promesa) {
  memoria.set(url, promesa);
  promesa.catch(() => memoria.delete(url));
  while (memoria.size > MAX_MEMORIA) memoria.delete(memoria.keys().next().value);
  return promesa;
}

// Descarga una URL de relieve (o la toma de la caché) y la interpreta.
// Devuelve { dato, bytes, red }; red = true si vino de internet.
// La descarga en sí no se interrumpe (otra petición puede estar esperando
// la misma tesela y así queda guardada); quien cancela recibe AbortError.
const abortado = () => new DOMException('Cancelado', 'AbortError');
async function pedir(url, interpretar, validar, señal) {
  if (señal?.aborted) throw abortado();
  let promesa = memoria.get(url), nueva = false;
  if (promesa) { memoria.delete(url); memoria.set(url, promesa); }
  else { promesa = recordar(url, descargarUna(url, interpretar, validar)); nueva = true; }
  const r = await promesa;
  if (señal?.aborted) throw abortado();
  return nueva ? r : { ...r, red: false };
}
function descargarUna(url, interpretar, validar) {
  return (async () => {
    let cache = null;
    if (hayCache()) {
      try {
        cache = await caches.open(CACHE_RELIEVE);
        const r = await cache.match(url);
        if (r) { const t = await r.text(); return { dato: interpretar(t), bytes: t.length, red: false }; }
      } catch { cache = null; }
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${new URL(url).host.includes('open-meteo') ? 'Open-Meteo' : 'El IGN'} respondió ${r.status}`);
    const t = await r.text();
    validar?.(t);
    const dato = interpretar(t);
    if (cache) { try { await cache.put(url, new Response(t, { headers: { 'content-type': 'text/plain; charset=utf-8' } })); } catch { /* sin espacio */ } }
    return { dato, bytes: t.length, red: true };
  })();
}

const validarIGN = (t) => {
  if (/ServiceException|ExceptionReport/i.test(t.slice(0, 600))) throw new Error('El IGN devolvió un error de servicio');
};

export async function descargarMallaIGN(fuente, caja, señal) {
  const ancho = Math.max(2, Math.round((caja[2] - caja[0]) / fuente.celda));
  const alto = Math.max(2, Math.round((caja[3] - caja[1]) / fuente.celda));
  return (await pedir(urlMallaIGN(fuente, caja, ancho, alto), leerArcGrid, validarIGN, señal)).dato;
}

// Ejecuta tareas asíncronas con un máximo de peticiones simultáneas
async function enParalelo(tareas, max) {
  const res = new Array(tareas.length);
  let sig = 0;
  async function trabajador() {
    while (sig < tareas.length) { const i = sig++; res[i] = await tareas[i](); }
  }
  await Promise.all(Array.from({ length: Math.min(max, tareas.length) }, trabajador));
  return res;
}

// Carga en el almacén las teselas indicadas («i,j»). Las que fallan quedan
// como null (sus puntos se completan con Copernicus).
export async function cargarTeselasIGN(alm, claves, { señal, alProgreso, urls } = {}) {
  const errores = [];
  let hechos = 0, bytes = 0, red = 0;
  await enParalelo(claves.map((k) => async () => {
    if (alm.ign.has(k) && alm.ign.get(k)) { alProgreso?.(++hechos / claves.length, { bytes, red }); return; }
    const url = urlTesela(alm.fuente, k);
    urls?.push(url);
    try {
      const r = await pedir(url, leerArcGrid, validarIGN, señal);
      alm.ign.set(k, r.dato); bytes += r.bytes; if (r.red) red++;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      alm.ign.set(k, null); errores.push(e.message);
    }
    alProgreso?.(++hechos / claves.length, { bytes, red });
  }), 4);
  return { errores, bytes, red };
}

export async function cargarBloquesCopernicus(alm, claves, { señal, alProgreso, urls } = {}) {
  const errores = [];
  let hechos = 0, bytes = 0, red = 0;
  await enParalelo(claves.map((k) => async () => {
    if (alm.cop.get(k)) { alProgreso?.(++hechos / claves.length); return; }
    const url = urlBloque(k);
    urls?.push(url);
    try {
      const r = await pedir(url, leerBloque, null, señal);
      alm.cop.set(k, r.dato); bytes += r.bytes; if (r.red) red++;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      errores.push(e.message);
    }
    alProgreso?.(++hechos / claves.length);
  }), 2);
  return { errores, bytes, red };
}

// Bloques de Copernicus que pueden hacer falta dentro de una caja: alrededor
// de cada nodo del IGN sin dato o con cota 0, y en las teselas que faltan.
// (Es un superconjunto de los que de verdad se usan: nunca falta ninguno.)
export function bloquesDudosos(alm, caja, clavesTeselas) {
  const s = new Set();
  const [O, S, E, N] = caja;
  const recortar = (o, su, e, n) => {
    const r = [Math.max(o, O), Math.max(su, S), Math.min(e, E), Math.min(n, N)];
    if (r[0] <= r[2] && r[1] <= r[3]) bloquesDeCaja(r, s);
  };
  const T = alm.fuente.tesela;
  for (const k of clavesTeselas) {
    const [i, j] = k.split(',').map(Number);
    const m = alm.ign.get(k);
    const zona = [i * T, j * T, (i + 1) * T, (j + 1) * T];
    if (!m) { recortar(...zona); continue; }
    for (let f = 0; f < m.nrows; f++) {
      for (let c = 0; c < m.ncols; c++) {
        const v = m.datos[f * m.ncols + c];
        if (isFinite(v) && v !== m.nodata && v > -1000 && v !== 0) continue;
        const lon = m.x0 + (c + 0.5) * m.dx, lat = m.y0 + (m.nrows - 1 - f + 0.5) * m.dy;
        recortar(Math.max(lon - m.dx, zona[0]), Math.max(lat - m.dy, zona[1]), Math.min(lon + m.dx, zona[2]), Math.min(lat + m.dy, zona[3]));
      }
    }
  }
  return [...s];
}

// ---------------------------------------------------------------------
// Perfil A → B (común al punto a punto y a cada píxel de la cobertura)
// ---------------------------------------------------------------------
// modo: 'ign' (relieve real) o 'plano' (ejercicio teórico)
// modo 'obstaculo' (versión 1.4): plano con un obstáculo agudo de cota obst.z (m)
// a obst.d (km) de A, añadido como un punto más del perfil en su distancia exacta.
export function puntosPerfil(a, b, modo = 'ign', obst = null) {
  const dKm = distanciaKm(a, b);
  if (modo === 'obstaculo' && dKm > 0) {
    const base = puntosPerfil(a, b, 'plano');
    const D = dKm * 1000, dO = obstaculoValido(obst, dKm) ? obst.d * 1000 : null;
    const puntos = base.puntos;
    if (dO != null) {
      const igual = puntos.findIndex((p) => Math.abs(p.d - dO) < 1e-6);
      if (igual >= 0) Object.assign(puntos[igual], { z: obst.z, origen: 'obstaculo' });
      else {
        const q = puntoEnTrayecto(a, b, dO / D);
        puntos.splice(puntos.findIndex((p) => p.d > dO), 0, { lat: q.lat, lon: q.lon, d: dO, z: obst.z, origen: 'obstaculo' });
      }
    }
    return { dKm, n: puntos.length, fuente: FUENTES.obstaculo, paso: base.paso, puntos };
  }
  if (modo === 'plano' || modo === 'obstaculo' || dKm === 0) {
    const n = 241;
    return { dKm, n, fuente: FUENTES.plano, paso: (dKm * 1000) / (n - 1), puntos: puntosTrayecto(a, b, n).map((p) => ({ ...p, z: 0, origen: 'plano' })) };
  }
  const fuente = dKm <= 80 ? FUENTES.mdt25 : FUENTES.mdt200;
  const n = Math.min(MAX_PUNTOS, Math.max(65, Math.ceil((dKm * 1000) / fuente.celdaM) + 1));
  return { dKm, n, fuente, paso: (dKm * 1000) / (n - 1), puntos: puntosTrayecto(a, b, n).map((p) => ({ ...p, z: null, origen: null })) };
}

export function contarFuentes(puntos) {
  const porFuente = {};
  for (const p of puntos) { const k = p.origen || 'sin-dato'; porFuente[k] = (porFuente[k] || 0) + 1; }
  return porFuente;
}

// Obstáculo dentro del trayecto (sin tocar los extremos) y con cota válida
export function obstaculoValido(o, dKm) {
  return !!o && Number.isFinite(o.d) && Number.isFinite(o.z) && o.d > 0 && o.d < dKm && o.z >= 0 && o.z <= 9000;
}

export async function obtenerPerfil(a, b, { modo = 'ign', obstaculo = null, señal, alProgreso } = {}) {
  const base = puntosPerfil(a, b, modo, obstaculo);
  const { puntos, fuente, n, paso } = base;
  const avisos = [];
  if (fuente.id === 'plano') return { puntos, fuente, paso, avisos, faltan: 0, porFuente: { plano: n } };
  if (fuente.id === 'obstaculo') {
    const conObst = puntos.some((p) => p.origen === 'obstaculo');
    if (!conObst) avisos.push('El obstáculo no está dentro del trayecto A–B: el perfil es plano.');
    return { puntos, fuente, paso, avisos, faltan: 0, porFuente: contarFuentes(puntos) };
  }

  const alm = nuevoAlmacen(fuente);
  let erroresIGN = [];
  try { erroresIGN = (await cargarTeselasIGN(alm, teselasDePuntos(fuente, puntos), { señal, alProgreso })).errores; }
  catch (e) { if (e.name === 'AbortError') throw e; erroresIGN = [e.message]; }
  if (erroresIGN.length) avisos.push(`No se pudo descargar parte del relieve del IGN (${erroresIGN[0]}).`);
  asignarCotas(puntos, alm);

  const sinCota = puntos.filter((p) => p.z == null);
  if (sinCota.length) {
    let erroresCop = [];
    try { erroresCop = (await cargarBloquesCopernicus(alm, bloquesDePuntos(sinCota), { señal })).errores; }
    catch (e) { if (e.name === 'AbortError') throw e; erroresCop = [e.message]; }
    if (erroresCop.length) avisos.push(`El servicio de respaldo tampoco respondió (${erroresCop[0]}).`);
    asignarCotas(sinCota, alm);
  }

  const porFuente = contarFuentes(puntos);
  if (porFuente.copernicus) {
    avisos.push(`${porFuente.copernicus} de ${n} cotas no estaban en el MDT del IGN (fuera de cobertura o sin dato) y se han completado con ${FUENTES.copernicus.nombre}, de menor resolución (≈ 90 m).`);
  }
  const faltan = porFuente['sin-dato'] || 0;
  if (faltan) {
    avisos.push(`Faltan ${faltan} de ${n} cotas: esos tramos aparecen marcados en rojo bajo el perfil y no se tienen en cuenta en el despeje. Comprueba la conexión o el emplazamiento.`);
  }
  return { puntos, fuente, paso, avisos, faltan, porFuente };
}

// ---------------------------------------------------------------------
// Zonas guardadas para usar sin conexión
// ---------------------------------------------------------------------
export function listarZonas() {
  try { const z = JSON.parse(localStorage.getItem(CLAVE_ZONAS) || '[]'); return Array.isArray(z) ? z : []; }
  catch { return []; }
}
function escribirZonas(z) { try { localStorage.setItem(CLAVE_ZONAS, JSON.stringify(z)); } catch { /* sin almacenamiento */ } }

// zona = { id, nombre, lat, lon, radioKm, fecha, urls, bytes }
export function guardarZona(zona) {
  const z = listarZonas().filter((x) => x.id !== zona.id);
  z.push(zona);
  escribirZonas(z);
}

export async function borrarZona(id) {
  const zonas = listarZonas();
  const zona = zonas.find((x) => x.id === id);
  const resto = zonas.filter((x) => x.id !== id);
  escribirZonas(resto);
  if (!zona || !hayCache()) return;
  const usadas = new Set(resto.flatMap((x) => x.urls));
  const c = await caches.open(CACHE_RELIEVE);
  for (const u of zona.urls) if (!usadas.has(u)) { await c.delete(u); memoria.delete(u); }
}

// Las teselas que se descargan para perfiles sueltos (no para una zona
// guardada) se limitan a las más recientes, para no llenar el almacenamiento.
export async function podarRelieveSuelto(max = 400) {
  if (!hayCache()) return 0;
  const c = await caches.open(CACHE_RELIEVE);
  const usadas = new Set(listarZonas().flatMap((x) => x.urls));
  const sueltas = (await c.keys()).filter((r) => !usadas.has(r.url));
  let borradas = 0;
  for (let i = 0; i < sueltas.length - max; i++) { await c.delete(sueltas[i]); borradas++; }
  return borradas;
}

// Cuántas de estas URL faltan en la caché (para estimar la descarga)
export async function contarFaltan(urls) {
  if (!hayCache()) return urls.length;
  try {
    const c = await caches.open(CACHE_RELIEVE);
    let faltan = 0;
    for (const u of urls) if (!memoria.has(u) && !(await c.match(u))) faltan++;
    return faltan;
  } catch { return urls.length; }
}
