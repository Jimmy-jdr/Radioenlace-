/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// radio.js — Cálculos de radioenlaces punto a punto (sin dependencias)
// Todas las funciones son puras: reciben números y devuelven números u
// objetos. Así se pueden probar con Node y reutilizar en la fase 2
// (Longley–Rice, mapas de cobertura).
// Unidades internas: distancias en metros, frecuencia en MHz, potencias
// en dBm, ganancias y pérdidas en dB/dBi.
// =====================================================================

export const C = 299792458;            // velocidad de la luz (m/s)
export const R_TIERRA_KM = 6371;       // radio medio terrestre (km)

// Constante de la fórmula de pérdidas en espacio libre con d en km y f en MHz:
// 20·log10(4π/c · 10^3 · 10^6) = 32,45 dB
export const K_FSPL = 20 * Math.log10((4 * Math.PI / C) * 1e3 * 1e6);

const log10 = Math.log10;
const rad = (g) => (g * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// ---------- Conversión de unidades ----------
export const wADbm = (w) => 10 * log10(w * 1000);
export const dbmAW = (dbm) => Math.pow(10, dbm / 10) / 1000;
export const aMHz = (valor, unidad) => (unidad === 'GHz' ? valor * 1000 : valor);
export const potenciaDbm = (valor, unidad) => (unidad === 'W' ? wADbm(valor) : valor);
export const longitudOnda = (fMHz) => C / (fMHz * 1e6); // metros

// ---------- Geodesia (esfera) ----------
export function distanciaKm(a, b) {
  const f1 = rad(a.lat), f2 = rad(b.lat);
  const df = f2 - f1, dl = rad(b.lon - a.lon);
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function rumbo(a, b) { // acimut inicial en grados (0 = norte)
  const f1 = rad(a.lat), f2 = rad(b.lat), dl = rad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function destino(a, rumboGrados, dKm) {
  const d = dKm / R_TIERRA_KM, t = rad(rumboGrados), f1 = rad(a.lat), l1 = rad(a.lon);
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { lat: deg(f2), lon: ((deg(l2) + 540) % 360) - 180 };
}

// Puntos equiespaciados sobre el círculo máximo A→B (incluye extremos)
export function puntosTrayecto(a, b, n) {
  const dKm = distanciaKm(a, b);
  const out = [];
  const f1 = rad(a.lat), l1 = rad(a.lon), f2 = rad(b.lat), l2 = rad(b.lon);
  const delta = dKm / R_TIERRA_KM;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let lat, lon;
    if (delta < 1e-12) { lat = a.lat; lon = a.lon; }
    else {
      const A = Math.sin((1 - t) * delta) / Math.sin(delta);
      const B = Math.sin(t * delta) / Math.sin(delta);
      const x = A * Math.cos(f1) * Math.cos(l1) + B * Math.cos(f2) * Math.cos(l2);
      const y = A * Math.cos(f1) * Math.sin(l1) + B * Math.cos(f2) * Math.sin(l2);
      const z = A * Math.sin(f1) + B * Math.sin(f2);
      lat = deg(Math.atan2(z, Math.hypot(x, y)));
      lon = deg(Math.atan2(y, x));
    }
    out.push({ lat, lon, d: t * dKm * 1000 });
  }
  return out;
}

// Punto del círculo máximo A→B en la fracción t de la distancia (0 = A, 1 = B),
// con la misma interpolación que puntosTrayecto()
export function puntoEnTrayecto(a, b, t) {
  const dKm = distanciaKm(a, b), delta = dKm / R_TIERRA_KM;
  if (delta < 1e-12) return { lat: a.lat, lon: a.lon, d: 0 };
  const f1 = rad(a.lat), l1 = rad(a.lon), f2 = rad(b.lat), l2 = rad(b.lon);
  const A = Math.sin((1 - t) * delta) / Math.sin(delta);
  const B = Math.sin(t * delta) / Math.sin(delta);
  const x = A * Math.cos(f1) * Math.cos(l1) + B * Math.cos(f2) * Math.cos(l2);
  const y = A * Math.cos(f1) * Math.sin(l1) + B * Math.cos(f2) * Math.sin(l2);
  const z = A * Math.sin(f1) + B * Math.sin(f2);
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)), d: t * dKm * 1000 };
}

