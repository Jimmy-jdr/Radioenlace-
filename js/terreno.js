// =====================================================================
// terreno.js — Obtención de cotas del terreno
//
// Fuente principal: Modelo Digital del Terreno del IGN/CNIG servido por
// el WCS INSPIRE de la IDEE (https://servicios.idee.es/wcs-inspire/mdt)
//   · MDT25  (Elevacion4258_25)  → malla de 25 m, trayectos ≤ 80 km
//   · MDT200 (Elevacion4258_200) → malla de 200 m, trayectos más largos
// Se descargan pequeñas mallas ArcGrid (texto) a lo largo del trayecto y
// se interpola cada punto (bilineal). No necesita claves ni cuentas.
//
// Respaldo: Copernicus GLO-90 a través de la API pública de Open-Meteo
// (≈ 90 m), solo para las cotas que el IGN no devuelva.
//
// Para la fase 2 (mapas de cobertura) se exportan descargarMallaIGN() y
// muestrearMalla(), que sirven para pedir el relieve de un área.
// =====================================================================
import { distanciaKm, puntosTrayecto } from './radio.js';

export const WCS_IGN = 'https://servicios.idee.es/wcs-inspire/mdt';

export const FUENTES = {
  mdt25: {
    id: 'mdt25', cobertura: 'Elevacion4258_25', celda: 0.00025, celdaM: 25,
    nombre: 'IGN/CNIG · MDT25 (WCS INSPIRE de la IDEE)',
    resolucion: 'malla de 25 m (0,00025°), ETRS89',
    enlace: 'https://centrodedescargas.cnig.es/',
  },
  mdt200: {
    id: 'mdt200', cobertura: 'Elevacion4258_200', celda: 0.002, celdaM: 200,
    nombre: 'IGN/CNIG · MDT200 (WCS INSPIRE de la IDEE)',
    resolucion: 'malla de 200 m (0,002°), ETRS89',
    enlace: 'https://centrodedescargas.cnig.es/',
  },
  copernicus: {
    id: 'copernicus', celdaM: 90,
    nombre: 'Copernicus GLO-90 (API Open-Meteo)',
    resolucion: 'malla de ≈ 90 m',
    enlace: 'https://open-meteo.com/en/docs/elevation-api',
  },
  plano: {
    id: 'plano', celdaM: null,
    nombre: 'Terreno plano teórico (cota 0 m)',
    resolucion: 'sin relieve; solo curvatura terrestre',
    enlace: null,
  },
};

const CELDAS_MAX_LADO = 100;  // tamaño máximo de cada malla pedida (celdas)
const MAX_PUNTOS = 1500;      // muestras máximas del perfil
const cacheMallas = new Map();

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

export async function descargarMallaIGN(fuente, caja, señal) {
  const ancho = Math.max(2, Math.round((caja[2] - caja[0]) / fuente.celda));
  const alto = Math.max(2, Math.round((caja[3] - caja[1]) / fuente.celda));
  const url = urlMallaIGN(fuente, caja, ancho, alto);
  if (cacheMallas.has(url)) return cacheMallas.get(url);
  const promesa = (async () => {
    const r = await fetch(url, { signal: señal });
    if (!r.ok) throw new Error(`El IGN respondió ${r.status}`);
    const t = await r.text();
    if (/ServiceException|ExceptionReport/i.test(t.slice(0, 600))) throw new Error('El IGN devolvió un error de servicio');
    return leerArcGrid(t);
  })();
  cacheMallas.set(url, promesa);
  promesa.catch(() => cacheMallas.delete(url));
  return promesa;
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

// Divide los puntos en tramos cuya caja no supere CELDAS_MAX_LADO celdas
function trocear(puntos, celda) {
  const max = CELDAS_MAX_LADO * celda;
  const tramos = [];
  let t = null;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    if (t) {
      const o = Math.min(t.o, p.lon), e = Math.max(t.e, p.lon);
      const s = Math.min(t.s, p.lat), n = Math.max(t.n, p.lat);
      if (e - o <= max && n - s <= max) { Object.assign(t, { o, e, s, n }); t.fin = i; continue; }
      tramos.push(t);
    }
    t = { ini: i, fin: i, o: p.lon, e: p.lon, s: p.lat, n: p.lat };
  }
  if (t) tramos.push(t);
  return tramos.map((t) => ({ ...t, caja: [t.o - 3 * celda, t.s - 3 * celda, t.e + 3 * celda, t.n + 3 * celda] }));
}

