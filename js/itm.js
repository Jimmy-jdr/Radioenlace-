/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// itm.js — Modelo de terreno irregular (ITM, Longley–Rice), modo punto a punto
//
// Traducción fiel, función a función, de la implementación de referencia
// del NTIA/ITS en C++ (https://github.com/NTIA/itm, versión 1.3,
// funcionalmente idéntica al ITM 1.2.2 en FORTRAN; revisión 62168e6 del
// 23-11-2026). Se conservan los nombres de las variables y el orden de las
// operaciones para poder comparar línea a línea. El código del NTIA es de
// dominio público (17 U.S.C. § 105).
//
// Bibliografía citada en los comentarios:
//   [TN101]       Rice, Longley, Norton y Barsis, NBS Technical Note 101 (1967)
//   [ERL 79-ITS 67] Longley y Rice, Prediction of tropospheric radio transmission
//                 loss over irregular terrain (1968)
//   [Algorithm]   Hufford, The ITS Irregular Terrain Model, version 1.2.2 Algorithm
//   [Vogler 1964] Vogler, Calculation of groundwave attenuation in the far diffraction region
//
// Verificado contra la referencia compilada: casos oficiales del NTIA
// (p2p.csv) y miles de casos aleatorios (verificacion/itm/).
//
// Unidades: alturas y distancias en metros, frecuencia en MHz, pérdidas en dB.
// =====================================================================

// ---------- Constantes (include/itm.h, Enums.h, Errors.h, Warnings.h) ----------
const PI = 3.1415926535897932384;
const SQRT2 = Math.sqrt(2);
const a_0__meter = 6370e3;
const a_9000__meter = 9000e3;
const THIRD = 1.0 / 3.0;
const MODE__P2P = 0;

export const CLIMAS = {
  1: 'Ecuatorial',
  2: 'Continental subtropical',
  3: 'Marítimo subtropical',
  4: 'Desierto',
  5: 'Continental templado',
  6: 'Marítimo templado sobre tierra',
  7: 'Marítimo templado sobre el mar',
};

export const MODOS_PROPAGACION = { 0: 'Sin determinar', 1: 'Línea de visión', 2: 'Difracción', 3: 'Dispersión troposférica' };

export const MODOS_VARIABILIDAD = { 0: 'Mensaje único', 1: 'Accidental', 2: 'Móvil', 3: 'Difusión' };

export const ERRORES = {
  1000: 'La altura de la antena A está fuera del rango del modelo (0,5–3000 m).',
  1001: 'La altura de la antena B está fuera del rango del modelo (0,5–3000 m).',
  1002: 'Clima radioeléctrico no válido.',
  1003: 'El porcentaje de tiempo debe estar entre 0 y 100 (sin incluirlos).',
  1004: 'El porcentaje de ubicaciones debe estar entre 0 y 100 (sin incluirlos).',
  1005: 'El porcentaje de situaciones debe estar entre 0 y 100 (sin incluirlos).',
  1008: 'La refractividad N₀ debe estar entre 250 y 400 unidades N.',
  1009: 'La frecuencia está fuera del rango del modelo (20 MHz – 20 GHz).',
  1010: 'Polarización no válida.',
  1011: 'La permitividad relativa debe ser mayor o igual que 1.',
  1012: 'La conductividad debe ser mayor que 0.',
  1013: 'La impedancia del suelo no es válida (parte imaginaria mayor que la real).',
  1014: 'Modo de variabilidad no válido.',
  1016: 'El radio terrestre efectivo calculado no es válido.',
  1017: 'La distancia del trayecto está fuera de rango.',
  1018: 'El parámetro de irregularidad Δh está fuera de rango.',
  1021: 'La refractividad en superficie calculada es demasiado pequeña.',
  1022: 'La refractividad en superficie calculada es demasiado grande.',
};

export const AVISOS = [
  [0x0001, 'La altura de la antena A está cerca de los límites del modelo (1–1000 m).'],
  [0x0002, 'La altura de la antena B está cerca de los límites del modelo (1–1000 m).'],
  [0x0004, 'La frecuencia está cerca de los límites del modelo (40 MHz – 10 GHz).'],
  [0x0008, 'La distancia está cerca de su límite superior (más de 1000 km).'],
  [0x0010, 'Distancia muy grande (más de 2000 km): resultado poco fiable.'],
  [0x0020, 'La distancia es pequeña frente a la diferencia de alturas efectivas.'],
  [0x0040, 'Trayecto de menos de 1 km: el modelo pierde precisión.'],
  [0x0080, 'El ángulo de horizonte en A es grande: la aproximación de ángulos pequeños puede fallar.'],
  [0x0100, 'El ángulo de horizonte en B es grande: la aproximación de ángulos pequeños puede fallar.'],
  [0x0200, 'La distancia al horizonte en A es menor que 1/10 de la de tierra lisa.'],
  [0x0400, 'La distancia al horizonte en B es menor que 1/10 de la de tierra lisa.'],
  [0x0800, 'La distancia al horizonte en A es mayor que 3 veces la de tierra lisa.'],
  [0x1000, 'La distancia al horizonte en B es mayor que 3 veces la de tierra lisa.'],
  [0x2000, 'Algún porcentaje de variabilidad está en la cola extrema de su distribución.'],
  [0x4000, 'La refractividad en superficie calculada es pequeña: interpretar con cautela.'],
];

export const textosAvisos = (w) => AVISOS.filter(([bit]) => w & bit).map(([, t]) => t);

// ---------- Equivalentes exactos de las macros y funciones de C ----------
const MAX = (x, y) => ((x > y) ? x : y);
const MIN = (x, y) => ((x < y) ? x : y);
const DIM = (x, y) => ((x > y) ? (x - y) : 0);
const fdim = (x, y) => ((x > y) ? (x - y) : 0);
const int = Math.trunc;                     // conversión (int) de C: trunca hacia cero
const float = Math.fround;                  // conversión (float) de C
const { sqrt, exp, log, log10, pow, abs, cos, sin } = Math;

// ---------- Números complejos (lo imprescindible de std::complex) ----------
const cx = (re, im = 0) => ({ re, im });
const cAbs = (z) => Math.hypot(z.re, z.im);
const cSub = (a, b) => cx(a.re - b.re, a.im - b.im);
const cAdd = (a, b) => cx(a.re + b.re, a.im + b.im);
const cMul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cScale = (a, k) => cx(a.re * k, a.im * k);
function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
function cSqrt(z) {                          // rama principal, como std::sqrt
  if (z.re === 0 && z.im === 0) return cx(0, z.im);
  const t = sqrt(2 * (cAbs(z) + abs(z.re)));
  const u = t / 2;
  return z.re > 0 ? cx(u, z.im / t) : cx(abs(z.im) / t, z.im < 0 ? -u : u);
}

