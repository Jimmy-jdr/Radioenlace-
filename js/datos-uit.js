/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// datos-uit.js — Mapas climáticos de la UIT recortados a España (versión 1.5)
// Los valores salen sin modificar de los ficheros oficiales de cada
// Recomendación (solo se recortan a 26–45° N y 19° O–5° E, con una celda
// de margen); el recorte lo hace herramientas/recortar_mapas_uit.js.
//   P.530-19  LogK.csv y dN75.csv (0,25°)            multitrayecto
//   P.837-8   R001 (0,125°) y MT01…MT12 (0,25°)       lluvia
//   P.839-4   h0 (1,5°)                               altura de la lluvia
//   P.1510-1  T anual y mensual (0,75°)               temperatura en superficie
//   P.836-6   ρ y vsch al 50 % (1,125°) y TOPO (0,5°) vapor de agua
// Interpolación: bilineal (P.1144-13, anexo 1, § 1b) y bicúbica (§ 1c)
// para la topografía de la P.836.
// =====================================================================

let cache = null;
export async function cargarDatosUIT(url = new URL('../datos/uit-espana.json', import.meta.url)) {
  if (!cache) cache = fetch(url).then((r) => { if (!r.ok) throw new Error(`No se pudieron cargar los mapas de la UIT (${r.status}).`); return r.json(); })
    .catch((e) => { cache = null; throw e; });
  return cache;
}
// Para Node (pruebas y verificación): datos ya leídos
export function usarDatosUIT(d) { cache = Promise.resolve(d); }

export const LIMITES = { latMin: 26, latMax: 45, lonMin: -19, lonMax: 5 };
export const dentroDeEspana = (lat, lon) => lat >= LIMITES.latMin && lat <= LIMITES.latMax && lon >= LIMITES.lonMin && lon <= LIMITES.lonMax;

// Valor de la rejilla g en la fila i (latitud creciente) y la columna j (longitud creciente)
const celda = (g, i, j) => g.datos[i][j];

// Bilineal (P.1144, anexo 1, § 1b) sobre una rejilla regular {lat0, dlat, lon0, dlon, datos}
export function bilineal(g, lat, lon) {
  const r = (lat - g.lat0) / g.dlat, c = (lon - g.lon0) / g.dlon;
  const i = Math.min(Math.max(Math.floor(r), 0), g.nlat - 2), j = Math.min(Math.max(Math.floor(c), 0), g.nlon - 2);
  if (r < -1e-9 || c < -1e-9 || r > g.nlat - 1 + 1e-9 || c > g.nlon - 1 + 1e-9) throw new Error('Punto fuera del mapa recortado.');
  const dr = r - i, dc = c - j;
  return celda(g, i, j) * (1 - dr) * (1 - dc) + celda(g, i + 1, j) * dr * (1 - dc)
    + celda(g, i, j + 1) * (1 - dr) * dc + celda(g, i + 1, j + 1) * dr * dc;
}

// Bicúbica (P.1144, anexo 1, § 1c, núcleo con a = −0,5) sobre los 16 puntos vecinos
function nucleo(x) {
  const a = -0.5, d = Math.abs(x);
  if (d <= 1) return (a + 2) * d ** 3 - (a + 3) * d ** 2 + 1;
  if (d < 2) return a * d ** 3 - 5 * a * d ** 2 + 8 * a * d - 4 * a;
  return 0;
}
export function bicubica(g, lat, lon) {
  const r = (lat - g.lat0) / g.dlat, c = (lon - g.lon0) / g.dlon;
  const R = Math.floor(r), C = Math.floor(c);
  let s = 0;
  for (let i = R - 1; i <= R + 2; i++) {
    let fila = 0;
    for (let j = C - 1; j <= C + 2; j++) fila += celda(g, i, j) * nucleo(c - j);
    s += fila * nucleo(r - i);
  }
  return s;
}

// ---------- P.530-19 § 2.3.1: K y dN75 ----------
export const geoclimatico = (d, lat, lon) => ({ K: 10 ** bilineal(d.logK, lat, lon), logK: bilineal(d.logK, lat, lon), dN75: bilineal(d.dN75, lat, lon) });

// ---------- P.839-4: altura de la isoterma de 0 °C y de la lluvia ----------
// h0 (km s. n. m.) bilineal; hR = h0 + 0,36 km (ec. 1)
export function alturaLluvia(d, lat, lon) {
  const h0 = bilineal(d.h0, lat, lon);
  return { h0, hR: h0 + 0.36 };
}

// ---------- P.1510-1: temperatura media en superficie (K) ----------
export const temperaturaSuperficie = (d, lat, lon) => bilineal(d.T, lat, lon);

// ---------- P.837-8: intensidad de lluvia ----------
const DIAS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// R0,01 (mm/h) del mapa (nota 1 del anexo 1)
export const lluviaR001 = (d, lat, lon) => bilineal(d.R001, lat, lon);
// Probabilidad anual de lluvia P0 (%), pasos 4 a 7 del anexo 1 (ecs. 1–3),
// a partir de la lluvia media mensual MT (mm) y la temperatura media mensual T (K)
export function probabilidadDesdeMeses(MT, T) {
  let suma = 0;
  const meses = [];
  for (let ii = 0; ii < 12; ii++) {
    const t = T[ii] - 273.15;
    let r = t >= 0 ? 0.5874 * Math.exp(0.0883 * t) : 0.5874;            // ec. (1)
    let P0 = (100 * MT[ii]) / (24 * DIAS[ii] * r);                       // ec. (2)
    if (P0 > 70) { P0 = 70; r = (100 / 70) * MT[ii] / (24 * DIAS[ii]); }   // paso 6b
    suma += DIAS[ii] * P0;
    meses.push({ T: T[ii], MT: MT[ii], r, P0 });
  }
  return { P0: suma / 365.25, meses };                                   // ec. (3)
}
// Pasos 1 a 3: MT de los mapas de la P.837-8 y T de la P.1510-1 (bilineal)
export function probabilidadLluvia(d, lat, lon) {
  const MT = d.MT.meses.map((m) => bilineal({ ...d.MT, datos: m }, lat, lon));
  const T = d.Tmes.map((m) => bilineal({ ...d.T, datos: m }, lat, lon));
  return probabilidadDesdeMeses(MT, T);
}

// ---------- P.836-6: densidad de vapor de agua en superficie ----------
// ρ superada el 50 % del año a la altitud alt (km s. n. m.), anexo 1, pasos a)–f):
// ρi = ρ*i·exp(−(alt − alt_i)/vsch_i) en los cuatro nodos, con alt_i de la
// topografía TOPO_0DOT5 por interpolación bicúbica, y después bilineal.
export function vaporAgua(d, lat, lon, altKm) {
  const g = d.rho50, r = (lat - g.lat0) / g.dlat, c = (lon - g.lon0) / g.dlon;
  const i = Math.floor(r), j = Math.floor(c), dr = r - i, dc = c - j;
  const nodo = (ii, jj) => {
    const la = g.lat0 + ii * g.dlat, lo = g.lon0 + jj * g.dlon;
    const altI = bicubica(d.topo, la, lo);
    return g.datos[ii][jj] * Math.exp(-(altKm - altI) / d.vsch50.datos[ii][jj]);
  };
  return nodo(i, j) * (1 - dr) * (1 - dc) + nodo(i + 1, j) * dr * (1 - dc) + nodo(i, j + 1) * (1 - dr) * dc + nodo(i + 1, j + 1) * dr * dc;
}