async function cotasIGN(puntos, fuente, señal, alProgreso) {
  const tramos = trocear(puntos, fuente.celda);
  let hechos = 0;
  await enParalelo(tramos.map((t) => async () => {
    let malla = null;
    try { malla = await descargarMallaIGN(fuente, t.caja, señal); }
    catch (e) { if (e.name === 'AbortError') throw e; t.error = e.message; }
    for (let i = t.ini; i <= t.fin; i++) {
      const z = malla ? muestrearMalla(malla, puntos[i].lat, puntos[i].lon) : null;
      // El servicio devuelve 0 fuera de su cobertura (mar, Portugal, Francia…):
      // una cota exactamente 0 se trata como dato dudoso.
      if (z != null && z !== 0) { puntos[i].z = z; puntos[i].origen = fuente.id; }
    }
    alProgreso?.(++hechos / tramos.length);
  }), 4);
  return tramos.filter((t) => t.error).map((t) => t.error);
}

export async function cotasCopernicus(lista, señal) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += 100) lotes.push(lista.slice(i, i + 100));
  await enParalelo(lotes.map((lote) => async () => {
    const lat = lote.map((p) => p.lat.toFixed(5)).join(',');
    const lon = lote.map((p) => p.lon.toFixed(5)).join(',');
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { signal: señal });
    if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
    const j = await r.json();
    lote.forEach((p, k) => {
      const z = j.elevation?.[k];
      if (typeof z === 'number' && isFinite(z) && z > -1000) { p.z = z; p.origen = 'copernicus'; }
    });
  }), 2);
}

// ---------- Perfil completo entre A y B ----------
// modo: 'ign' (relieve real) o 'plano' (ejercicio teórico)
export async function obtenerPerfil(a, b, { modo = 'ign', señal, alProgreso } = {}) {
  const dKm = distanciaKm(a, b);
  const avisos = [];
  if (modo === 'plano' || dKm === 0) {
    const n = 241;
    const puntos = puntosTrayecto(a, b, n).map((p) => ({ ...p, z: 0, origen: 'plano' }));
    return { puntos, fuente: FUENTES.plano, paso: (dKm * 1000) / (n - 1), avisos, faltan: 0, porFuente: { plano: n } };
  }

  const fuente = dKm <= 80 ? FUENTES.mdt25 : FUENTES.mdt200;
  const n = Math.min(MAX_PUNTOS, Math.max(65, Math.ceil((dKm * 1000) / fuente.celdaM) + 1));
  const puntos = puntosTrayecto(a, b, n).map((p) => ({ ...p, z: null, origen: null }));

  let erroresIGN = [];
  try { erroresIGN = await cotasIGN(puntos, fuente, señal, alProgreso); }
  catch (e) { if (e.name === 'AbortError') throw e; erroresIGN = [e.message]; }
  if (erroresIGN.length) avisos.push(`No se pudo descargar parte del relieve del IGN (${erroresIGN[0]}).`);

  let sinCota = puntos.filter((p) => p.z == null);
  if (sinCota.length) {
    try { await cotasCopernicus(sinCota, señal); }
    catch (e) { if (e.name === 'AbortError') throw e; avisos.push(`El servicio de respaldo tampoco respondió (${e.message}).`); }
  }

  const porFuente = {};
  for (const p of puntos) { const k = p.origen || 'sin-dato'; porFuente[k] = (porFuente[k] || 0) + 1; }
  if (porFuente.copernicus) {
    avisos.push(`${porFuente.copernicus} de ${n} cotas no estaban en el MDT del IGN (fuera de cobertura o sin dato) y se han completado con ${FUENTES.copernicus.nombre}, de menor resolución (≈ 90 m).`);
  }
  const faltan = porFuente['sin-dato'] || 0;
  if (faltan) {
    avisos.push(`Faltan ${faltan} de ${n} cotas: esos tramos aparecen marcados en rojo bajo el perfil y no se tienen en cuenta en el despeje. Comprueba la conexión o el emplazamiento.`);
  }

  return { puntos, fuente, paso: (dKm * 1000) / (n - 1), avisos, faltan, porFuente };
}