// =====================================================================
// FreeSpaceLoss.cpp
export function FreeSpaceLoss(d__meter, f__mhz) {
  return 32.45 + 20.0 * log10(f__mhz) + 20.0 * log10(d__meter / 1000.0);
}

// FresnelIntegral.cpp
function FresnelIntegral(v2) {
  // Nota: v2 es v², así que 5,76 equivale a comparar v con 2,4
  if (v2 < 5.76)
    return 6.02 + 9.11 * sqrt(v2) - 1.27 * v2;      // [TN101v2, Eqn III.24b]
  return 12.953 + 10 * log10(v2);                   // [TN101v2, Eqn III.24c]
}

// TerrainRoughness.cpp — [ERL 79-ITS 67, Eqn 3], distancia en metros
function TerrainRoughness(d__meter, delta_h__meter) {
  return delta_h__meter * (1.0 - 0.8 * exp(-d__meter / 50e3));
}

// SigmaHFunction.cpp — [ERL 79-ITS 67, Eqn 3.6a]
function SigmaHFunction(delta_h__meter) {
  return 0.78 * delta_h__meter * exp(-0.5 * pow(delta_h__meter, 0.25));
}

// InverseComplementaryCumulativeDistributionFunction.cpp
function InverseComplementaryCumulativeDistributionFunction(q) {
  const C_0 = 2.515516, C_1 = 0.802853, C_2 = 0.010328;
  const D_1 = 1.432788, D_2 = 0.189269, D_3 = 0.001308;
  let x = q;
  if (q > 0.5) x = 1.0 - x;
  const T_x = sqrt(-2.0 * log(x));
  const zeta_x = ((C_2 * T_x + C_1) * T_x + C_0) / (((D_3 * T_x + D_2) * T_x + D_1) * T_x + 1.0);
  let Q_q = T_x - zeta_x;
  if (q > 0.5) Q_q = -Q_q;
  return Q_q;
}

// ValidateInputs.cpp
function ValidateInputs(h_tx__meter, h_rx__meter, climate, time, location, situation, N_0, f__mhz, pol, epsilon, sigma, mdvar, W) {
  if (h_tx__meter < 1.0 || h_tx__meter > 1000.0) W.w |= 0x0001;
  if (h_tx__meter < 0.5 || h_tx__meter > 3000.0) return 1000;
  if (h_rx__meter < 1.0 || h_rx__meter > 1000.0) W.w |= 0x0002;
  if (h_rx__meter < 0.5 || h_rx__meter > 3000.0) return 1001;
  if (![1, 2, 3, 4, 5, 6, 7].includes(climate)) return 1002;
  if (N_0 < 250 || N_0 > 400) return 1008;
  if (f__mhz < 40.0 || f__mhz > 10000.0) W.w |= 0x0004;
  if (f__mhz < 20 || f__mhz > 20000) return 1009;
  if (pol !== 0 && pol !== 1) return 1010;
  if (epsilon < 1) return 1011;
  if (sigma <= 0) return 1012;
  if (!Number.isInteger(mdvar) || (mdvar < 0) || (mdvar > 3 && mdvar < 10) || (mdvar > 13 && mdvar < 20) ||
      (mdvar > 23 && mdvar < 30) || (mdvar > 33)) return 1014;
  if (situation <= 0 || situation >= 100) return 1005;
  if (time <= 0 || time >= 100) return 1003;
  if (location <= 0 || location >= 100) return 1004;
  return 0;
}

// InitializePointToPoint.cpp
function InitializePointToPoint(f__mhz, h_sys__meter, N_0, pol, epsilon, sigma) {
  const gamma_a = 157e-9;                                     // curvatura de la Tierra real, ~1/6370 km
  let N_s;
  if (h_sys__meter === 0.0) N_s = N_0;
  else N_s = N_0 * exp(-h_sys__meter / 9460.0);               // [TN101, Eq 4.3]
  const gamma_e = gamma_a * (1.0 - 0.04665 * exp(N_s / 179.3)); // [TN101, Eq 4.4]
  const ep_r = cx(epsilon, 18000 * sigma / f__mhz);           // permitividad relativa compleja
  let Z_g = cSqrt(cSub(ep_r, cx(1.0)));                        // impedancia del suelo (pol. horizontal)
  if (pol === 1) Z_g = cDiv(Z_g, ep_r);                         // corrección para pol. vertical
  return { Z_g, gamma_e, N_s };
}

// LinearLeastSquaresFit.cpp
function LinearLeastSquaresFit(pfl, d_start, d_end) {
  const np = int(pfl[0]);
  let i_start = int(fdim(d_start / pfl[1], 0.0));
  let i_end = np - int(fdim(np, d_end / pfl[1]));
  if (i_end <= i_start) {
    i_start = int(fdim(i_start, 1.0));
    i_end = np - int(fdim(np, i_end + 1.0));
  }
  const x_length = i_end - i_start;
  let mid_shifted_index = -0.5 * x_length;
  const mid_shifted_end = i_end + mid_shifted_index;
  let sum_y = 0.5 * (pfl[i_start + 2] + pfl[i_end + 2]);
  let scaled_sum_y = 0.5 * (pfl[i_start + 2] - pfl[i_end + 2]) * mid_shifted_index;
  for (let i = 2; i <= x_length; i++) {
    i_start++;
    mid_shifted_index++;
    sum_y += pfl[i_start + 2];
    scaled_sum_y += pfl[i_start + 2] * mid_shifted_index;
  }
  sum_y = sum_y / x_length;
  scaled_sum_y = scaled_sum_y * 12.0 / ((x_length * x_length + 2.0) * x_length);
  return [sum_y - scaled_sum_y * mid_shifted_end, sum_y + scaled_sum_y * (np - mid_shifted_end)];
}

