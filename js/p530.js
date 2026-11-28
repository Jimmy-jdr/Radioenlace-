/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// p530.js — Disponibilidad de enlaces con visibilidad directa (versión 1.5)
// Recomendación UIT-R P.530-19 (09/2025), vigente, anexo 1:
//   § 2.1    atenuación por gases (con la P.676-13)
//   § 2.2.2  criterio de despeje (ke del 99,9 %, ec. 4)
//   § 2.3.1  desvanecimiento por multitrayecto, porcentajes pequeños (ecs. 5–9)
//   § 2.3.2  ídem, todas las profundidades (ecs. 11–18)
//   § 2.3.4  del peor mes al año medio (ec. 24, con la P.841-7)
//   § 2.3.6  corte no selectivo, Pns = pw/100 (ec. 28)
//   § 2.4.1  atenuación por lluvia (ecs. 32–35)
//   § 2.4.2  método combinado de lluvia y nieve húmeda (ecs. 37–71)
//   § 2.4.7  corte por precipitación, Prain = p/100 (ec. 100)
// Sin DOM: lo usan la interfaz, las pruebas y verificar.py (reimplementado).
// =====================================================================

const log10 = Math.log10;

// ---------- § 2.2.2: factor k efectivo superado el 99,9 % del tiempo ----------
// Valor de ke superado aproximadamente el 99,9 % del peor mes (clima
// continental templado), ec. (4): ke = 157 / (144 + 2 670/d), d en km.
export function ke999(dKm) {
  return 157 / (144 + 2670 / dKm);
}

// Criterio de despeje del § 2.2.2.1 (pasos 1 a 4): fracciones de r1 para
// cada uno de los dos supuestos de k.
//   clima 'templado':  0,0·F1 (obstáculo aislado) o 0,3·F1 (extendido) con ke
//   clima 'tropical':  0,6·F1 con ke si d > 30 km (la Recomendación no da
//                      otro valor para trayectos más cortos: se aplica el templado)
export function criterioDespejeP530({ dKm, clima = 'templado', obstaculo = 'aislado' }) {
  const ke = ke999(dKm);
  let fraccion = obstaculo === 'extendido' ? 0.3 : 0;
  if (clima === 'tropical' && dKm > 30) fraccion = 0.6;
  return { paso1: { k: 4 / 3, fraccion: 1.0 }, paso3: { k: ke, fraccion } };
}

// ---------- P.841-7: del peor mes al año medio ----------
// Q(p) de la ec. (4) de la P.841-7, con p (%) anual
export function factorQ(p, Q1 = 2.85, beta = 0.13) {
  const pLim = (Q1 / 12) ** (1 / beta);
  if (p <= pLim) return 12;
  if (p <= 3) return Q1 * p ** -beta;
  if (p <= 30) return Q1 * 3 ** -beta;
  const q3 = Q1 * 3 ** -beta;
  return q3 * (p / 30) ** (log10(q3) / log10(0.3));
}
// p anual a partir de pw (%) del peor mes: p = pw/Q(p) (P.530 ec. 24; P.841 ec. 5).
// Se resuelve por bisección en log p (Q es continua y p·Q(p) es creciente).
export function anualDesdePeorMes(pw, Q1 = 2.85, beta = 0.13) {
  if (!(pw > 0)) return 0;
  let lo = Math.log(pw / 12), hi = Math.log(pw);
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2, p = Math.exp(m);
    if (p * factorQ(p, Q1, beta) > pw) hi = m; else lo = m;
  }
  return Math.exp((lo + hi) / 2);
}

// ---------- § 2.3.1: multitrayecto, porcentajes pequeños de tiempo ----------
// Entradas: dKm, fGHz, he y hr (m s. n. m. de las antenas), ht (cota media del
// terreno, m), K (factor geoclimático, ya en valor lineal) y dN75.
export function parametrosMultitrayecto({ dKm, fGHz, he, hr, ht, K, dN75 }) {
  const ep = Math.abs(hr - he) / dKm;                                   // ec. (5), mrad
  const hc = (hr + he) / 2 - (dKm * dKm) / 102 - ht;                   // ec. (6), m
  const hL = Math.min(he, hr);
  const vsrLimite = (dN75 * dKm ** 1.5 * fGHz ** 0.5) / 24730;          // ec. (9)
  const vsr = Math.min((dN75 / 50) ** 1.8 * Math.exp(-hc / (2.5 * Math.sqrt(dKm))), vsrLimite);   // ec. (8)
  const exponente = -0.376 * Math.tanh((hc - 147) / 125) - 0.334 * ep ** 0.39 - 0.00027 * hL + 17.85 * vsr;
  const p0 = K * dKm ** 3.51 * (fGHz * fGHz + 13) ** 0.447 * 10 ** exponente;   // ec. (7) con A = 0 = ec. (11)
  return { ep, hc, hL, vsr, vsrLimite, p0, fmin: 15 / dKm };
}
// ec. (7): pw (%) para una profundidad A (dB), válida para desvanecimientos profundos
export const pwProfundo = (p0, A) => p0 * 10 ** (-A / 10);

