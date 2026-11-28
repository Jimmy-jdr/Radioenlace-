/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// etsi.js — Datos de ETSI EN 302 217-2 V3.4.1 (2025-07) (versión 1.5)
// «Fixed Radio Systems; Characteristics and requirements for point-to-point
// equipment and antennas; Part 2: Digital systems operating in frequency
// bands from 1 GHz to 174,8 GHz». Descargada de etsi.org el 28-11-2026.
// Solo datos y su consulta (sin DOM). Valores copiados de los cuadros:
//   cuadro 0  clases de eficiencia espectral y modulación de referencia
//   cuadro 1  densidad mínima de RIC (Mbit/s/MHz)
//   C.6       3,5–11 GHz (CS 1,75–112 MHz)       D.5  4–11 GHz (CS 40 y 80 MHz)
//   E.5a      13 y 15 GHz                         E.5b 18 GHz
//   F.5a/b    23, 26, 28, 31, 32, 38 y 42 GHz
// Cada fila: [CS (MHz) o lista de CS con los mismos valores, RIC mínima (Mbit/s),
// RSL para BER ≤ 10⁻⁶ (dBm)]. La RSL es el límite superior que el equipo debe
// garantizar: las fichas de los fabricantes suelen ser varios dB mejores.
// =====================================================================

export const NORMA = 'ETSI EN 302 217-2 V3.4.1 (2025-07)';
export const URL_NORMA = 'https://www.etsi.org/deliver/etsi_en/302200_302299/30221702/03.04.01_60/en_30221702v030401p.pdf';

// Cuadro 0 y cuadro 1: índice de modulación de referencia, clase, estados M y densidad mínima de RIC
export const CLASES = [
  { clase: '2', indice: 2, M: 4, nombre: '4QAM (QPSK)', densidad: 1.14 },
  { clase: '3', indice: 3, M: 8, nombre: '8PSK', densidad: 1.7 },
  { clase: '4L', indice: 4, M: 16, nombre: '16QAM', densidad: 2.28 },
  { clase: '4H', indice: 5, M: 32, nombre: '32QAM', densidad: 3.5 },
  { clase: '5L', indice: 6, M: 64, nombre: '64QAM', densidad: 4.2 },
  { clase: '5H', indice: 7, M: 128, nombre: '128QAM', densidad: 4.9 },
  { clase: '6L', indice: 8, M: 256, nombre: '256QAM', densidad: 5.6 },
  { clase: '6H', indice: 9, M: 512, nombre: '512QAM', densidad: 6.3 },
  { clase: '7', indice: 10, M: 1024, nombre: '1024QAM', densidad: 7 },
  { clase: '8', indice: 11, M: 2048, nombre: '2048QAM', densidad: 7.7 },
  // La norma no define una clase para 4 096 estados: solo con umbral propio
  { clase: null, indice: null, M: 4096, nombre: '4096QAM', densidad: null },
];