// ComputeDeltaH.cpp — parámetro de irregularidad del terreno Δh
function ComputeDeltaH(pfl, d_start__meter, d_end__meter) {
  const s = new Float64Array(247);
  const np = int(pfl[0]);
  let x_start = d_start__meter / pfl[1];
  let x_end = d_end__meter / pfl[1];
  if (x_end - x_start < 2.0) return 0;
  let p10 = int(0.1 * (x_end - x_start + 8.0));
  p10 = MIN(MAX(4, p10), 25);
  const n = 10 * p10 - 5;
  const p90 = n - p10;
  const np_s = n - 1;
  s[0] = np_s;
  s[1] = 1.0;
  x_end = (x_end - x_start) / np_s;
  let i = int(x_start);
  x_start -= float(i + 1.0);
  for (let j = 0; j < n; j++) {
    while (x_start > 0.0 && (i + 1) < np) {
      x_start--;
      i++;
    }
    s[j + 2] = pfl[i + 3] + (pfl[i + 3] - pfl[i + 2]) * x_start;
    x_start += x_end;
  }
  let [fit_y1, fit_y2] = LinearLeastSquaresFit(s, 0.0, np_s);
  fit_y2 = (fit_y2 - fit_y1) / np_s;
  const diffs = [];
  for (let j = 0; j < n; j++) {
    diffs.push(s[j + 2] - fit_y1);
    fit_y1 += fit_y2;
  }
  // std::nth_element con std::greater: valor que ocuparía cada posición en orden descendente
  diffs.sort((x, y) => y - x);
  const q10 = diffs[p10 - 1];
  const q90 = diffs[p90];
  const delta_h_d__meter = q10 - q90;
  return delta_h_d__meter / (1.0 - 0.8 * exp(-(d_end__meter - d_start__meter) / 50e3)); // [ERL 79-ITS 67, Eqn 3] invertida
}

// FindHorizons.cpp
function FindHorizons(pfl, a_e__meter, h__meter) {
  const np = int(pfl[0]);
  const xi = pfl[1];
  const d__meter = pfl[0] * pfl[1];
  const z_tx__meter = pfl[2] + h__meter[0];
  const z_rx__meter = pfl[np + 2] + h__meter[1];
  const theta_hzn = [
    (z_rx__meter - z_tx__meter) / d__meter - d__meter / (2 * a_e__meter),   // [TN101, Eq 6.15]
    -(z_rx__meter - z_tx__meter) / d__meter - d__meter / (2 * a_e__meter),
  ];
  const d_hzn__meter = [d__meter, d__meter];
  let d_tx__meter = 0.0;
  let d_rx__meter = d__meter;
  for (let i = 1; i < np; i++) {
    d_tx__meter = d_tx__meter + xi;
    d_rx__meter = d_rx__meter - xi;
    const theta_tx = (pfl[i + 2] - z_tx__meter) / d_tx__meter - d_tx__meter / (2 * a_e__meter);
    const theta_rx = -(z_rx__meter - pfl[i + 2]) / d_rx__meter - d_rx__meter / (2 * a_e__meter);
    if (theta_tx > theta_hzn[0]) { theta_hzn[0] = theta_tx; d_hzn__meter[0] = d_tx__meter; }
    if (theta_rx > theta_hzn[1]) { theta_hzn[1] = theta_rx; d_hzn__meter[1] = d_rx__meter; }
  }
  return { theta_hzn, d_hzn__meter };
}

// QuickPfl.cpp
function QuickPfl(pfl, gamma_e, h__meter) {
  let q;
  const d__meter = pfl[0] * pfl[1];
  const np = int(pfl[0]);
  const a_e__meter = 1 / gamma_e;
  const { theta_hzn, d_hzn__meter } = FindHorizons(pfl, a_e__meter, h__meter);
  const h_e__meter = [0, 0];
  // [Hufford, 1982] p. 25: el terreno se considera a partir de unas 15 veces la altura de la torre
  const d_start__meter = MIN(15.0 * h__meter[0], 0.1 * d_hzn__meter[0]);
  const d_end__meter = d__meter - MIN(15.0 * h__meter[1], 0.1 * d_hzn__meter[1]);
  const delta_h__meter = ComputeDeltaH(pfl, d_start__meter, d_end__meter);

  if (d_hzn__meter[0] + d_hzn__meter[1] > 1.5 * d__meter) {
    // horizontes combinados al menos un 50 % mayores que el trayecto: claramente en visión directa
    const [fit_tx, fit_rx] = LinearLeastSquaresFit(pfl, d_start__meter, d_end__meter);
    h_e__meter[0] = h__meter[0] + fdim(pfl[2], fit_tx);
    h_e__meter[1] = h__meter[1] + fdim(pfl[np + 2], fit_rx);
    for (let i = 0; i < 2; i++)
      d_hzn__meter[i] = sqrt(2.0 * h_e__meter[i] * a_e__meter) * exp(-0.07 * sqrt(delta_h__meter / MAX(h_e__meter[i], 5.0)));
    const combined_horizons__meter = d_hzn__meter[0] + d_hzn__meter[1];
    if (combined_horizons__meter <= d__meter) {
      q = pow(d__meter / combined_horizons__meter, 2);
      for (let i = 0; i < 2; i++) {
        h_e__meter[i] = h_e__meter[i] * q;
        d_hzn__meter[i] = sqrt(2.0 * h_e__meter[i] * a_e__meter) * exp(-0.07 * sqrt(delta_h__meter / MAX(h_e__meter[i], 5.0)));
      }
    }
    for (let i = 0; i < 2; i++) {
      q = sqrt(2.0 * h_e__meter[i] * a_e__meter);
      theta_hzn[i] = (0.65 * delta_h__meter * (q / d_hzn__meter[i] - 1.0) - 2.0 * h_e__meter[i]) / q;
    }
  } else {
    const [fit_tx] = LinearLeastSquaresFit(pfl, d_start__meter, 0.9 * d_hzn__meter[0]);
    h_e__meter[0] = h__meter[0] + fdim(pfl[2], fit_tx);
    const [, fit_rx] = LinearLeastSquaresFit(pfl, d__meter - 0.9 * d_hzn__meter[1], d_end__meter);
    h_e__meter[1] = h__meter[1] + fdim(pfl[np + 2], fit_rx);
  }
  return { theta_hzn, d_hzn__meter, h_e__meter, delta_h__meter, d__meter, d_start__meter, d_end__meter };
}

// KnifeEdgeDiffraction.cpp
function KnifeEdgeDiffraction(d__meter, f__mhz, a_e__meter, theta_los, d_hzn__meter) {
  const d_ML__meter = d_hzn__meter[0] + d_hzn__meter[1];
  const theta_nlos = d__meter / a_e__meter - theta_los;              // [Algorithm, Eqn 4.12]
  const d_nlos__meter = d__meter - d_ML__meter;
  // 1/(4π) = 0,0795775 [TN101, Eqn I.7]
  const v_1 = 0.0795775 * (f__mhz / 47.7) * pow(theta_nlos, 2) * d_hzn__meter[0] * d_nlos__meter / (d_nlos__meter + d_hzn__meter[0]);
  const v_2 = 0.0795775 * (f__mhz / 47.7) * pow(theta_nlos, 2) * d_hzn__meter[1] * d_nlos__meter / (d_nlos__meter + d_hzn__meter[1]);
  return FresnelIntegral(v_1) + FresnelIntegral(v_2);                 // [TN101, Eqn I.1]
}