// ---------- Propagación ----------
export const perdidasEspacioLibre = (dKm, fMHz) => K_FSPL + 20 * log10(dKm) + 20 * log10(fMHz);

export function radioFresnel(d1, d2, fMHz, n = 1) { // d1, d2 en m → radio en m
  if (d1 <= 0 || d2 <= 0) return 0;
  return Math.sqrt((n * longitudOnda(fMHz) * d1 * d2) / (d1 + d2));
}

// Abultamiento (flecha) de la Tierra en un punto: h = d1·d2 / (2·k·R)
export function flechaTierra(d1, d2, k) {
  if (!isFinite(k)) return 0;
  return (d1 * d2) / (2 * k * R_TIERRA_KM * 1000);
}

export function presupuesto({ ptxDbm, gtx, grx, ltx, lrx, perdidaTrayecto, sensibilidad }) {
  const pire = ptxDbm - ltx + gtx;
  const prx = pire - perdidaTrayecto + grx - lrx;
  return { pire, prx, margen: prx - sensibilidad };
}

// ---------- Análisis del perfil ----------
// perfil: [{d (m), z (m) | null}] ordenado de A a B.
// hA, hB: altura de cada antena sobre el suelo (m).
export function analizarPerfil({ perfil, hA, hB, fMHz, k, despejeMinimo = 0.6 }) {
  const n = perfil.length;
  const D = perfil[n - 1].d;
  // Cotas de los extremos: si faltan se usa la cota válida más cercana
  const cotaValida = (desde, paso) => {
    for (let i = desde; i >= 0 && i < n; i += paso) if (perfil[i].z != null) return perfil[i].z;
    return 0;
  };
  const zA = perfil[0].z ?? cotaValida(0, 1);
  const zB = perfil[n - 1].z ?? cotaValida(n - 1, -1);
  const yA = zA + hA, yB = zB + hB;          // cota de cada antena sobre el nivel del mar

  const puntos = perfil.map((p, i) => {
    const d1 = p.d, d2 = D - p.d;
    const flecha = flechaTierra(d1, d2, k);
    const los = yA + ((yB - yA) * d1) / D;
    const r1 = radioFresnel(d1, d2, fMHz);
    const zEf = p.z == null ? null : p.z + flecha;   // terreno + curvatura
    const despeje = zEf == null ? null : los - zEf;  // >0: terreno por debajo de la LOS
    const relacion = zEf == null || r1 === 0 ? null : despeje / r1;
    return { i, d: p.d, lat: p.lat, lon: p.lon, z: p.z, flecha, zEf, los, r1, despeje, relacion };
  });

  // Punto más comprometido: menor relación despeje/r1 (se excluyen los extremos)
  let peor = null;
  for (const p of puntos) {
    if (p.i === 0 || p.i === n - 1 || p.relacion == null) continue;
    if (!peor || p.relacion < peor.relacion) peor = p;
  }

  // Tramos donde el relieve invade el 60 % de la 1.ª zona de Fresnel
  const invasiones = [];
  let actual = null;
  for (const p of puntos) {
    const invade = p.relacion != null && p.i > 0 && p.i < n - 1 && p.relacion < despejeMinimo;
    if (invade && !actual) actual = { desde: p.d, hasta: p.d, obstruye: p.relacion < 0 };
    if (invade) { actual.hasta = p.d; if (p.relacion < 0) actual.obstruye = true; }
    if (!invade && actual) { invasiones.push(actual); actual = null; }
  }
  if (actual) invasiones.push(actual);

  const medio = puntos.reduce((m, p) => (Math.abs(p.d - D / 2) < Math.abs(m.d - D / 2) ? p : m), puntos[0]);

  let estado = 'despejado';
  if (peor && peor.relacion < 0) estado = 'obstruido';
  else if (peor && peor.relacion < despejeMinimo) estado = 'fresnel';

  return {
    puntos, peor, invasiones, estado, despejeMinimo,
    D, zA, zB, yA, yB,
    r1Medio: radioFresnel(D / 2, D / 2, fMHz),
    flechaMedio: flechaTierra(D / 2, D / 2, k),
    medio,
    faltan: perfil.filter((p) => p.z == null).length,
  };
}