const R1415 = [14, 15], R2830 = [28, 30], R5660 = [56, 60];
// Cuadro C.6 (3,5 GHz a 11 GHz)
const C6 = {
  2: [[1.75, 2, -93], [3.5, 4, -90], [7, 8, -87], [R1415, 16, -84], [R2830, 32, -81], [R5660, 64, -78], [112, 128, -75]],
  3: [[1.75, 3, -88], [3.5, 6, -85], [7, 12, -82], [R1415, 24, -79], [R2830, 48, -76], [R5660, 96, -73], [112, 192, -70]],
  '4L': [[1.75, 4, -86], [3.5, 8, -83], [7, 16, -80], [R1415, 32, -77], [20, 45, -76], [R2830, 64, -74], [R5660, 128, -71], [112, 256, -68]],
  '4H': [[7, 24, -77], [R1415, 49, -74], [R2830, 98, -71], [R5660, 196, -68], [112, 392, -65]],
  '5L': [[7, 29, -74], [R1415, 58, -71], [R2830, 117, -68], [R5660, 235, -65], [112, 470, -62]],
  '5H': [[7, 34, -72.5], [R1415, 68, -69.5], [R2830, 137, -67], [R5660, 274, -64], [112, 548, -61]],
  '6L': [[7, 39, -68], [R1415, 78, -65], [R2830, 156, -63], [R5660, 313, -60], [112, 626, -57]],
  '6H': [[R1415, 88, -61], [R2830, 176, -58.5], [R5660, 352, -56], [112, 704, -53]],
  7: [[R1415, 98, -57.5], [R2830, 196, -55], [R5660, 392, -52.5], [112, 784, -49.5]],
  8: [[R1415, 107, -54.5], [R2830, 215, -51.5], [R5660, 431, -49], [112, 862, -46]],
};
// Cuadro D.5 (CS 40 y 80 MHz). RSL: [bandas 4, U4, U6 y 8; banda 11]. 80 MHz solo en U6 y 11.
// Se toma la fila cuya RIC corresponde a la densidad del cuadro 1 (no las variantes STM-1).
const D5 = {
  '5L': [[40, 168, [-68, -67]], [80, 336, [-65, -64]]],
  '5H': [[40, 196, [-63.5, -63.5]], [80, 392, [-60.5, -60.5]]],
  '6L': [[40, 224, [-60.5, -60.5]], [80, 448, [-57.5, -57.5]]],
  '6H': [[40, 252, [-57.5, -57.5]], [80, 504, [-54.5, -54.5]]],
  7: [[40, 280, [-54, -54]], [80, 560, [-51, -51]]],
  8: [[40, 308, [-50.5, -50.5]], [80, 616, [-47.5, -47.5]]],
};
// Cuadro E.5a (13 y 15 GHz)
const E5A = {
  2: [[1.75, 2, -93], [3.5, 4, -90], [7, 8, -87], [14, 16, -84], [28, 32, -81], [56, 64, -78]],
  3: [[1.75, 3, -88], [3.5, 6, -85], [7, 12, -82], [14, 24, -79], [28, 48, -76], [56, 96, -73]],
  '4L': [[1.75, 4, -86], [3.5, 8, -83], [7, 16, -80], [14, 32, -77], [28, 64, -74], [56, 128, -71]],
  '4H': [[7, 24, -77], [14, 49, -74], [28, 98, -71], [56, 196, -68]],
  '5L': [[7, 29, -74], [14, 58, -71], [28, 117, -68], [56, 235, -65]],
  '5H': [[7, 34, -71.5], [14, 68, -68.5], [28, 137, -65.5], [56, 274, -62]],
  '6L': [[7, 39, -67.5], [14, 78, -64.5], [28, 156, -62], [56, 313, -59]],
  '6H': [[14, 88, -61], [28, 176, -58.5], [56, 352, -56]],
  7: [[14, 98, -57.5], [28, 196, -55], [56, 392, -52.5]],
  8: [[14, 107, -54.5], [28, 215, -51.5], [56, 431, -49]],
};
// Cuadro E.5b (18 GHz)
const R14 = [13.75, 14];
const E5B = {
  2: [[1.75, 2, -92], [3.5, 4, -89], [7, 8, -86], [R14, 16, -83], [27.5, 32, -80], [55, 64, -77], [110, 128, -74], [220, 265, -71]],
  3: [[1.75, 3, -87], [3.5, 6, -84], [7, 12, -81], [R14, 24, -78], [27.5, 48, -75], [55, 96, -72], [110, 191, -69], [220, 382, -66]],
  '4L': [[1.75, 4, -85], [3.5, 8, -82], [7, 16, -79], [R14, 32, -76], [27.5, 64, -73], [55, 128, -70], [110, 256, -67], [220, 512, -64]],
  '4H': [[3.5, 12, -79], [7, 24, -76], [R14, 49, -73], [27.5, 98, -70], [55, 196, -67], [110, 392, -64], [220, 784, -61]],
  '5L': [[7, 29, -73], [R14, 58, -70], [27.5, 117, -67], [55, 235, -64], [110, 470, -61], [220, 940, -58]],
  '5H': [[3.5, 17, -73], [7, 34, -70], [R14, 68, -67], [27.5, 137, -64], [55, 274, -61], [110, 548, -58], [220, 1096, -55]],
  '6L': [[7, 39, -66], [R14, 78, -63.5], [27.5, 156, -61], [55, 313, -58], [110, 627, -55], [220, 1254, -52]],
  '6H': [[R14, 88, -60], [27.5, 176, -57.5], [55, 352, -55], [110, 705, -52], [220, 1410, -49]],
  7: [[R14, 98, -56.5], [27.5, 196, -54], [55, 392, -51.5], [110, 784, -49], [220, 1568, -46]],
  8: [[R14, 107, -53.5], [27.5, 215, -50.5], [55, 431, -48], [110, 862, -45.5], [220, 1724, -42.5]],
};
// Cuadros F.5a (RIC < 100 Mbit/s) y F.5b (RIC ≥ 100 Mbit/s). RSL por columnas de banda:
// [23 GHz, 26 y 28 GHz, 31 y 32 GHz, 38 GHz, 42 GHz]; null = la norma no da ese valor.
const F5 = {
  2: [[3.5, 4, [-89, -88, -88, -87, null]], [7, 8, [-86, -85, -85, -84, -84]], [14, 16, [-83, -82, -82, -81, -81]], [28, 32, [-80, -79, -79, -78, -78]], [56, 64, [-77, -76, -76, -75, -75]],
    [112, 128, [-74, -73, -73, -72, -72]]],
  3: [[3.5, 6, [-84, -83, -83, -82, null]], [7, 12, [-81, -80, -80, -79, -79]], [14, 24, [-78, -77, -77, -76, -76]], [28, 48, [-75, -74, -74, -73, -73]], [56, 96, [-72, -71, -71, -70, -70]],
    [112, 191, [-69, -68, -68, -67, -67]], [224, 382, [-66, -65, -65, -64, -64]]],
  '4L': [[3.5, 8, [-82, -81, -81, -80, null]], [7, 16, [-79, -78, -78, -77, -77]], [14, 32, [-76, -75, -75, -74, -74]], [28, 64, [-73, -72, -72, -71, -71]],
    [56, 128, [-70, -69, -69, -68, -68]], [112, 256, [-67, -66, -66, -65, -65]], [224, 512, [-64, -63, -63, -62, -62]]],
  '4H': [[7, 24, [-76, -75, -75, -74, -74]], [14, 49, [-73, -72, -72, -71, -71]], [28, 98, [-70, -69, -69, -68, -68]],
    [56, 196, [-67, -66, -66, -65, -65]], [112, 392, [-64, -63, -63, -62, -62]], [224, 784, [-61, -60, -60, -59, -59]]],
  '5L': [[7, 29, [-73, -72, -71.5, -70.5, -70.5]], [14, 58, [-70, -69, -69, -68, -68]],
    [28, 117, [-67, -66, -66, -65, -65]], [56, 235, [-64, -63, -63, -62, -62]], [112, 470, [-61, -60, -60, -59, -59]], [224, 940, [-58, -57, -57, -56, -56]]],
  '5H': [[7, 34, [-70, -69, -68, -67, -67]], [14, 68, [-67, -66, -66, -65, -64.5]],
    [28, 137, [-64, -63, -63, -62, -62]], [56, 274, [-61, -60, -60, -59, -59]], [112, 548, [-58, -57, -57, -56, -56]], [224, 1096, [-55, -54, -54, -53, -53]]],
  '6L': [[7, 39, [-66, -65, -64.5, -63.5, -63.5]], [14, 78, [-63.5, -62.5, -62, -61, -61]],
    [28, 156, [-61, -60, -59.5, -58.5, -58.5]], [56, 313, [-58, -57, -57, -56, -56]], [112, 627, [-55, -54, -54, -53, -53]], [224, 1254, [-52, -51, -51, -50, -50]]],
  '6H': [[14, 88, [-60, -59, -59, -57.5, -57.5]],
    [28, 176, [-57.5, -56.5, -56, -55, -55]], [56, 352, [-55, -54, -53.5, -52.5, -52.5]], [112, 705, [-52, -51, -51, -50, -50]], [224, 1410, [-49, -48, -48, -47, -47]]],
  7: [[14, 98, [-56.5, -55.5, -55.5, -54.5, -54.5]],
    [28, 196, [-54, -53, -52.5, -51.5, -51.5]], [56, 392, [-51.5, -50.5, -50, -49, -49]], [112, 784, [-49, -48, -47.5, -46.5, -46.5]], [224, 1568, [-46, -45, -44.5, -43.5, -43.5]]],
  8: [[14, 107, [-53.5, -52.5, -52.5, -51.5, -51.5]], [28, 215, [-50.5, -49.5, -49.5, -48.5, -48.5]],
    [56, 431, [-48, -47, -46.5, -46, -46]], [112, 862, [-45.5, -44.5, -44, -43, -43]], [224, 1724, [-42.5, -41.5, -41, -40, -40]]],
};