// SmoothEarthDiffraction.cpp
function HeightFunction(x__km, K) {
  let w, result;
  if (x__km < 200.0) {
    w = -log(K);
    if (K < 1e-5 || x__km * pow(w, 3) > 5495.0) {
      result = -117.0;
      if (x__km > 1.0) result = 17.372 * log(x__km) + result;
    } else {
      result = 2.5e-5 * pow(x__km, 2) / K - 8.686 * w - 15.0;
    }
  } else {
    result = 0.05751 * x__km - 4.343 * log(x__km);
    if (x__km < 2000) {
      w = 0.0134 * x__km * exp(-0.005 * x__km);
      result = (1.0 - w) * result + w * (17.372 * log(x__km) - 117.0);
    }
  }
  return result;
}

function SmoothEarthDiffraction(d__meter, f__mhz, a_e__meter, theta_los, d_hzn__meter, h_e__meter, Z_g) {
  const a__meter = [0, 0, 0], d__km = [0, 0, 0], K = [0, 0, 0], B_0 = [0, 0, 0], x__km = [0, 0, 0], C_0 = [0, 0, 0];
  const theta_nlos = d__meter / a_e__meter - theta_los;                       // [Algorithm, Eqn 4.12]
  const d_ML__meter = d_hzn__meter[0] + d_hzn__meter[1];
  a__meter[0] = (d__meter - d_ML__meter) / (d__meter / a_e__meter - theta_los);
  a__meter[1] = 0.5 * pow(d_hzn__meter[0], 2) / h_e__meter[0];                // [Vogler 1964, Eqn 3]
  a__meter[2] = 0.5 * pow(d_hzn__meter[1], 2) / h_e__meter[1];
  d__km[0] = (a__meter[0] * theta_nlos) / 1000.0;
  d__km[1] = d_hzn__meter[0] / 1000.0;
  d__km[2] = d_hzn__meter[1] / 1000.0;
  const absZ = cAbs(Z_g);
  for (let i = 0; i < 3; i++) {
    C_0[i] = pow((4.0 / 3.0) * a_0__meter / a__meter[i], THIRD);              // [Vogler 1964, Eqn 2]
    K[i] = 0.017778 * C_0[i] * pow(f__mhz, -THIRD) / absZ;                    // [Vogler 1964, Eqn 6a / 7a]
    B_0[i] = 1.607 - K[i];                                                     // [Vogler 1964, Fig 4]
  }
  x__km[1] = B_0[1] * pow(C_0[1], 2) * pow(f__mhz, THIRD) * d__km[1];
  x__km[2] = B_0[2] * pow(C_0[2], 2) * pow(f__mhz, THIRD) * d__km[2];
  x__km[0] = B_0[0] * pow(C_0[0], 2) * pow(f__mhz, THIRD) * d__km[0] + x__km[1] + x__km[2];
  const F_x0 = HeightFunction(x__km[1], K[1]);
  const F_x1 = HeightFunction(x__km[2], K[2]);
  const G_x__db = 0.05751 * x__km[0] - 10.0 * log10(x__km[0]);                // [TN101, Eqn 8.4]
  return G_x__db - F_x0 - F_x1 - 20;                                          // [Algorithm, Eqn 4.20]
}

// DiffractionLoss.cpp
function DiffractionLoss(d__meter, d_hzn__meter, h_e__meter, Z_g, a_e__meter, delta_h__meter, h__meter, mode, theta_los, d_sML__meter, f__mhz) {
  const A_k__db = KnifeEdgeDiffraction(d__meter, f__mhz, a_e__meter, theta_los, d_hzn__meter);
  const A_se__db = SmoothEarthDiffraction(d__meter, f__mhz, a_e__meter, theta_los, d_hzn__meter, h_e__meter, Z_g);
  // rugosidad con d_sML [ERL 79-ITS 67, p. 3-13]
  const delta_h_dsML__meter = TerrainRoughness(d_sML__meter, delta_h__meter);
  const sigma_h_d__meter = SigmaHFunction(delta_h_dsML__meter);
  // factor de obstáculos [ERL 79-ITS 67, Eqn 3.38c]
  const A_fo__db = MIN(15.0, 5 * log10(1.0 + 1e-5 * h__meter[0] * h__meter[1] * f__mhz * sigma_h_d__meter));
  const delta_h_d__meter = TerrainRoughness(d__meter, delta_h__meter);
  let q = h__meter[0] * h__meter[1];
  const qk = h_e__meter[0] * h_e__meter[1] - q;
  if (mode === MODE__P2P) q += 10.0;                                          // C ≈ 10 [ERL 79-ITS 67, p. 3-8]
  const term1 = sqrt(1.0 + qk / q);                                           // [ERL 79-ITS 67, Eqn 3.23]
  const d_ML__meter = d_hzn__meter[0] + d_hzn__meter[1];
  q = (term1 + (-theta_los * a_e__meter + d_ML__meter) / d__meter) * MIN(delta_h_d__meter * f__mhz / 47.7, 6283.2);
  const w = 25.1 / (25.1 + sqrt(q));                                          // [ERL 79-ITS 67, Eqn 3.23]
  return w * A_se__db + (1.0 - w) * A_k__db + A_fo__db;
}