// § 2.3.2: método para todas las profundidades (ecs. 12–18)
export function pwTodasProfundidades(p0, A) {
  const At = 25 + 1.2 * log10(p0);                                     // ec. (12)
  if (A >= At) return { pw: pwProfundo(p0, A), At, profundo: true };    // ec. (13)
  const pt = Math.min(p0 * 10 ** (-At / 10), 99.9999);                 // ec. (14), limitada a 99,9999 % (texto de la ec. 15)
  const qa1 = -20 * log10(-Math.log((100 - pt) / 100)) / At;           // ec. (15)
  const qt = (qa1 - 2) / ((1 + 0.3 * 10 ** (-At / 20)) * 10 ** (-0.016 * At)) - 4.3 * (10 ** (-At / 20) + At / 800);   // ec. (16)
  const qa = 2 + (1 + 0.3 * 10 ** (-A / 20)) * 10 ** (-0.016 * A) * (qt + 4.3 * (10 ** (-A / 20) + A / 800));        // ec. (17)
  const pw = 100 * (1 - Math.exp(-(10 ** (-qa * A / 20))));            // ec. (18)
  return { pw, At, pt, qa1, qt, qa, profundo: false };
}

// ---------- § 2.4.1: atenuación por lluvia ----------
// gammaR (dB/km) de la P.838-3; alfa, el exponente de la P.838-3.
export function factorDistanciaLluvia({ dKm, fGHz, R001, alfa }) {
  const f = Math.max(fGHz, 6), d = Math.min(dKm, 30), R = Math.max(R001, 3);   // límites del paso 3
  return 1 / (0.477 * d ** 0.633 * R ** (0.073 * alfa) * f ** 0.123 - 10.579 * (1 - Math.exp(-0.024 * d)));   // ec. (32)
}
export function coeficientesC(fGHz) {
  const C0 = fGHz >= 10 ? 0.12 + 0.4 * log10(fGHz / 10) ** 0.8 : 0.12;      // ec. (35d)
  return {
    C0,
    C1: 0.07 ** C0 * 0.12 ** (1 - C0),                                     // ec. (35a)
    C2: 0.855 * C0 + 0.546 * (1 - C0),                                     // ec. (35b)
    C3: 0.139 * C0 + 0.043 * (1 - C0),                                     // ec. (35c)
  };
}
export function lluviaA001({ dKm, fGHz, R001, gammaR, alfa }) {
  const r = factorDistanciaLluvia({ dKm, fGHz, R001, alfa });
  return { r, deff: dKm * r, A001: gammaR * dKm * r };                     // ec. (33)
}
// ec. (34): Ap = A0,01·C1·p^−(C2 + C3·log10 p)
export function atenuacionLluviaP(A001, fGHz, p) {
  const { C1, C2, C3 } = coeficientesC(fGHz);
  return A001 * C1 * p ** -(C2 + C3 * log10(p));
}
// Inversa de la ec. (34): p (%) para el que la atenuación por lluvia vale A (dB).
// Con x = log10 p:  C3·x² + C2·x + log10(A/(A0,01·C1)) = 0, raíz con x ≤ −C2/(2·C3)
// (rama decreciente). Válida de 0,001 a 1 %; fuera de ese intervalo se avisa.
export function porcentajeLluvia(A001, fGHz, A) {
  const { C1, C2, C3 } = coeficientesC(fGHz);
  const L = log10(A / (A001 * C1));
  const disc = C2 * C2 - 4 * C3 * L;
  const x = disc >= 0 ? (-C2 + Math.sqrt(disc)) / (2 * C3) : -C2 / (2 * C3);
  const p = 10 ** x;
  return { p, fuera: p < 0.001 ? 'bajo' : p > 1 ? 'alto' : null };
}

