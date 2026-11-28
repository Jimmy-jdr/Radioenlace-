/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// p838.js — Atenuación específica debida a la lluvia (versión 1.5)
// Recomendación UIT-R P.838-3 (03/2005), vigente: γR = k·R^α (ec. 1), con
// k y α de las ecs. (2) y (3) (cuadros 1 a 4) y la combinación de las
// polarizaciones H y V de las ecs. (4) y (5). Válida de 1 a 1 000 GHz.
// Contrastada con el cuadro 5 de la propia Recomendación y con los
// ejemplos de validación de la UIT (CG-3M3J-13-ValEx Rev. 8.3.0, hoja
// «P.838-3 Sp.Att»).
// =====================================================================

// [aj, bj, cj] de cada término gaussiano, más m y c (cuadros 1 a 4)
const KH = { t: [[-5.33980, -0.10008, 1.13098], [-0.35351, 1.26970, 0.45400], [-0.23789, 0.86036, 0.15354], [-0.94158, 0.64552, 0.16817]], m: -0.18961, c: 0.71147 };
const KV = { t: [[-3.80595, 0.56934, 0.81061], [-3.44965, -0.22911, 0.51059], [-0.39902, 0.73042, 0.11899], [0.50167, 1.07319, 0.27195]], m: -0.16398, c: 0.63297 };
const AH = { t: [[-0.14318, 1.82442, -0.55187], [0.29591, 0.77564, 0.19822], [0.32177, 0.63773, 0.13164], [-5.37610, -0.96230, 1.47828], [16.1721, -3.29980, 3.43990]], m: 0.67849, c: -1.95537 };
const AV = { t: [[-0.07771, 2.33840, -0.76284], [0.56727, 0.95545, 0.54039], [-0.20238, 1.14520, 0.26809], [-48.2991, 0.791669, 0.116226], [48.5833, 0.791459, 0.116479]], m: -0.053739, c: 0.83433 };

const suma = (P, x) => P.t.reduce((s, [a, b, c]) => s + a * Math.exp(-(((x - b) / c) ** 2)), 0) + P.m * x + P.c;

/**
 * Coeficientes de la P.838-3.
 * @param fGHz  frecuencia (GHz), de 1 a 1 000
 * @param elevGrados  ángulo de elevación del trayecto θ (grados)
 * @param tauGrados   inclinación de la polarización respecto a la horizontal τ (0 = H, 90 = V, 45 = circular)
 * @returns {{kH, aH, kV, aV, k, alfa}}
 */
export function coeficientesLluvia(fGHz, elevGrados = 0, tauGrados = 0) {
  const x = Math.log10(fGHz);
  const kH = 10 ** suma(KH, x), kV = 10 ** suma(KV, x);
  const aH = suma(AH, x), aV = suma(AV, x);
  const th = (elevGrados * Math.PI) / 180, ta = (tauGrados * Math.PI) / 180;
  const c = Math.cos(th) ** 2 * Math.cos(2 * ta);
  const k = (kH + kV + (kH - kV) * c) / 2;                                   // ec. (4)
  const alfa = (kH * aH + kV * aV + (kH * aH - kV * aV) * c) / (2 * k);      // ec. (5)
  return { kH, aH, kV, aV, k, alfa };
}

/** Atenuación específica γR (dB/km) para la intensidad de lluvia R (mm/h). */
export function atenuacionEspecificaLluvia(fGHz, R, elevGrados = 0, tauGrados = 0) {
  const c = coeficientesLluvia(fGHz, elevGrados, tauGrados);
  return { ...c, gamma: c.k * R ** c.alfa };
}

/** τ de la polarización de la app: 'H' → 0°, 'V' → 90°. */
export const tauPolarizacion = (pol) => (pol === 'V' ? 90 : 0);