// LineOfSightLoss.cpp
function LineOfSightLoss(d__meter, h_e__meter, Z_g, delta_h__meter, M_d, A_d0, d_sML__meter, f__mhz) {
  const delta_h_d__meter = TerrainRoughness(d__meter, delta_h__meter);
  const sigma_h_d__meter = SigmaHFunction(delta_h_d__meter);
  const wn = f__mhz / 47.7;                                                   // número de onda, k
  const sin_psi = (h_e__meter[0] + h_e__meter[1]) / sqrt(pow(d__meter, 2) + pow(h_e__meter[0] + h_e__meter[1], 2)); // [Algorithm, Eqn 4.46]
  let R_e = cScale(cDiv(cSub(cx(sin_psi), Z_g), cAdd(cx(sin_psi), Z_g)), exp(-MIN(10.0, wn * sigma_h_d__meter * sin_psi))); // [Algorithm, Eqn 4.47]
  const q = pow(R_e.re, 2) + pow(R_e.im, 2);                                  // [Algorithm, Eqn 4.48]
  if (q < 0.25 || q < sin_psi) R_e = cScale(R_e, sqrt(sin_psi / q));
  let delta_phi = wn * 2.0 * h_e__meter[0] * h_e__meter[1] / d__meter;        // [Algorithm, Eqn 4.49]
  if (delta_phi > PI / 2.0) delta_phi = PI - pow(PI / 2.0, 2) / delta_phi;   // [Algorithm, Eqn 4.50]
  const rr = cAdd(cx(cos(delta_phi), -sin(delta_phi)), R_e);
  const A_t__db = -10 * log10(pow(rr.re, 2) + pow(rr.im, 2));                 // atenuación de dos rayos
  const A_d__db = M_d * d__meter + A_d0;                                      // difracción extendida
  const w = 1 / (1 + f__mhz * delta_h__meter / MAX(10e3, d_sML__meter));
  return w * A_t__db + (1 - w) * A_d__db;
}

// TroposcatterLoss.cpp + H0Function.cpp
function FFunction(td) {
  const a = [133.4, 104.6, 71.8], b = [0.332e-3, 0.212e-3, 0.157e-3], c = [-10, -2.5, 5]; // [Algorithm, 6.9]
  let i;
  if (td <= 10e3) i = 0;
  else if (td <= 70e3) i = 1;
  else i = 2;
  return a[i] + b[i] * td + c[i] * log10(td);
}

function H0Curve(j, r) {
  const a = [25.0, 80.0, 177.0, 395.0, 705.0], b = [24.0, 45.0, 68.0, 80.0, 105.0]; // [Algorithm, 6.13]
  return 10 * log10(1 + a[j] * pow(1 / r, 4) + b[j] * pow(1.0 / r, 2));
}

function H0Function(r, eta_s) {
  eta_s = MIN(MAX(eta_s, 1), 5);
  const i = int(eta_s);
  const q = eta_s - i;
  let result = H0Curve(i - 1, r);
  if (q !== 0.0) result = (1.0 - q) * result + q * H0Curve(i, r);
  return result;
}

function TroposcatterLoss(d__meter, theta_hzn, d_hzn__meter, h_e__meter, a_e__meter, N_s, f__mhz, theta_los, H) {
  let H_0;
  const wn = f__mhz / 47.7;
  if (H.h0 > 15.0) H_0 = H.h0;                                                // atajo si ya supera 15 dB
  else {
    let ad = d_hzn__meter[0] - d_hzn__meter[1];
    let rr = h_e__meter[1] / h_e__meter[0];
    if (ad < 0.0) { ad = -ad; rr = 1.0 / rr; }
    const theta = theta_hzn[0] + theta_hzn[1] + d__meter / a_e__meter;       // distancia angular (rad)
    const r_1 = 2.0 * wn * theta * h_e__meter[0];                              // [TN101, Eqn 9.4a]
    const r_2 = 2.0 * wn * theta * h_e__meter[1];
    if (r_1 < 0.2 && r_2 < 0.2) return 1001;                                   // A_scat no definida [Algorithm, p. 11]
    let s = (d__meter - ad) / (d__meter + ad);                                 // asimetría
    const q = MIN(MAX(0.1, rr / s), 10.0);                                     // [TN101, Eqn 9.5]
    s = MAX(0.1, s);
    const h_0__meter = (d__meter - ad) * (d__meter + ad) * theta * 0.25 / d__meter; // [Algorithm, 4.66]
    const Z_0__meter = 1.7556e3, Z_1__meter = 8.0e3;                           // [Algorithm, 4.67]
    const eta_s = (h_0__meter / Z_0__meter) * (1.0 + (0.031 - N_s * 2.32e-3 + pow(N_s, 2) * 5.67e-6) * exp(-pow(MIN(1.7, h_0__meter / Z_1__meter), 6))); // [TN101 Eqn 9.3a]
    const H_00 = (H0Function(r_1, eta_s) + H0Function(r_2, eta_s)) / 2;
    const Delta_H_0 = MIN(H_00, 6.0 * (0.6 - log10(MAX(eta_s, 1.0))) * log10(s) * log10(q));
    H_0 = H_00 + Delta_H_0;                                                    // [TN101, Eqn 9.5]
    H_0 = MAX(H_0, 0.0);
    if (eta_s < 1.0)
      H_0 = eta_s * H_0 + (1.0 - eta_s) * 10 * log10(pow((1.0 + SQRT2 / r_1) * (1.0 + SQRT2 / r_2), 2) * (r_1 + r_2) / (r_1 + r_2 + 2 * SQRT2));
    if (H_0 > 15.0 && H.h0 >= 0.0) H_0 = H.h0;                                 // [Algorithm, p. 12]
  }
  H.h0 = H_0;
  const th = d__meter / a_e__meter - theta_los;
  const D_0__meter = 40e3;                                                     // [Algorithm, 6.8]
  const H__meter = 47.7;                                                       // [Algorithm, 4.63]
  return FFunction(th * d__meter) + 10 * log10(wn * H__meter * pow(th, 4)) - 0.1 * (N_s - 301.0) * exp(-th * d__meter / D_0__meter) + H_0;
}

