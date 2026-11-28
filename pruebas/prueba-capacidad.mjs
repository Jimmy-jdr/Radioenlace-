// Pruebas de la capacidad (versión 1.5): node pruebas/prueba-capacidad.mjs
// ETSI EN 302 217-2 V3.4.1: valores de los cuadros, coherencia interna, derivación
// del § 4.1.6, velocidad binaria y modulación adaptativa.
import { CLASES, valoresETSI, bandaETSI, ricPorDensidad } from '../js/etsi.js';
import { velocidadBinaria, calcularCapacidad, normalizarCapacidad, CAP_DEFECTO, pasosCapacidad, filasCapacidad } from '../js/capacidad.js';

let fallos = 0, n = 0;
const ok = (nombre, c, extra = '') => { n++; if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${nombre}${extra ? `  [${extra}]` : ''}`); };
const cerca = (a, b, t) => Math.abs(a - b) <= t;

// Valores leídos en los cuadros de la norma (comprobación de la transcripción)
const MUESTRAS = [
  [7.5, '6L', 28, -63, 156, 'C.6'], [7.5, '2', 1.75, -93, 2, 'C.6'], [11.2, '8', 112, -46, 862, 'C.6'], [6.2, '4L', 20, -76, 45, 'C.6'],
  [7.5, '5H', 7, -72.5, 34, 'C.6'], [10.6, '7', 30, -55, 196, 'C.6'],
  [7.0, '5L', 40, -68, 168, 'D.5'], [11.2, '5L', 40, -67, 168, 'D.5'], [11.2, '5L', 80, -64, 336, 'D.5'], [6.8, '8', 80, -47.5, 616, 'D.5'],
  [13.0, '5H', 7, -71.5, 34, 'E.5a'], [15.0, '6L', 56, -59, 313, 'E.5a'],
  [18.0, '2', 220, -71, 265, 'E.5b'], [18.0, '5H', 13.75, -67, 68, 'E.5b'], [18.0, '8', 27.5, -50.5, 215, 'E.5b'],
  [23.0, '5L', 7, -73, 29, 'F.5a'], [32.0, '5L', 7, -71.5, 29, 'F.5a'], [42.0, '5H', 14, -64.5, 68, 'F.5a'],
  [23.0, '7', 112, -49, 784, 'F.5b'], [38.0, '7', 112, -46.5, 784, 'F.5b'], [28.0, '6H', 56, -54, 352, 'F.5b'], [31.1, '6L', 28, -59.5, 156, 'F.5b'],
];
const malos = MUESTRAS.filter(([fG, c, cs, rsl, ric, t]) => { const v = valoresETSI(fG, c, cs); return !v || v.derivado || v.rsl !== rsl || v.ric !== ric || v.tabla !== t; });
ok(`ETSI: ${MUESTRAS.length} valores de los cuadros C.6, D.5, E.5a, E.5b, F.5a y F.5b`, !malos.length, JSON.stringify(malos[0] || ''));

// Coherencia: en cada banda y canal, el umbral sube con la clase y la RIC también
const BANDAS_PRUEBA = [3.5, 4.0, 4.7, 6.2, 6.8, 7.5, 8.0, 10.3, 11.2, 13.0, 15.0, 18.0, 23.0, 25.0, 28.5, 31.1, 32.5, 38.0, 42.0];
const CSs = [1.75, 3.5, 7, 13.75, 14, 15, 20, 27.5, 28, 30, 40, 55, 56, 60, 80, 110, 112, 220, 224];
let mono = 0, nmono = 0;
for (const fG of BANDAS_PRUEBA) for (const cs of CSs) {
  const v = CLASES.filter((c) => c.clase).map((c) => valoresETSI(fG, c.clase, cs)).filter((x) => x && !x.derivado);
  for (let i = 1; i < v.length; i++) { nmono++; if (!(v[i].rsl >= v[i - 1].rsl && v[i].ric > v[i - 1].ric)) mono++; }
}
ok('ETSI: umbral y RIC crecen con la clase en cada banda y canal', mono === 0 && nmono > 300, `${nmono} pares`);
// Coherencia: duplicar el canal sube el umbral unos 3 dB (10·log 2)
let e3 = 0, n3 = 0;
for (const fG of BANDAS_PRUEBA) for (const c of CLASES.filter((x) => x.clase)) for (const [a, b] of [[1.75, 3.5], [3.5, 7], [7, 14], [14, 28], [28, 56], [56, 112], [112, 224], [13.75, 27.5], [27.5, 55], [55, 110], [110, 220], [40, 80]]) {
  const va = valoresETSI(fG, c.clase, a), vb = valoresETSI(fG, c.clase, b);
  if (va && vb && !va.derivado && !vb.derivado) { n3++; e3 = Math.max(e3, Math.abs(vb.rsl - va.rsl - 3)); }
}
ok('ETSI: al duplicar el canal el umbral sube 3 dB (± 1 dB en los cuadros)', e3 <= 1 && n3 > 150, `máx. desviación ${e3} dB en ${n3} pares`);
// RIC de los cuadros frente al cuadro 1 (densidad × CS nominal)
let eric = 0;
for (const fG of BANDAS_PRUEBA) for (const c of CLASES.filter((x) => x.clase)) for (const cs of [7, 14, 28, 56, 112]) {
  const v = valoresETSI(fG, c.clase, cs);
  if (v && !v.derivado && v.tabla !== 'D.5') eric = Math.max(eric, Math.abs(v.ric / (c.densidad * cs) - 1));
}
ok('ETSI: RIC de los cuadros = densidad del cuadro 1 × CS (redondeo a Mbit/s)', eric < 0.04, `máx. ${(eric * 100).toFixed(2)} %`);
ok('ETSI: cuadro 1 (densidades 1,14 a 7,7 Mbit/s/MHz)', CLASES[0].densidad === 1.14 && CLASES[6].densidad === 5.6 && CLASES[9].densidad === 7.7 && ricPorDensidad('6L', 28) === 5.6 * 28);

// Derivación del § 4.1.6
const d = valoresETSI(4.7, '5L', 80);   // U4: 80 MHz solo existe en U6 y 11 → se deriva de 56 MHz (C.6)
ok('§ 4.1.6: CS no tabulado → RIC × CSn/CSk y RSL + 10·log(CSn/CSk)', d.derivado && d.csRef === 56 && cerca(d.rsl, -65 + 10 * Math.log10(80 / 56), 1e-12) && cerca(d.ric, 235 * 80 / 56, 1e-9));
ok('Bandas: 26 GHz sin 224 MHz y 31 GHz sin 112 MHz (nota 1 de F.5b)', valoresETSI(25, '6L', 224).derivado && valoresETSI(31.1, '6L', 112).derivado && !valoresETSI(28, '6L', 224).derivado);
ok('Bandas: detección por frecuencia y fuera de la norma', bandaETSI(7.5).banda === '7' && bandaETSI(18.7).banda === '18' && bandaETSI(38.5).anexo === 'F' && bandaETSI(5.8) === null && bandaETSI(2.4) === null && valoresETSI(5.8, '6L', 28) === null);

// Velocidad binaria
ok('Rb = CS/(1+α)·log2M·r: 28 MHz, 256QAM, α = 0,25, r = 0,9 → 161,28 Mbit/s', cerca(velocidadBinaria(28, 256, 0.25, 0.9), 161.28, 1e-9));
ok('Con los valores por defecto todas las clases superan su RIC mínima a 7, 14, 28, 56 y 112 MHz (C.6)', [7, 14, 28, 56, 112].every((cs) => calcularCapacidad({ fGHz: 7.5, cap: normalizarCapacidad({ cs }) }).filas.every((x) => x.cumpleRIC !== false)));
ok('Ficha SAF Integra-X (28 MHz, ETSI): 162/185/208/230 Mbit/s con 256–2048QAM ≈ Rb por defecto (± 10 %)', [[256, 162], [512, 185], [1024, 208], [2048, 230]].every(([M, v]) => Math.abs(velocidadBinaria(28, M, 0.25, 0.9) / v - 1) < 0.1));

// Modulación adaptativa con una disponibilidad simulada (U = 10^(−F/10) %)
const cap = normalizarCapacidad({ cs: 28, sel: ['2', '4L', '6L', '7'] });
const r = calcularCapacidad({ fGHz: 7.5, cap, F: 30, sens: -81, dispCon: (F) => ({ indisp: 10 ** (-F / 10), disp: 100 - 10 ** (-F / 10), minAno: 0 }) });
const u = r.usadas;
const media = u.reduce((s, x, i) => s + x.Rb * ((i + 1 < u.length ? u[i + 1].indisp : 100) - x.indisp) / 100, 0);
ok('Adaptativa: margen de cada modulación = F + Srx − umbral', u.every((x) => cerca(x.margen, 30 - 81 - x.umbral, 1e-12)) && u[0].margen === 30);
ok('Adaptativa: capacidad media = Σ Rb,i·(Ui+1 − Ui)', cerca(r.media, media, 1e-9) && r.media < u[3].Rb && r.media > u[2].Rb, `${r.media.toFixed(2)} Mbit/s`);
const objetivo = u.filter((x) => x.disp >= 99.99);
ok('Adaptativa: garantizada = la más alta que llega al objetivo', r.garantizada === objetivo[objetivo.length - 1], r.garantizada?.nombre);
const fija = calcularCapacidad({ fGHz: 7.5, cap: normalizarCapacidad({ cs: 28, sel: ['6L'] }), F: 30, sens: -81, dispCon: (F) => ({ indisp: 10 ** (-F / 10), disp: 100 - 10 ** (-F / 10) }) });
ok('Modulación fija: media = Rb·(1 − U)', cerca(fija.media, fija.usadas[0].Rb * (1 - fija.usadas[0].indisp / 100), 1e-9));
const propio = calcularCapacidad({ fGHz: 7.5, cap: normalizarCapacidad({ cs: 28, sel: ['6L', '4096'], umbrales: { '6L': -70, 4096: -55 } }), F: 30, sens: -81 });
ok('Umbral propio sustituye al de la norma; 4096QAM solo con umbral propio', propio.filas.find((x) => x.clave === '6L').umbral === -70 && propio.usadas.length === 2 && calcularCapacidad({ fGHz: 7.5, cap: normalizarCapacidad({ sel: ['4096'] }) }).usadas.length === 0);
ok('Fuera de las bandas de la norma: sin umbral por defecto, RIC por densidad', calcularCapacidad({ fGHz: 5.8, cap: normalizarCapacidad({}) }).filas.every((x) => x.umbral == null && (x.clase ? x.ricMin === x.densidad * 28 : x.ricMin == null)));
ok('Estado: valores por defecto y normalización', CAP_DEFECTO.sel.length === 10 && normalizarCapacidad({ alfa: 3, r: 'x', cs: 56, sel: ['6L', 'zz'], umbrales: { '6L': '', 7: -50 } }).alfa === 0.25
  && normalizarCapacidad({ cs: 56 }).cs === 56 && normalizarCapacidad({ sel: ['6L', 'zz'] }).sel.length === 1 && normalizarCapacidad({ umbrales: { '6L': '', 7: -50 } }).umbrales[7] === -50);
ok('Pasos e informe', pasosCapacidad(r, (x, k) => x.toFixed(k)).length === 3 && filasCapacidad(r).length > 15);

console.log(`\n${fallos ? `${fallos} FALLOS de ${n}` : `Todas las pruebas de capacidad superadas (${n})`}`);
process.exit(fallos ? 1 : 0);
