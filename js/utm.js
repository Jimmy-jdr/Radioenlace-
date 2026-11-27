/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// utm.js — Coordenadas geográficas ETRS89 → UTM ETRS89
// Elipsoide GRS80 (el de ETRS89). Proyección transversa de Mercator con
// las series de Krüger hasta sexto orden (Karney, 2011): error inferior
// al milímetro dentro del huso. Es la proyección de la cartografía
// oficial española (EPSG:25829, 25830, 25831).
// =====================================================================
const a = 6378137;                 // semieje mayor GRS80 (m)
const f = 1 / 298.257222101;       // aplanamiento GRS80
const k0 = 0.9996;                 // factor de escala en el meridiano central
const n = f / (2 - f);
const e = Math.sqrt(f * (2 - f));
const A = (a / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64 + n ** 6 / 256);
const alfa = [
  n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16 + (41 * n ** 4) / 180 - (127 * n ** 5) / 288 + (7891 * n ** 6) / 37800,
  (13 * n ** 2) / 48 - (3 * n ** 3) / 5 + (557 * n ** 4) / 1440 + (281 * n ** 5) / 630 - (1983433 * n ** 6) / 1935360,
  (61 * n ** 3) / 240 - (103 * n ** 4) / 140 + (15061 * n ** 5) / 26880 + (167603 * n ** 6) / 181440,
  (49561 * n ** 4) / 161280 - (179 * n ** 5) / 168 + (6601661 * n ** 6) / 7257600,
  (34729 * n ** 5) / 80640 - (3418889 * n ** 6) / 1995840,
  (212378941 * n ** 6) / 319334400,
];

export const husoUTM = (lon) => Math.min(60, Math.floor((lon + 180) / 6) + 1);
export const epsgETRS89 = (huso) => 25800 + huso; // 25829, 25830, 25831 en la Península

// Devuelve { x, y, huso } en metros (y con falso norte 10 000 km en el hemisferio sur)
export function aUTM(lat, lon, huso = husoUTM(lon)) {
  const phi = (lat * Math.PI) / 180;
  const lam = ((lon - (huso * 6 - 183)) * Math.PI) / 180;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi1 = Math.atan2(t, Math.cos(lam));
  const eta1 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let xi = xi1, eta = eta1;
  for (let j = 1; j <= 6; j++) {
    xi += alfa[j - 1] * Math.sin(2 * j * xi1) * Math.cosh(2 * j * eta1);
    eta += alfa[j - 1] * Math.cos(2 * j * xi1) * Math.sinh(2 * j * eta1);
  }
  return { x: 500000 + k0 * A * eta, y: k0 * A * xi + (lat < 0 ? 10000000 : 0), huso };
}