// LongleyRice.cpp — atenuación de referencia A_ref
function LongleyRice(theta_hzn, f__mhz, Z_g, d_hzn__meter, h_e__meter, gamma_e, N_s, delta_h__meter, h__meter, d__meter, mode, W) {
  const a_e__meter = 1 / gamma_e;
  const d_hzn_s__meter = [sqrt(2.0 * h_e__meter[0] * a_e__meter), sqrt(2.0 * h_e__meter[1] * a_e__meter)];
  const d_sML__meter = d_hzn_s__meter[0] + d_hzn_s__meter[1];      // máx. visión directa en tierra lisa
  const d_ML__meter = d_hzn__meter[0] + d_hzn__meter[1];            // máx. visión directa del trayecto real
  const theta_los = -MAX(theta_hzn[0] + theta_hzn[1], -d_ML__meter / a_e__meter);

  if (abs(theta_hzn[0]) > 200e-3) W.w |= 0x0080;
  if (abs(theta_hzn[1]) > 200e-3) W.w |= 0x0100;
  if (d_hzn__meter[0] < 0.1 * d_hzn_s__meter[0]) W.w |= 0x0200;
  if (d_hzn__meter[1] < 0.1 * d_hzn_s__meter[1]) W.w |= 0x0400;
  if (d_hzn__meter[0] > 3.0 * d_hzn_s__meter[0]) W.w |= 0x0800;
  if (d_hzn__meter[1] > 3.0 * d_hzn_s__meter[1]) W.w |= 0x1000;

  if (N_s < 150) return { error: 1021 };
  if (N_s > 400) return { error: 1022 };
  if (N_s < 250) W.w |= 0x4000;
  if (a_e__meter < 4000000 || a_e__meter > 13333333) return { error: 1016 };
  if (Z_g.re <= abs(Z_g.im)) return { error: 1013 };

  // dos distancias muy dentro de la región de difracción
  const d_3__meter = MAX(d_sML__meter, d_ML__meter + 5.0 * pow(pow(a_e__meter, 2) / f__mhz, 1.0 / 3.0));
  const d_4__meter = d_3__meter + 10.0 * pow(pow(a_e__meter, 2) / f__mhz, 1.0 / 3.0);
  const A_3__db = DiffractionLoss(d_3__meter, d_hzn__meter, h_e__meter, Z_g, a_e__meter, delta_h__meter, h__meter, mode, theta_los, d_sML__meter, f__mhz);
  const A_4__db = DiffractionLoss(d_4__meter, d_hzn__meter, h_e__meter, Z_g, a_e__meter, delta_h__meter, h__meter, mode, theta_los, d_sML__meter, f__mhz);
  const M_d = (A_4__db - A_3__db) / (d_4__meter - d_3__meter);
  const A_d0__db = A_3__db - M_d * d_3__meter;

  const d_min__meter = abs(h_e__meter[0] - h_e__meter[1]) / 200e-3;
  if (d__meter < d_min__meter) W.w |= 0x0020;
  if (d__meter < 1e3) W.w |= 0x0040;
  if (d__meter > 1000e3) W.w |= 0x0008;
  if (d__meter > 2000e3) W.w |= 0x0010;

  let A_ref__db, propmode, coef;
  if (d__meter < d_sML__meter) {
    const A_sML__db = d_sML__meter * M_d + A_d0__db;
    let d_0__meter = 0.04 * f__mhz * h_e__meter[0] * h_e__meter[1];           // [ERL 79-ITS 67, Eqn 3.16a]
    let d_1__meter;
    if (A_d0__db >= 0.0) {
      d_0__meter = MIN(d_0__meter, 0.5 * d_ML__meter);
      d_1__meter = d_0__meter + 0.25 * (d_ML__meter - d_0__meter);              // [ERL 79-ITS 67, Eqn 3.16d]
    } else {
      d_1__meter = MAX(-A_d0__db / M_d, 0.25 * d_ML__meter);
    }
    const A_1__db = LineOfSightLoss(d_1__meter, h_e__meter, Z_g, delta_h__meter, M_d, A_d0__db, d_sML__meter, f__mhz);
    let flag = false;
    let kHat_1__db_per_meter = 0;
    let kHat_2__db_per_meter = 0;
    if (d_0__meter < d_1__meter) {
      const A_0__db = LineOfSightLoss(d_0__meter, h_e__meter, Z_g, delta_h__meter, M_d, A_d0__db, d_sML__meter, f__mhz);
      const q = log(d_sML__meter / d_0__meter);
      kHat_2__db_per_meter = MAX(0.0, ((d_sML__meter - d_0__meter) * (A_1__db - A_0__db) - (d_1__meter - d_0__meter) * (A_sML__db - A_0__db)) /
        ((d_sML__meter - d_0__meter) * log(d_1__meter / d_0__meter) - (d_1__meter - d_0__meter) * q)); // [ERL 79-ITS 67, Eqn 3.20]
      flag = A_d0__db > 0.0 || kHat_2__db_per_meter > 0.0;
      if (flag) {
        kHat_1__db_per_meter = (A_sML__db - A_0__db - kHat_2__db_per_meter * q) / (d_sML__meter - d_0__meter); // [Eqn 3.21]
        if (kHat_1__db_per_meter < 0.0) {
          kHat_1__db_per_meter = 0.0;
          kHat_2__db_per_meter = DIM(A_sML__db, A_0__db) / q;
          if (kHat_2__db_per_meter === 0.0) kHat_1__db_per_meter = M_d;
        }
      }
    }
    if (!flag) {
      kHat_1__db_per_meter = DIM(A_sML__db, A_1__db) / (d_sML__meter - d_1__meter);
      kHat_2__db_per_meter = 0.0;
      if (kHat_1__db_per_meter === 0.0) kHat_1__db_per_meter = M_d;
    }
    const A_o__db = A_sML__db - kHat_1__db_per_meter * d_sML__meter - kHat_2__db_per_meter * log(d_sML__meter);
    A_ref__db = A_o__db + kHat_1__db_per_meter * d__meter + kHat_2__db_per_meter * log(d__meter); // [Eqn 3.19]
    propmode = 1;
    coef = { A_o__db, kHat_1__db_per_meter, kHat_2__db_per_meter };
  } else {
    const d_5__meter = d_ML__meter + 200e3;
    const d_6__meter = d_ML__meter + 400e3;
    const H = { h0: -1 };
    const A_6__db = TroposcatterLoss(d_6__meter, theta_hzn, d_hzn__meter, h_e__meter, a_e__meter, N_s, f__mhz, theta_los, H);
    const A_5__db = TroposcatterLoss(d_5__meter, theta_hzn, d_hzn__meter, h_e__meter, a_e__meter, N_s, f__mhz, theta_los, H);
    let M_s, A_s0__db, d_x__meter;
    if (A_5__db < 1000.0) {
      M_s = (A_6__db - A_5__db) / 200e3;
      d_x__meter = MAX(MAX(d_sML__meter, d_ML__meter + 1.088 * pow(pow(a_e__meter, 2) / f__mhz, 1.0 / 3.0) * log(f__mhz)),
        (A_5__db - A_d0__db - M_s * d_5__meter) / (M_d - M_s));
      A_s0__db = (M_d - M_s) * d_x__meter + A_d0__db;
    } else {
      M_s = M_d;
      A_s0__db = A_d0__db;
      d_x__meter = 10e6;
    }
    coef = { M_s, A_s0__db, d_x__meter };
    if (d__meter > d_x__meter) { A_ref__db = M_s * d__meter + A_s0__db; propmode = 3; }
    else { A_ref__db = M_d * d__meter + A_d0__db; propmode = 2; }
  }
  const A_ref_sin_limitar__db = A_ref__db;
  A_ref__db = MAX(A_ref__db, 0.0);                                              // nunca negativa
  return { error: 0, A_ref__db, propmode, A_ref_sin_limitar__db,
    coef: { ...coef, M_d, A_d0__db, d_sML__meter, d_ML__meter, theta_los, a_e__meter } };
}