// ---------- § 2.4.2: método combinado de lluvia y nieve húmeda ----------
// Cuadro 2: probabilidad Πn de cada altura de lluvia (n = 0…48, simétrica)
const PI_MITAD = [0.000555, 0.000802, 0.001139, 0.001594, 0.002196, 0.002978, 0.003976, 0.005227, 0.006764, 0.008617,
  0.010808, 0.013346, 0.016225, 0.019419, 0.022881, 0.026542, 0.030312, 0.034081, 0.037724, 0.041110, 0.044104,
  0.046583, 0.048439, 0.049588, 0.049977];
export const PI_N = [...PI_MITAD, ...PI_MITAD.slice(0, 24).reverse()];

// Función 1, ec. (43): multiplicador de la atenuación a Δh = h − hrain (m)
export function multiplicadorGamma(dh) {
  if (dh > 0) return 0;
  if (dh < -1200) return 1;
  const a = 4 * (1 - Math.exp(dh / 70)) ** 2;
  return a / (1 + (1 - Math.exp(-((dh / 600) ** 2))) ** 2 * (a - 1));
}

// Función 2, ecs. (44)–(53): multiplicador medio del trayecto para la altura de lluvia hrain
export function multiplicadorTrayecto(hrain, hlo, hhi) {
  const slo = 1 + Math.floor((hrain - hlo) / 100);                     // ec. (44a)
  const shi = 1 + Math.floor((hrain - hhi) / 100);                     // ec. (44b)
  if (slo < 1) return 0;
  if (shi > 12) return 1;
  if (slo === shi) return multiplicadorGamma(0.5 * (hlo + hhi) - hrain);   // ec. (45)
  let g = 0;
  const sFirst = Math.max(shi, 1), sLast = Math.min(slo, 12);           // ec. (46)
  for (let s = sFirst; s <= sLast; s++) {
    let dh, q;
    if (shi < s && s < slo) { dh = 100 * (0.5 - s); q = 100 / (hhi - hlo); }                                     // ec. (47)
    else if (s === slo) { dh = 0.5 * (hlo - hrain - 100 * (s - 1)); q = (hrain - 100 * (s - 1) - hlo) / (hhi - hlo); }   // ec. (48)
    else { dh = 0.5 * (hhi - hrain - 100 * s); q = (hhi - hrain + 100 * s) / (hhi - hlo); }                       // ec. (49)
    g += q * multiplicadorGamma(dh);                                    // ecs. (50)–(51)
  }
  if (slo > 12) g += (hrain - 1200 - hlo) / (hhi - hlo);                // ecs. (52)–(53)
  return g;
}

// Atenuación por lluvia y nieve húmeda superada el p % del año.
// lluvia(p) → atenuación solo por lluvia (ec. 34); P0: probabilidad anual de lluvia (%), P.837
// hrainm: altura media de la lluvia (m s. n. m., P.839); h1, h2: antenas (m s. n. m.)
export function atenuacionLluviaNieve({ lluvia, P0, hrainm, h1, h2, p }) {
  const hlo = Math.min(h1, h2), hhi = Math.max(h1, h2);                // ec. (37)
  if (hhi <= hrainm - 3600) return { A: lluvia(p), caso: 1 };            // capa de fusión siempre por encima
  if (hlo >= hrainm + 2400) return { A: 0, caso: 2 };                    // siempre por debajo
  const Arainp = lluvia(p);
  // Vectores T y A, ecs. (38)–(42)
  const T = [P0], Av = [0];
  for (let t = 1; ; t++) {
    T.push(P0 * 10 ** (-0.1 * t));
    Av.push(lluvia(T[t]));
    if (!(T[t] >= 0.001 || Av[t] - Av[t - 1] >= 0.1)) break;
    if (t > 400) break;
  }
  const Nlast = T.length - 1, Alast = Av[Nlast], Tlast = T[Nlast];
  // Función 3, ecs. (54)–(57): porcentaje de tiempo para una atenuación de solo lluvia
  const tiempoDe = (A) => {
    if (A > Alast) return 10 ** (Alast - A + log10(Tlast));
    let kinf = 0, ksup = Nlast;
    while (ksup - kinf > 1) {
      const ktry = Math.floor((kinf + ksup) / 2);
      if (Av[ktry] < A) kinf = ktry; else ksup = ktry;
    }
    const u = log10(T[ksup]) + log10(T[kinf] / T[ksup]) * (Av[ksup] - A) / (Av[ksup] - Av[kinf]);
    return 10 ** u;
  };
  // Paso 1: vectores G y P, ecs. (58)–(63)
  const G = new Array(49).fill(0), P = new Array(49).fill(0);
  G[0] = 1;
  let m = 0;
  for (let n = 0; n <= 48; n++) {
    const hrain = hrainm - 2400 + 100 * n;                               // ec. (58)
    if (hlo >= hrain) continue;                                          // sub-paso b
    if (hhi > hrain - 1200) {                                            // sub-paso c
      G[m] = multiplicadorTrayecto(hrain, hlo, hhi);
      P[m] = PI_N[n];
      if (n < 48) m++;
    } else {                                                             // sub-paso d
      G[m] = 1;
      P[m] += PI_N[n];
    }
  }
  const M = m + 1;                                                       // ec. (63)
  const pTrial = (A) => {
    let s = 0;
    for (let i = 0; i < M; i++) if (G[i] > 0) s += P[i] * tiempoDe(A / G[i]);   // ec. (65); con G = 0 el término es nulo
    return s;
  };
  // Paso 2: iteración inicial, ecs. (64)–(69)
  let Atrial = Arainp, pt = pTrial(Atrial), Amin, Amax;
  if (pt > p) {
    let i = 0;
    while (pt > p && i++ < 10000) { Atrial += Arainp; pt = pTrial(Atrial); }
    Amin = Atrial - Arainp; Amax = Atrial;
  } else { Amin = 0.01; Amax = Atrial; }
  Atrial = 0.5 * (Amin + Amax);
  // Paso 3: búsqueda binaria, ecs. (70)–(71)
  const Arange = Math.min(0.1, 0.01 * Arainp);
  let i = 0;
  while (Amax - Amin > Arange && i++ < 200) {
    pt = pTrial(Atrial);
    if (pt > p) Amin = Atrial; else Amax = Atrial;
    Atrial = 0.5 * (Amin + Amax);
  }
  return { A: Atrial, caso: 3, Arainp, M };
}

