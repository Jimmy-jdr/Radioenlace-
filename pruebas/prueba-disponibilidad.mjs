// Pruebas de la disponibilidad (versión 1.5): node pruebas/prueba-disponibilidad.mjs
// P.838-3, P.841-7, P.530-19 (multitrayecto, lluvia, nieve húmeda, despeje),
// P.837-8 (P0), mapas de la UIT recortados y cálculo completo.
import fs from 'fs';
import { coeficientesLluvia, atenuacionEspecificaLluvia } from '../js/p838.js';
import {
  ke999, criterioDespejeP530, factorQ, anualDesdePeorMes, parametrosMultitrayecto, pwTodasProfundidades, pwProfundo,
  factorDistanciaLluvia, coeficientesC, lluviaA001, atenuacionLluviaP, porcentajeLluvia, multiplicadorGamma,
  multiplicadorTrayecto, atenuacionLluviaNieve, PI_N, porcentajePrecipitacion, alturasMinimasP530,
} from '../js/p530.js';
import { bilineal, bicubica, probabilidadDesdeMeses, probabilidadLluvia, geoclimatico, alturaLluvia, lluviaR001, vaporAgua, temperaturaSuperficie, dentroDeEspana } from '../js/datos-uit.js';
import { datosClima, calcularDisponibilidad, atenuacionGases, puntoMedio, normalizarDisponibilidad, pasosDisponibilidad, filasDisponibilidad } from '../js/disponibilidad.js';
import { analizarPerfil, alturasMinimas } from '../js/radio.js';