// Variability.cpp
function Curve(c1, c2, x1, x2, x3, d_e__meter) {
  return (c1 + c2 / (1.0 + pow((d_e__meter - x2) / x3, 2))) * (pow(d_e__meter / x1, 2)) / (1.0 + (pow(d_e__meter / x1, 2)));
}

function Variability(time, location, situation, h_e__meter, delta_h__meter, f__mhz, d__meter, A_ref__db, climate, mdvar, W) {
  // valores asintóticos de [TN101, Fig 10.13] para cada clima
  const all_year = [
    [-9.67, -0.62, 1.26, -9.21, -0.62, -0.39, 3.15],
    [12.7, 9.19, 15.5, 9.05, 9.19, 2.86, 857.9],
    [144.9e3, 228.9e3, 262.6e3, 84.1e3, 228.9e3, 141.7e3, 2222.e3],
    [190.3e3, 205.2e3, 185.2e3, 101.1e3, 205.2e3, 315.9e3, 164.8e3],
    [133.8e3, 143.6e3, 99.8e3, 98.6e3, 143.6e3, 167.4e3, 116.3e3],
  ];
  const bsm1 = [2.13, 2.66, 6.11, 1.98, 2.68, 6.86, 8.51];
  const bsm2 = [159.5, 7.67, 6.65, 13.11, 7.16, 10.38, 169.8];
  const xsm1 = [762.2e3, 100.4e3, 138.2e3, 139.1e3, 93.7e3, 187.8e3, 609.8e3];
  const xsm2 = [123.6e3, 172.5e3, 242.2e3, 132.7e3, 186.8e3, 169.6e3, 119.9e3];
  const xsm3 = [94.5e3, 136.4e3, 178.6e3, 193.5e3, 133.5e3, 108.9e3, 106.6e3];
  const bsp1 = [2.11, 6.87, 10.08, 3.68, 4.75, 8.58, 8.43];
  const bsp2 = [102.3, 15.53, 9.60, 159.3, 8.12, 13.97, 8.19];
  const xsp1 = [636.9e3, 138.7e3, 165.3e3, 464.4e3, 93.2e3, 216.0e3, 136.2e3];
  const xsp2 = [134.8e3, 143.7e3, 225.7e3, 93.1e3, 135.9e3, 152.0e3, 188.5e3];
  const xsp3 = [95.6e3, 98.6e3, 129.7e3, 94.2e3, 113.4e3, 122.7e3, 122.9e3];
  const C_D = [1.224, 0.801, 1.380, 1.000, 1.224, 1.518, 1.518];   // [Algorithm, Tabla 5.1]
  const z_D = [1.282, 2.161, 1.282, 20.0, 1.282, 1.282, 1.282];
  const bfm1 = [1.0, 1.0, 1.0, 1.0, 0.92, 1.0, 1.0];
  const bfm2 = [0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0];
  const bfm3 = [0.0, 0.0, 0.0, 0.0, 1.77, 0.0, 0.0];
  const bfp1 = [1.0, 0.93, 1.0, 0.93, 0.93, 1.0, 1.0];
  const bfp2 = [0.0, 0.31, 0.0, 0.19, 0.31, 0.0, 0.0];
  const bfp3 = [0.0, 2.00, 0.0, 1.79, 2.00, 0.0, 0.0];

  let z_T = InverseComplementaryCumulativeDistributionFunction(time / 100);
  let z_L = InverseComplementaryCumulativeDistributionFunction(location / 100);
  const z_S = InverseComplementaryCumulativeDistributionFunction(situation / 100);
  const ci = climate - 1;
  const wn = f__mhz / 47.7;

  // distancia efectiva [Algorithm, Eqn 5.3]
  const d_ex__meter = sqrt(2 * a_9000__meter * h_e__meter[0]) + sqrt(2 * a_9000__meter * h_e__meter[1]) + pow((575.7e12 / wn), THIRD);
  let d_e__meter;
  if (d__meter < d_ex__meter) d_e__meter = 130e3 * d__meter / d_ex__meter;
  else d_e__meter = 130e3 + d__meter - d_ex__meter;

  // variabilidad de situaciones (+20 la elimina)
  let mdvar_internal = mdvar;
  const plus20 = mdvar_internal >= 20;
  if (plus20) mdvar_internal -= 20;
  let sigma_S;
  if (plus20) sigma_S = 0.0;
  else sigma_S = 5.0 + 3.0 * exp(-d_e__meter / 100e3);                      // [Algorithm, Eqn 5.10]

  // variabilidad de ubicaciones (+10 la elimina)
  const plus10 = mdvar_internal >= 10;
  if (plus10) mdvar_internal -= 10;

  const V_med__db = Curve(all_year[0][ci], all_year[1][ci], all_year[2][ci], all_year[3][ci], all_year[4][ci], d_e__meter);

  if (mdvar_internal === 0) { z_T = z_S; z_L = z_S; }          // mensaje único
  else if (mdvar_internal === 1) z_L = z_S;                    // accidental
  else if (mdvar_internal === 2) z_L = z_T;                    // móvil
  // 3: difusión, sin cambios

  if (abs(z_T) > 3.10 || abs(z_L) > 3.10 || abs(z_S) > 3.10) W.w |= 0x2000;

  let sigma_L;
  if (plus10) sigma_L = 0.0;
  else {
    const delta_h_d__meter = TerrainRoughness(d__meter, delta_h__meter);
    sigma_L = 10.0 * wn * delta_h_d__meter / (wn * delta_h_d__meter + 13.0);  // [Algorithm, Eqn 5.9]
  }
  const Y_L = sigma_L * z_L;

  // variabilidad temporal
  const q = log(0.133 * wn);
  const g_minus = bfm1[ci] + bfm2[ci] / (pow(bfm3[ci] * q, 2) + 1.0);
  const g_plus = bfp1[ci] + bfp2[ci] / (pow(bfp3[ci] * q, 2) + 1.0);
  const sigma_T_minus = Curve(bsm1[ci], bsm2[ci], xsm1[ci], xsm2[ci], xsm3[ci], d_e__meter) * g_minus;
  const sigma_T_plus = Curve(bsp1[ci], bsp2[ci], xsp1[ci], xsp2[ci], xsp3[ci], d_e__meter) * g_plus;
  const sigma_TD = C_D[ci] * sigma_T_plus;
  const tgtd = (sigma_T_plus - sigma_TD) * z_D[ci];
  let sigma_T;
  if (z_T < 0.0) sigma_T = sigma_T_minus;
  else if (z_T <= z_D[ci]) sigma_T = sigma_T_plus;
  else sigma_T = sigma_TD + tgtd / z_T;
  const Y_T = sigma_T * z_T;

  const Y_S_temp = pow(sigma_S, 2) + pow(Y_T, 2) / (7.8 + pow(z_S, 2)) + pow(Y_L, 2) / (24.0 + pow(z_S, 2)); // [Algorithm, Eqn 5.11]
  let Y_R, Y_S;
  if (mdvar_internal === 0) { Y_R = 0.0; Y_S = sqrt(pow(sigma_T, 2) + pow(sigma_L, 2) + Y_S_temp) * z_S; }
  else if (mdvar_internal === 1) { Y_R = Y_T; Y_S = sqrt(pow(sigma_L, 2) + Y_S_temp) * z_S; }
  else if (mdvar_internal === 2) { Y_R = sqrt(pow(sigma_T, 2) + pow(sigma_L, 2)) * z_T; Y_S = sqrt(Y_S_temp) * z_S; }
  else { Y_R = Y_T + Y_L; Y_S = sqrt(Y_S_temp) * z_S; }

  let result = A_ref__db - V_med__db - Y_R - Y_S;
  if (result < 0.0) result = result * (29.0 - result) / (29.0 - 10.0 * result); // [Algorithm, Eqn 52]
  return { result, V_med__db, Y_R, Y_S, sigma_T, sigma_L, sigma_S, z_T, z_S, d_e__meter };
}