// Bandas (cuadros C.1, D.1, E.1 y F.1), en GHz
export const BANDAS = [
  { anexo: 'C', banda: '3,5', f: [3.41, 3.6] }, { anexo: 'C', banda: '4', f: [3.6, 4.2] }, { anexo: 'C', banda: 'U4', f: [4.4, 5.0] },
  { anexo: 'C', banda: 'L6', f: [5.925, 6.425] }, { anexo: 'C', banda: 'U6', f: [6.425, 7.11] }, { anexo: 'C', banda: '7', f: [7.11, 7.725] },
  { anexo: 'C', banda: '8', f: [7.725, 8.5] }, { anexo: 'C', banda: '10,5', f: [10.0, 10.68] }, { anexo: 'C', banda: '11', f: [10.7, 11.7] },
  { anexo: 'E', banda: '13', f: [12.75, 13.25] }, { anexo: 'E', banda: '15', f: [14.5, 15.35] }, { anexo: 'E', banda: '18', f: [17.7, 19.7] },
  { anexo: 'F', banda: '23', f: [22.0, 23.6], col: 0 }, { anexo: 'F', banda: '26', f: [24.5, 26.5], col: 1 }, { anexo: 'F', banda: '28', f: [27.5, 29.5], col: 1 },
  { anexo: 'F', banda: '31', f: [31.0, 31.3], col: 2 }, { anexo: 'F', banda: '32', f: [31.8, 33.4], col: 2 }, { anexo: 'F', banda: '38', f: [37.0, 39.5], col: 3 },
  { anexo: 'F', banda: '42', f: [40.5, 43.5], col: 4 },
];
export function bandaETSI(fGHz) {
  return BANDAS.find((b) => fGHz >= b.f[0] - 1e-9 && fGHz <= b.f[1] + 1e-9) || null;
}