let fallos = 0, n = 0;
const ok = (nombre, c, extra = '') => { n++; if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${nombre}${extra ? `  [${extra}]` : ''}`); };
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
const rel = (a, b) => Math.abs(a / b - 1);

// ---------- P.838-3 ----------
// Ejemplos de validación de la UIT (CG-3M3J-13-ValEx Rev. 8.3.0, hoja «P.838-3 Sp.Att»)
const VALEX_838 = [
  { f: 14.25, th: 31.076991235657001, R: 26.480519999999999, kh: 3.9186742018373702E-2, kv: 4.3451215355383301E-2, ah: 1.1352800825355001, av: 1.05905291969976, k: 3.9754879732931299E-2, a: 1.12418042813791, g: 1.58130839366869 },
  { f: 14.25, th: 40.232035996361603, R: 33.936231999999997, kh: 3.9186742018373702E-2, kv: 4.3451215355383301E-2, ah: 1.1352800825355001, av: 1.05905291969976, k: 4.0076240754695701E-2, a: 1.1180413774787901, g: 2.0617321312636201 },
  { f: 14.25, th: 46.359692611863402, R: 27.13586832, kh: 3.9186742018373702E-2, kv: 4.3451215355383301E-2, ah: 1.1352800825355001, av: 1.05905291969976, k: 4.03034417062706E-2, a: 1.1137601680492, g: 1.5920841993061301 },
  { f: 29, th: 31.076991235657001, kh: 0.22240103375669601, kv: 0.212395484704367, ah: 0.95802573203141295, av: 0.92032488857384398 },
];
let e838 = 0;
for (const v of VALEX_838) {
  const c = coeficientesLluvia(v.f, v.th, 0);
  e838 = Math.max(e838, rel(c.kH, v.kh), rel(c.kV, v.kv), rel(c.aH, v.ah), rel(c.aV, v.av));
  if (v.g) { const g = atenuacionEspecificaLluvia(v.f, v.R, v.th, 0); e838 = Math.max(e838, rel(g.k, v.k), rel(g.alfa, v.a), rel(g.gamma, v.g)); }
}
ok('P.838-3: reproduce la ValEx de la UIT (k, α y γR)', e838 < 1e-12, `error relativo máx. ${e838.toExponential(1)}`);
// Cuadro 5 de la P.838-3 (4 cifras)
const CUADRO5 = [[1, 0.0000259, 0.9691, 0.0000308, 0.8592], [10, 0.01217, 1.2571, 0.01129, 1.2156], [20, 0.09164, 1.0568, 0.09611, 0.9847]];
ok('P.838-3: cuadro 5 (1, 10 y 20 GHz)', CUADRO5.every(([f, kh, ah, kv, av]) => { const c = coeficientesLluvia(f); return rel(c.kH, kh) < 5e-4 && cerca(c.aH, ah, 6e-5) && rel(c.kV, kv) < 5e-4 && cerca(c.aV, av, 6e-5); }));
const c45 = coeficientesLluvia(20, 0, 45);
ok('P.838-3: polarización circular = media de H y V (θ = 0)', cerca(c45.k, (c45.kH + c45.kV) / 2, 1e-15));

// ---------- P.841-7 ----------
ok('P.841-7: Q = 12 para p muy pequeños y Q1·p^−β en el tramo central', factorQ(1e-9) === 12 && cerca(factorQ(1), 2.85, 1e-12) && cerca(factorQ(10), 2.85 * 3 ** -0.13, 1e-12));
ok('P.841-7: Q continua en 3 % y 30 %', cerca(factorQ(3 - 1e-9), factorQ(3 + 1e-9), 1e-6) && cerca(factorQ(30 - 1e-9), factorQ(30 + 1e-9), 1e-6));
let e841 = 0;
for (const pw of [2e-4, 1e-3, 0.01, 0.1, 1, 5, 7.2]) e841 = Math.max(e841, rel(anualDesdePeorMes(pw), (pw / 2.85) ** (1 / 0.87)));
ok('P.841-7: p = (pw/Q1)^(1/(1−β)) en el tramo de la ec. (6) (≈ 0,30·pw^1,15, ec. 7)', e841 < 1e-10, e841.toExponential(1));
ok('P.841-7: pw/12 para pw muy pequeño', rel(anualDesdePeorMes(1e-9), 1e-9 / 12) < 1e-10);

// ---------- P.530-19 § 2.2.2.1: despeje ----------
ok('P.530 ec. (4): ke = 157/(144 + 2670/d)', cerca(ke999(50), 157 / (144 + 2670 / 50), 1e-15) && cerca(ke999(50), 0.7953, 1e-4));
const cr = criterioDespejeP530({ dKm: 40, clima: 'tropical' });
ok('P.530 § 2.2.2.1: tropical y d > 30 km → 0,6·F1 con ke; templado extendido → 0,3·F1', cr.paso3.fraccion === 0.6 && criterioDespejeP530({ dKm: 40, obstaculo: 'extendido' }).paso3.fraccion === 0.3 && criterioDespejeP530({ dKm: 20, clima: 'tropical' }).paso3.fraccion === 0 && cr.paso1.k === 4 / 3 && cr.paso1.fraccion === 1);

// Perfil plano con una loma en el centro: la altura P.530 es la mayor de las dos
const perfil = Array.from({ length: 201 }, (_, i) => ({ d: i * 150, z: 100 + (Math.abs(i - 100) < 10 ? 60 - Math.abs(i - 100) * 6 : 0) }));
const alt = alturasMinimasP530({ dKm: 30, clima: 'templado', obstaculo: 'aislado', analizar: (k) => analizarPerfil({ perfil, hA: 10, hB: 10, fMHz: 7500, k }), minimas: alturasMinimas });
const a1 = alturasMinimas(analizarPerfil({ perfil, hA: 10, hB: 10, fMHz: 7500, k: 4 / 3 }), 1);
const a3 = alturasMinimas(analizarPerfil({ perfil, hA: 10, hB: 10, fMHz: 7500, k: ke999(30) }), 0);
ok('P.530 § 2.2.2.1: altura = máx(paso 1, paso 3) en A, B y ambas', ['a', 'b', 'igual'].every((v) => cerca(alt[v].h, Math.max(a1[v].h, a3[v].h), 1e-9)), `B: ${alt.b.h.toFixed(2)} m (paso ${alt.b.paso})`);
ok('P.530 § 2.2.2.1: exige más que el 60 % con k = 4/3 en este perfil', alt.b.h > alturasMinimas(analizarPerfil({ perfil, hA: 10, hB: 10, fMHz: 7500, k: 4 / 3 }), 0.6).b.h);

// ---------- P.530-19 § 2.3: multitrayecto ----------
const mp = parametrosMultitrayecto({ dKm: 40, fGHz: 7.5, he: 600, hr: 700, ht: 400, K: 10 ** -4.4, dN75: 20 });
const pwm = (A) => 10 ** -4.4 * 40 ** 3.51 * (7.5 ** 2 + 13) ** 0.447 * 10 ** (-0.376 * Math.tanh((mp.hc - 147) / 125) - 0.334 * (100 / 40) ** 0.39 - 0.00027 * 600 + 17.85 * mp.vsr - A / 10);
ok('P.530 ecs. (5)–(7): εp, hc y p0 escritos de nuevo', cerca(mp.ep, 2.5, 1e-12) && cerca(mp.hc, 650 - 1600 / 102 - 400, 1e-9) && rel(mp.p0, pwm(0)) < 1e-12);
const At = 25 + 1.2 * Math.log10(mp.p0);
ok('P.530 § 2.3.2: continuidad en la profundidad de transición At', rel(pwTodasProfundidades(mp.p0, At - 1e-9).pw, pwProfundo(mp.p0, At)) < 1e-6);
ok('P.530 § 2.3.2: pw ≤ 100 % y decreciente con A', [0, 5, 10, 15, 20, 30, 40].map((A) => pwTodasProfundidades(mp.p0, A).pw).every((x, i, v) => x <= 100 && (i === 0 || x < v[i - 1])));
ok('P.530 § 2.3.2: A ≥ At usa la ec. (13)', pwTodasProfundidades(mp.p0, 40).profundo && rel(pwTodasProfundidades(mp.p0, 40).pw, pwm(40)) < 1e-12);

// ---------- P.530-19 § 2.4.1: lluvia ----------
const { C0, C1, C2, C3 } = coeficientesC(20);
ok('P.530 ec. (35): C0 = 0,12 + 0,4·log(f/10)^0,8 por encima de 10 GHz', cerca(C0, 0.12 + 0.4 * Math.log10(2) ** 0.8, 1e-15) && cerca(C1, 0.07 ** C0 * 0.12 ** (1 - C0), 1e-15) && coeficientesC(8).C0 === 0.12);
ok('P.530 ec. (32): límites f ≥ 6 GHz, d ≤ 30 km y R ≥ 3 mm/h', factorDistanciaLluvia({ dKm: 50, fGHz: 4, R001: 1, alfa: 1.1 }) === factorDistanciaLluvia({ dKm: 30, fGHz: 6, R001: 3, alfa: 1.1 }));
const gR = atenuacionEspecificaLluvia(18, 30, 0, 90);
const ll = lluviaA001({ dKm: 15, fGHz: 18, R001: 30, gammaR: gR.gamma, alfa: gR.alfa });
ok('P.530 ec. (34) a p = 0,01 %: Ap = A0,01 (C1·0,01^−(C2 − 2·C3) = 1 salvo redondeo de la Recomendación)', rel(atenuacionLluviaP(ll.A001, 18, 0.01), ll.A001) < 0.02, `${(atenuacionLluviaP(ll.A001, 18, 0.01) / ll.A001).toFixed(4)}`);
let eInv = 0;
for (const p of [0.001, 0.003, 0.01, 0.05, 0.2, 1]) eInv = Math.max(eInv, rel(porcentajeLluvia(ll.A001, 18, atenuacionLluviaP(ll.A001, 18, p)).p, p));
ok('P.530 ec. (34): inversa exacta (p → A → p) de 0,001 a 1 %', eInv < 1e-10, eInv.toExponential(1));
ok('P.530 ec. (34): avisa fuera de 0,001–1 %', porcentajeLluvia(ll.A001, 18, ll.A001 * 10).fuera === 'bajo' && porcentajeLluvia(ll.A001, 18, ll.A001 / 20).fuera === 'alto');

// ---------- P.530-19 § 2.4.2: lluvia y nieve húmeda ----------
ok('P.530 cuadro 2: 49 probabilidades que suman 1', PI_N.length === 49 && cerca(PI_N.reduce((s, x) => s + x, 0), 1, 5e-6) && PI_N[24] === 0.049977 && PI_N[0] === PI_N[48]);
ok('P.530 ec. (43): Γ = 0 por encima de hrain, 1 por debajo de −1 200 m', multiplicadorGamma(10) === 0 && multiplicadorGamma(-1300) === 1 && multiplicadorGamma(0) === 0);
const gmax = Math.max(...Array.from({ length: 1201 }, (_, i) => multiplicadorGamma(-i)));
ok('P.530 ec. (43): la capa de fusión multiplica la atenuación (máx. > 3,5)', gmax > 3.5 && gmax < 4.2, gmax.toFixed(3));
ok('P.530 Función 2: trayecto por debajo de la capa → g = 1; por encima → g = 0', multiplicadorTrayecto(3000, 100, 200) === 1 && multiplicadorTrayecto(3000, 3100, 3300) === 0);
// Trayecto horizontal dentro de una rebanada: g = Γ(Δh) (ec. 45)
ok('P.530 ec. (45): trayecto en una sola rebanada', cerca(multiplicadorTrayecto(3000, 2950, 2960), multiplicadorGamma(2955 - 3000), 1e-15));
// Promedio de Γ a lo largo de un trayecto inclinado (integración numérica) ≈ g
const hlo = 1800, hhi = 2900, hr = 2700;
let integral = 0; const N = 200000;
for (let i = 0; i < N; i++) integral += multiplicadorGamma(hlo + (hhi - hlo) * (i + 0.5) / N - hr);
ok('P.530 Función 2: g ≈ promedio de Γ a lo largo del trayecto (rebanadas de 100 m)', cerca(multiplicadorTrayecto(hr, hlo, hhi), integral / N, 0.05), `${multiplicadorTrayecto(hr, hlo, hhi).toFixed(4)} frente a ${(integral / N).toFixed(4)}`);
const lluvia = (p) => atenuacionLluviaP(ll.A001, 18, p);
ok('P.530 § 2.4.2 caso 1: antenas muy por debajo de la capa → solo lluvia', atenuacionLluviaNieve({ lluvia, P0: 5, hrainm: 4000, h1: 100, h2: 300, p: 0.01 }).A === lluvia(0.01));
ok('P.530 § 2.4.2 caso 2: antenas por encima de la capa → 0 dB', atenuacionLluviaNieve({ lluvia, P0: 5, hrainm: 1000, h1: 3500, h2: 3600, p: 0.01 }).A === 0);
const ln = atenuacionLluviaNieve({ lluvia, P0: 5, hrainm: 2800, h1: 1500, h2: 2500, p: 0.01 });
ok('P.530 § 2.4.2 caso 3: la nieve húmeda aumenta la atenuación en un enlace de montaña', ln.caso === 3 && ln.A > lluvia(0.01), `${ln.A.toFixed(2)} dB frente a ${lluvia(0.01).toFixed(2)} dB`);
const pr = porcentajePrecipitacion({ F: ln.A, lluvia, A001: ll.A001, fGHz: 18, P0: 5, hrainm: 2800, h1: 1500, h2: 2500 });
ok('P.530 § 2.4.7: p para A = F invierte el método combinado', rel(pr.p, 0.01) < 0.03, pr.p.toFixed(5));

// ---------- P.837-8 y mapas de la UIT ----------
// ValEx Rev. 8.3.0, hoja «P.837-7 Rp» (las ecs. 1–3 no cambian en la -8): r_ii y P0 a partir de MT y T
const VALEX_837 = {
  MT: [152.76341600000001, 149.898704000001, 221.92918400000099, 263.51909600000101, 211.805984, 129.48012, 140.30801600000001, 158.00970400000099, 195.683696, 268.214608, 282.33376800000002, 236.40456800000001],
  T: [25.958278133333401, 26.475406933333399, 26.793256, 26.9734941333334, 27.123524000000099, 26.977765333333299, 26.5016453333334, 26.363846400000099, 26.2731144000001, 26.229666399999999, 26.0075176, 25.803972000000002],
  r0: 5.8128250908363004, P0: 4.53654368497507,
};
const p837 = probabilidadDesdeMeses(VALEX_837.MT, VALEX_837.T.map((t) => t + 273.15));
ok('P.837-8 ecs. (1)–(3): reproduce r y P0 de la ValEx', rel(p837.meses[0].r, VALEX_837.r0) < 1e-13 && rel(p837.P0, VALEX_837.P0) < 1e-13, `P0 = ${p837.P0}`);
const datos = JSON.parse(fs.readFileSync(new URL('../datos/uit-espana.json', import.meta.url)));
const g = datos.logK;
ok('Mapas: bilineal en un nodo = valor del nodo', bilineal(g, g.lat0 + 10 * g.dlat, g.lon0 + 7 * g.dlon) === g.datos[10][7]);
ok('Mapas: bicúbica en un nodo = valor del nodo', cerca(bicubica(datos.topo, datos.topo.lat0 + 20 * 0.5, datos.topo.lon0 + 30 * 0.5), datos.topo.datos[20][30], 1e-12));
ok('Mapas: cubren España peninsular, Baleares, Canarias, Ceuta y Melilla', [[43.79, -7.69], [36.0, -5.6], [42.33, 3.32], [39.9, 4.3], [27.64, -17.98], [29.4, -13.4], [35.89, -5.32], [35.29, -2.94]].every(([la, lo]) => dentroDeEspana(la, lo) && Number.isFinite(lluviaR001(datos, la, lo)) && Number.isFinite(probabilidadLluvia(datos, la, lo).P0) && Number.isFinite(vaporAgua(datos, la, lo, 0.2))));
const mad = { R: lluviaR001(datos, 40.4168, -3.7038), h0: alturaLluvia(datos, 40.4168, -3.7038).h0, K: geoclimatico(datos, 40.4168, -3.7038).K, T: temperaturaSuperficie(datos, 40.4168, -3.7038), rho: vaporAgua(datos, 40.4168, -3.7038, 0.65) };
ok('Mapas: valores plausibles en Madrid', mad.R > 15 && mad.R < 40 && mad.h0 > 2 && mad.h0 < 3.5 && mad.K > 1e-6 && mad.K < 1e-4 && mad.T > 280 && mad.T < 295 && mad.rho > 4 && mad.rho < 10,
  `R0,01 ${mad.R.toFixed(1)} mm/h, h0 ${mad.h0.toFixed(2)} km, K ${mad.K.toExponential(2)}, T ${(mad.T - 273.15).toFixed(1)} °C, ρ ${mad.rho.toFixed(2)} g/m³`);
ok('P.836-6: ρ baja con la altitud (vsch)', vaporAgua(datos, 40.4, -3.7, 1.5) < vaporAgua(datos, 40.4, -3.7, 0.5));

// ---------- Cálculo completo ----------
const medio = puntoMedio({ lat: 40.0, lon: -4.0 }, { lat: 40.2, lon: -3.8 });
ok('Punto medio sobre el círculo máximo', cerca(medio.lat, 40.1003, 1e-3) && cerca(medio.lon, -3.9, 1e-3));
const clima = datosClima(datos, medio, 0.7, {});
const r1 = calcularDisponibilidad({ dKm: 28, fGHz: 13, pol: 'V', yA: 650, yB: 720, ht: 600, F: 38, clima, nieve: true });
ok('Disponibilidad: resultado completo y coherente', !r1.error && r1.disp > 99 && r1.disp < 100 && cerca(r1.indisp, r1.mp.pAnual + r1.ll.p, 1e-15) && cerca(r1.minAno, r1.indisp / 100 * 525960, 1e-9));
const r2 = calcularDisponibilidad({ dKm: 28, fGHz: 13, pol: 'V', yA: 650, yB: 720, ht: 600, F: 45, clima, nieve: true });
ok('Disponibilidad: más margen → más disponibilidad', r2.disp > r1.disp);
const rH = calcularDisponibilidad({ dKm: 28, fGHz: 13, pol: 'H', yA: 650, yB: 720, ht: 600, F: 38, clima, nieve: true });
ok('Disponibilidad: la polarización H se atenúa más que la V', rH.ll.gammaR > r1.ll.gammaR && rH.ll.p > r1.ll.p);
const propia = calcularDisponibilidad({ dKm: 28, fGHz: 13, pol: 'V', yA: 650, yB: 720, ht: 600, F: 38, clima: datosClima(datos, medio, 0.7, { R001: 60 }), nieve: true });
ok('Disponibilidad: un valor propio de R0,01 sustituye al del mapa', propia.ll.R001 === 60 && propia.ll.p > r1.ll.p);
const fuera = calcularDisponibilidad({ dKm: 28, fGHz: 13, pol: 'V', yA: 650, yB: 720, ht: 600, F: 38, clima: datosClima(datos, { lat: 50, lon: 10 }, 0.7, {}) });
ok('Disponibilidad: fuera de los mapas pide los datos a mano', !!fuera.error);
const corto = calcularDisponibilidad({ dKm: 4, fGHz: 23, pol: 'V', yA: 650, yB: 660, ht: 600, F: 30, clima, nieve: false });
ok('Disponibilidad: d ≤ 5 km sin multitrayecto (§ 2.3.1)', !corto.mp.aplica && corto.mp.pAnual === 0);
ok('Disponibilidad: pasos y filas del informe', pasosDisponibilidad(r1, (x, d) => x.toFixed(d)).length === 9 && filasDisponibilidad(r1).length > 20 && pasosDisponibilidad({ pendiente: 'x' }).length === 0);
const s = normalizarDisponibilidad({ nieve: false, propios: { K: '1e-5', R001: 'abc', P0: null } });
ok('Estado: normaliza las opciones guardadas', s.nieve === false && s.propios.K === 1e-5 && !('R001' in s.propios) && !('P0' in s.propios) && normalizarDisponibilidad().nieve === true);

// ---------- Gases (P.676-13) ----------
const gas = atenuacionGases({ fGHz: 22.235, dKm: 10, altKm: 0, T: 288.15, rho: 7.5 });
ok('Gases: pico del vapor de agua a 22,235 GHz (≈ 0,2 dB/km con ρ = 7,5 g/m³)', gas.gw > 0.15 && gas.gw < 0.25 && cerca(gas.A, gas.g * 10, 1e-12), `${gas.g.toFixed(4)} dB/km`);

console.log(`\n${fallos ? `${fallos} FALLOS de ${n}` : `Todas las pruebas de disponibilidad superadas (${n})`}`);
process.exit(fallos ? 1 : 0);