// =====================================================================
// itm_p2p.cpp — ITM_P2P_TLS_Ex
// Entradas como en la referencia; pfl en formato PFL:
//   pfl[0] = número de puntos − 1, pfl[1] = paso (m), pfl[2..] = cotas (m)
// Devuelve { error, A__db, warnings, inter: {…valores intermedios…} }.
export function ITM_P2P_TLS(h_tx__meter, h_rx__meter, pfl, climate, N_0, f__mhz, pol, epsilon, sigma, mdvar, time, location, situation) {
  const W = { w: 0 };
  let rtn = ValidateInputs(h_tx__meter, h_rx__meter, climate, time, location, situation, N_0, f__mhz, pol, epsilon, sigma, mdvar, W);
  if (rtn !== 0) return { error: rtn, warnings: W.w };

  const inter = { d__km: (pfl[0] * pfl[1]) / 1000 };
  const np = int(pfl[0]);
  // altura media del trayecto sin el primer y el último 10 %
  const p10 = int(0.1 * np);
  let h_sys__meter = 0;
  for (let i = p10; i <= np - p10; i++) h_sys__meter += pfl[i + 2];
  h_sys__meter = h_sys__meter / (np - 2 * p10 + 1);

  const { Z_g, gamma_e, N_s } = InitializePointToPoint(f__mhz, h_sys__meter, N_0, pol, epsilon, sigma);
  const h__meter = [h_tx__meter, h_rx__meter];
  const { theta_hzn, d_hzn__meter, h_e__meter, delta_h__meter, d__meter, d_start__meter, d_end__meter } = QuickPfl(pfl, gamma_e, h__meter);

  const lr = LongleyRice(theta_hzn, f__mhz, Z_g, d_hzn__meter, h_e__meter, gamma_e, N_s, delta_h__meter, h__meter, d__meter, MODE__P2P, W);
  if (lr.error !== 0) return { error: lr.error, warnings: W.w };
  const A_fs__db = FreeSpaceLoss(d__meter, f__mhz);
  const v = Variability(time, location, situation, h_e__meter, delta_h__meter, f__mhz, d__meter, lr.A_ref__db, climate, mdvar, W);
  const A__db = v.result + A_fs__db;

  Object.assign(inter, {
    A_ref__db: lr.A_ref__db, A_fs__db, delta_h__meter,
    d_hzn__meter: [...d_hzn__meter], h_e__meter: [...h_e__meter], N_s,
    theta_hzn: [...theta_hzn], mode: lr.propmode,
    a_e__meter: 1 / gamma_e, h_sys__meter, Z_g: { ...Z_g },
    V_med__db: v.V_med__db, Y_R__db: v.Y_R, Y_S__db: v.Y_S, z_T: v.z_T, z_S: v.z_S, d_e__meter: v.d_e__meter,
    sin_corregir__db: lr.A_ref__db - v.V_med__db - v.Y_R - v.Y_S, corregida__db: v.result,
    d_start__meter, d_end__meter, coef: lr.coef, A_ref_sin_limitar__db: lr.A_ref_sin_limitar__db,
  });
  rtn = W.w !== 0 ? 1 : 0;
  return { error: 0, retorno: rtn, A__db, warnings: W.w, inter };
}

// ---------- Utilidades para la app ----------

// Suelos típicos (εr, σ en S/m) según la documentación del ITM / UIT-R P.527
export const SUELOS = {
  pobre: { nombre: 'Suelo pobre (seco, rocoso)', epsilon: 4, sigma: 0.001 },
  medio: { nombre: 'Suelo medio', epsilon: 15, sigma: 0.005 },
  bueno: { nombre: 'Suelo bueno (húmedo)', epsilon: 25, sigma: 0.02 },
  dulce: { nombre: 'Agua dulce', epsilon: 81, sigma: 0.01 },
  mar: { nombre: 'Agua de mar', epsilon: 81, sigma: 5 },
};

// Convierte un perfil de la app ([{d (m), z (m)}], equiespaciado) al formato PFL.
// Si el paso no es uniforme (diferencia > 0,1 %), se remuestrea por interpolación lineal.
export function perfilAPfl(perfil) {
  const n = perfil.length;
  if (n < 3) throw new Error('El perfil necesita al menos 3 cotas.');
  const D = perfil[n - 1].d - perfil[0].d;
  const paso = D / (n - 1);
  const uniforme = perfil.every((p, i) => Math.abs((p.d - perfil[0].d) - i * paso) <= 1e-3 * paso);
  const pfl = [n - 1, paso];
  if (uniforme) { for (const p of perfil) pfl.push(p.z); return pfl; }
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = perfil[0].d + i * paso;
    while (j < n - 2 && perfil[j + 1].d < x) j++;
    const p0 = perfil[j], p1 = perfil[j + 1];
    const t = p1.d === p0.d ? 0 : (x - p0.d) / (p1.d - p0.d);
    pfl.push(p0.z + t * (p1.z - p0.z));
  }
  return pfl;
}