// ---------- Indisponibilidad por precipitación (§ 2.4.7) ----------
// Porcentaje del año en que la atenuación por precipitación supera F (dB).
// Con el método combinado se invierte A(p) por bisección en log p.
export function porcentajePrecipitacion({ F, lluvia, A001, fGHz, P0, hrainm, h1, h2, nieve = true }) {
  if (!(F > 0)) return { p: 100, fuera: 'margen' };
  if (!nieve) return { ...porcentajeLluvia(A001, fGHz, F), caso: 1 };
  const prueba = atenuacionLluviaNieve({ lluvia, P0, hrainm, h1, h2, p: 0.01 });
  if (prueba.caso === 1) return { ...porcentajeLluvia(A001, fGHz, F), caso: 1 };
  if (prueba.caso === 2) return { p: 0, caso: 2, fuera: null };
  const A = (p) => atenuacionLluviaNieve({ lluvia, P0, hrainm, h1, h2, p }).A;
  let lo = log10(1e-5), hi = log10(Math.max(P0, 1e-4));
  if (A(10 ** hi) >= F) return { p: 10 ** hi, caso: 3, fuera: 'alto' };
  if (A(10 ** lo) <= F) return { p: 10 ** lo, caso: 3, fuera: 'bajo' };
  for (let i = 0; i < 60; i++) {
    const mm = (lo + hi) / 2;
    if (A(10 ** mm) > F) lo = mm; else hi = mm;
  }
  const p = 10 ** ((lo + hi) / 2);
  return { p, caso: 3, fuera: p < 0.001 ? 'bajo' : p > 1 ? 'alto' : null };
}

// ---------- § 2.2.2.1: alturas mínimas de antena con el criterio completo ----------
// Paso 1: 1,0·F1 con k = 4/3; paso 3: 0,0/0,3·F1 (templado) o 0,6·F1 (tropical,
// d > 30 km) con ke del 99,9 %; paso 4: la mayor de las dos alturas.
// analizar(k) debe devolver analizarPerfil() con ese k; minimas(an, c) = alturasMinimas().
export function alturasMinimasP530({ dKm, clima, obstaculo, analizar, minimas }) {
  const c = criterioDespejeP530({ dKm, clima, obstaculo });
  const r1 = minimas(analizar(c.paso1.k), c.paso1.fraccion);
  const r3 = minimas(analizar(c.paso3.k), c.paso3.fraccion);
  const res = { criterio: c, ke: c.paso3.k, sinCota: Math.max(r1.sinCota, r3.sinCota), despejeMinimo: null };
  for (const v of ['a', 'b', 'igual']) {
    if (!r1[v] || !r3[v]) { res[v] = r1[v] || r3[v]; continue; }
    res[v] = r1[v].h >= r3[v].h ? { ...r1[v], paso: 1 } : { ...r3[v], paso: 3 };
  }
  return res;
}