// Separaciones de canal que aparecen en los cuadros (para el selector)
export const CS_HABITUALES = [1.75, 3.5, 7, 13.75, 14, 15, 20, 27.5, 28, 29.65, 30, 40, 55, 56, 59.3, 60, 80, 110, 112, 220, 224];

// Filas {cs: [..], ric, rsl, tabla} de una clase en la banda dada
function filas(banda, clase) {
  const norm = (rows, tabla, valor = (r) => r[2]) => (rows || []).map((r) => ({ cs: Array.isArray(r[0]) ? r[0] : [r[0]], ric: r[1], rsl: valor(r), tabla })).filter((r) => r.rsl != null);
  if (banda.anexo === 'C') {
    const r = norm(C6[clase], 'C.6');
    const d = D5[clase];
    if (d && ['4', 'U4', 'U6', '8', '11'].includes(banda.banda)) {
      const col = banda.banda === '11' ? 1 : 0;
      for (const [cs, ric, v] of d) if (cs === 40 || ['U6', '11'].includes(banda.banda)) r.push({ cs: [cs], ric, rsl: v[col], tabla: 'D.5' });
    }
    return r;
  }
  if (banda.anexo === 'E') return banda.banda === '18' ? norm(E5B[clase], 'E.5b') : norm(E5A[clase], 'E.5a');
  return norm(F5[clase], (F5[clase] || []).length ? 'F.5a/F.5b' : '', (r) => r[2][banda.col])
    .map((x) => ({ ...x, tabla: x.ric < 100 ? 'F.5a' : 'F.5b' }))
    .filter((x) => !((banda.banda === '31' && x.cs[0] === 112) || (['26', '31'].includes(banda.banda) && x.cs[0] === 224)));   // nota 1 de F.5b
}

/**
 * Umbral (RSL para BER ≤ 10⁻⁶) y RIC mínima de la norma para una clase, banda y CS.
 * Si el CS no está en el cuadro, se deriva del CS más próximo de la misma clase y banda
 * con la nota del § 4.1.6: RIC × CSn/CSk y RSL + 10·log(CSn/CSk).
 * @returns {{rsl, ric, tabla, csRef, derivado}} | null
 */
export function valoresETSI(fGHz, clase, csMHz) {
  const banda = bandaETSI(fGHz);
  if (!banda || clase == null) return null;
  const fs = filas(banda, String(clase));
  if (!fs.length) return null;
  const exacta = fs.find((x) => x.cs.some((c) => Math.abs(c - csMHz) < 1e-6));
  if (exacta) return { rsl: exacta.rsl, ric: exacta.ric, tabla: exacta.tabla, csRef: csMHz, derivado: false, banda };
  // Fila más próxima (por cualquiera de sus CS); se escala desde su CS nominal (el primero:
  // la RIC de «unos 56 MHz» se evalúa sobre los 56 MHz nominales, § 4.1.7)
  let mejor = null;
  for (const x of fs) for (const c of x.cs) { const dist = Math.abs(Math.log(csMHz / c)); if (!mejor || dist < mejor.dist - 1e-12) mejor = { x, dist }; }
  const c0 = mejor.x.cs[0], k = csMHz / c0;
  return { rsl: mejor.x.rsl + 10 * Math.log10(k), ric: mejor.x.ric * k, tabla: mejor.x.tabla, csRef: c0, derivado: true, banda };
}

// RIC mínima por la densidad del cuadro 1 (cuando la banda no está en la norma)
export const ricPorDensidad = (clase, csMHz) => { const c = CLASES.find((x) => x.clase === String(clase)); return c?.densidad ? c.densidad * csMHz : null; };

// Cuadros en bruto (para la verificación independiente de la transcripción)
export const TABLAS = { 'C.6': C6, 'D.5': D5, 'E.5a': E5A, 'E.5b': E5B, F5 };