// ---------- Altura mínima de las antenas (versión 1.4) ----------
// Altura de mástil que hace falta para que la línea de visión despeje la
// fracción «despejeMinimo» (60 %) del radio de la 1.ª zona de Fresnel en
// TODO el trayecto, con el mismo criterio que analizarPerfil() (se excluyen
// los extremos y los puntos sin cota).
// En cada punto i (t = d1/d) la condición es
//   y_LOS(i) = y_A·(1 − t) + y_B·t  ≥  z_i + h_i + c·r1_i  =  q_i
// (h_i = flecha). La flecha y r1 no dependen de las alturas de las antenas,
// así que la condición es lineal en y_A e y_B y la altura mínima es exacta:
//   A (con B fija):        y_A ≥ (q_i − y_B·t) / (1 − t)
//   B (con A fija):        y_B ≥ (q_i − y_A·(1 − t)) / t
//   misma altura h en A y B: h ≥ q_i − z_A·(1 − t) − z_B·t
// Se toma el máximo a lo largo del trayecto. Criterio del 60 %: UIT-R P.530 § 2.2.2.
export function alturasMinimas(an, despejeMinimo = 0.6) {
  const n = an.puntos.length, D = an.D;
  const res = { despejeMinimo, a: null, b: null, igual: null, sinCota: 0 };
  for (const p of an.puntos) {
    if (p.i === 0 || p.i === n - 1) continue;
    if (p.zEf == null) { res.sinCota++; continue; }
    const t = p.d / D;
    const q = p.zEf + despejeMinimo * p.r1;
    const yA = (q - an.yB * t) / (1 - t);
    const yB = (q - an.yA * (1 - t)) / t;
    const hI = q - an.zA * (1 - t) - an.zB * t;
    if (!res.a || yA > res.a.y) res.a = { y: yA, h: yA - an.zA, punto: p, q };
    if (!res.b || yB > res.b.y) res.b = { y: yB, h: yB - an.zB, punto: p, q };
    if (!res.igual || hI > res.igual.h) res.igual = { h: hI, punto: p, q };
  }
  return res;
}

// ---------- Difracción en filo de cuchillo (UIT-R P.526, § 4.1) ----------
// h: altura del obstáculo sobre la línea de visión (m; negativa si queda por debajo)
// ν = h·√(2·(d1 + d2) / (λ·d1·d2))                         (ec. 26)
// J(ν) = 6,9 + 20·log(√((ν − 0,1)² + 1) + ν − 0,1) dB, para ν > −0,78   (ec. 31)
export function parametroNu(h, d1, d2, fMHz) {
  if (d1 <= 0 || d2 <= 0) return -Infinity;
  return h * Math.sqrt((2 * (d1 + d2)) / (longitudOnda(fMHz) * d1 * d2));
}
export function perdidaFiloCuchillo(nu) {
  if (!(nu > -0.78)) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1);
}
// Aplica el método al punto más comprometido del perfil analizado
export function difraccionObstaculoPrincipal(an, fMHz) {
  const p = an?.peor;
  if (!p) return null;
  const h = -p.despeje, d1 = p.d, d2 = an.D - p.d;
  const nu = parametroNu(h, d1, d2, fMHz);
  return { h, d1, d2, nu, J: perdidaFiloCuchillo(nu), punto: p };
}

// Lectura de números escritos con coma o punto decimal
export function leerNumero(texto) {
  if (typeof texto === 'number') return texto;
  if (texto == null) return NaN;
  const t = String(texto).trim().replace(/\s/g, '').replace('−', '-').replace(',', '.');
  if (t === '' || t === '-' || t === '.') return NaN;
  return Number(t);
}

// Factor k a partir de texto: "4/3", "1,333", "inf", "∞"
export function leerK(texto) {
  const t = String(texto).trim().toLowerCase();
  if (t === '∞' || t === 'inf' || t === 'infinito') return Infinity;
  if (t.includes('/')) { const [a, b] = t.split('/').map(leerNumero); return a / b; }
  return leerNumero(t);
}
