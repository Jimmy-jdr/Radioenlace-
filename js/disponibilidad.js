/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// disponibilidad.js — Cálculo completo de la disponibilidad (versión 1.5)
// Reúne la P.530-19 (multitrayecto y precipitación), la P.838-3, la
// P.837-8, la P.839-4, la P.836-6, la P.1510-1, la P.835-7 y la P.676-13.
// Sin DOM. Todos los datos climáticos se pueden sustituir por valores
// locales (campo «propios»), como piden las propias Recomendaciones.
// =====================================================================

import { coeficientesLluvia } from './p838.js';
import { atenuacionEspecifica, presionVapor, atmosferaReferencia } from './p676.js';
import {
  parametrosMultitrayecto, pwTodasProfundidades, anualDesdePeorMes, lluviaA001, atenuacionLluviaP,
  porcentajePrecipitacion, atenuacionLluviaNieve,
} from './p530.js';
import { geoclimatico, alturaLluvia, lluviaR001, probabilidadLluvia, temperaturaSuperficie, vaporAgua, dentroDeEspana } from './datos-uit.js';

export const MIN_ANO = 365.25 * 24 * 60;          // minutos de un año medio
export const S_MES = (365.25 / 12) * 24 * 3600;   // segundos de un mes medio

export const DISP_DEFECTO = { nieve: true, propios: {} };

// Normaliza las opciones guardadas en el estado (versión 1.5)
export function normalizarDisponibilidad(o) {
  const r = { ...DISP_DEFECTO, ...(o && typeof o === 'object' ? o : {}) };
  r.nieve = r.nieve !== false;
  const p = {};
  for (const { k } of DISP_PARAMETROS) {
    const v = Number(r.propios?.[k]);
    if (r.propios?.[k] !== '' && r.propios?.[k] != null && Number.isFinite(v)) p[k] = v;
  }
  r.propios = p;
  return r;
}

// Punto medio del trayecto (para leer los mapas climáticos)
export function puntoMedio(a, b) {
  const rad = Math.PI / 180;
  const f1 = a.lat * rad, f2 = b.lat * rad, l1 = a.lon * rad, dl = (b.lon - a.lon) * rad;
  const Bx = Math.cos(f2) * Math.cos(dl), By = Math.cos(f2) * Math.sin(dl);
  const lat = Math.atan2(Math.sin(f1) + Math.sin(f2), Math.sqrt((Math.cos(f1) + Bx) ** 2 + By * By));
  const lon = l1 + Math.atan2(By, Math.cos(f1) + Bx);
  return { lat: lat / rad, lon: lon / rad };
}

// Parámetros climáticos que se pueden escribir a mano (orden de la tabla)
export const DISP_PARAMETROS = [
  { k: 'K', nombre: 'Factor geoclimático K', fuente: 'P.530-19, LogK', unidad: '', formato: (x) => x.toExponential(3).replace('.', ',').replace(/e([+-])(\d+)/, (m, sg, e) => `·10${sg === '-' ? '⁻' : ''}${[...e].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')}`) },
  { k: 'dN75', nombre: 'dN<sub>75</sub>', fuente: 'P.530-19, dN75', unidad: 'N', formato: (x, f) => f(x, 2) },
  { k: 'R001', nombre: 'Intensidad de lluvia R<sub>0,01</sub>', fuente: 'P.837-8', unidad: 'mm/h', formato: (x, f) => f(x, 1) },
  { k: 'P0', nombre: 'Probabilidad anual de lluvia P<sub>0</sub>', fuente: 'P.837-8, ecs. 1–3', unidad: '%', formato: (x, f) => f(x, 2) },
  { k: 'h0', nombre: 'Isoterma de 0 °C h<sub>0</sub>', fuente: 'P.839-4', unidad: 'km', formato: (x, f) => f(x, 3) },
  { k: 'T', nombre: 'Temperatura media T', fuente: 'P.1510-1', unidad: 'K', formato: (x, f) => f(x, 1) },
  { k: 'rho', nombre: 'Vapor de agua ρ (50 %)', fuente: 'P.836-6', unidad: 'g/m³', formato: (x, f) => f(x, 2) },
];

// Datos climáticos en el punto medio: valor del mapa y valor usado (el propio, si lo hay)
export function datosClima(datos, medio, altKm, propios = {}) {
  const dentro = dentroDeEspana(medio.lat, medio.lon);
  const hay = dentro && !!datos;
  const gc = hay ? geoclimatico(datos, medio.lat, medio.lon) : null;
  const mapa = {
    K: gc?.K, dN75: gc?.dN75,
    R001: hay ? lluviaR001(datos, medio.lat, medio.lon) : null,
    P0: hay ? probabilidadLluvia(datos, medio.lat, medio.lon).P0 : null,
    h0: hay ? alturaLluvia(datos, medio.lat, medio.lon).h0 : null,
    T: hay ? temperaturaSuperficie(datos, medio.lat, medio.lon) : null,
    rho: hay ? vaporAgua(datos, medio.lat, medio.lon, altKm) : null,
  };
  const r = { dentro, medio, altKm };
  for (const { k } of DISP_PARAMETROS) {
    const propio = propios[k] != null;
    r[k] = { v: propio ? propios[k] : mapa[k] ?? null, propio, mapa: mapa[k] ?? null };
  }
  return r;
}

/**
 * Disponibilidad del enlace.
 * @param o.dKm, o.fGHz, o.pol ('H'|'V')
 * @param o.yA, o.yB   cota de cada antena (m s. n. m.)
 * @param o.ht         cota media del terreno (m)
 * @param o.F          margen frente a desvanecimientos planos (dB)
 * @param o.clima      salida de datosClima()
 * @param o.nieve      aplicar el método combinado de lluvia y nieve húmeda (§ 2.4.2)
 */
export function calcularDisponibilidad(o) {
  const { dKm, fGHz, pol, yA, yB, ht, F, clima, nieve = true } = o;
  const avisos = [];
  const falta = ['K', 'dN75', 'R001', 'h0', 'P0'].filter((k) => clima[k]?.v == null);
  if (falta.length) return { clima, error: `Faltan datos climáticos (${falta.join(', ')}): el punto medio del enlace está fuera de la zona de los mapas incluidos (26–45° N, 19° O–5° E). Escríbelos a mano.` };

  // ---- Multitrayecto (§ 2.3) ----
  const mp = { aplica: dKm > 5 };
  if (mp.aplica) {
    Object.assign(mp, parametrosMultitrayecto({ dKm, fGHz, he: yA, hr: yB, ht, K: clima.K.v, dN75: clima.dN75.v }));
    const r = pwTodasProfundidades(mp.p0, Math.max(F, 0));
    Object.assign(mp, r);
    mp.pwMes = Math.min(r.pw, 100);
    mp.pAnual = anualDesdePeorMes(mp.pwMes);
    if (dKm < 7.5 || dKm > 300) avisos.push(`La ec. (7) de la P.530 se ajustó con trayectos de 7,5 a 300 km; este mide ${dKm.toFixed(1).replace('.', ',')} km.`);
    if (fGHz < mp.fmin) avisos.push(`Por debajo de unos ${mp.fmin.toFixed(2).replace('.', ',')} GHz (15/d, ec. 10) el método de multitrayecto no es fiable para este trayecto.`);
    if (fGHz > 45) avisos.push('La ec. (7) se considera válida hasta unos 45 GHz.');
    if (mp.hc < 26 || mp.hc > 1180) avisos.push(`El despeje medio hc = ${mp.hc.toFixed(0)} m queda fuera del intervalo de ajuste de la ec. (7) (26–1 180 m).`);
  } else {
    mp.pwMes = 0; mp.pAnual = 0;
  }

  // ---- Precipitación (§ 2.4) ----
  const elev = (Math.atan2(yB - yA, dKm * 1000) * 180) / Math.PI;
  const tau = pol === 'V' ? 90 : 0;
  const c838 = coeficientesLluvia(fGHz, elev, tau);
  const R001 = clima.R001.v;
  const gammaR = c838.k * R001 ** c838.alfa;
  const ll = { ...c838, elev, tau, R001, gammaR, ...lluviaA001({ dKm, fGHz, R001, gammaR, alfa: c838.alfa }) };
  const lluvia = (p) => atenuacionLluviaP(ll.A001, fGHz, p);
  ll.hR = clima.h0.v * 1000 + 360;                                       // P.839-4, ec. (1): hR = h0 + 0,36 km
  ll.P0 = clima.P0.v;
  const pr = porcentajePrecipitacion({ F, lluvia, A001: ll.A001, fGHz, P0: ll.P0, hrainm: ll.hR, h1: yA, h2: yB, nieve });
  Object.assign(ll, { p: pr.p, fuera: pr.fuera, caso: pr.caso });
  ll.A001total = nieve ? atenuacionLluviaNieve({ lluvia, P0: ll.P0, hrainm: ll.hR, h1: yA, h2: yB, p: 0.01 }).A : ll.A001;
  if (dKm > 60) avisos.push('El método de lluvia de la P.530 se considera válido hasta 60 km.');
  if (fGHz > 175) avisos.push('El método de lluvia de la P.530 se considera válido hasta 175 GHz.');
  if (pr.fuera === 'bajo') avisos.push('El margen es tan amplio que la lluvia lo supera menos del 0,001 % del año: el resultado es una extrapolación de la ec. (34).');
  if (pr.fuera === 'alto') avisos.push('El margen es tan escaso que la lluvia lo supera más del 1 % del año: la ec. (34) solo se ha validado entre el 0,001 y el 1 %.');
  if (fGHz < 5) avisos.push('Por debajo de unos 5 GHz la atenuación por lluvia suele ser despreciable.');

  // ---- Resultado (§§ 2.3.6, 2.4.7 y 7) ----
  const pMp = mp.pAnual, pLl = ll.p;
  const total = Math.min(100, pMp + pLl);
  return {
    dKm, fGHz, F, mp, ll, avisos, clima, yA, yB, ht, formulaF: o.formulaF || '', sustitucionF: o.sustitucionF || '',
    Pns: mp.pwMes / 100,                       // ec. (28), peor mes
    Prain: pLl / 100,                          // ec. (100), año
    indisp: total,                             // % del año (suma de ambos, § 7)
    disp: 100 - total,
    minAno: (total / 100) * MIN_ANO,
    sMesMp: (mp.pwMes / 100) * S_MES,
    minAnoLluvia: (pLl / 100) * MIN_ANO,
  };
}

// Atenuación por gases (P.530 § 2.1, ec. 1; P.676-13): Aa = γa·d.
// Atmósfera a la altitud media de las antenas: presión total de la P.835-7,
// temperatura de la P.1510-1 y ρ de la P.836-6 (o valores propios).
export function atenuacionGases({ fGHz, dKm, altKm, T, rho }) {
  const P = atmosferaReferencia(altKm).P;
  const e = presionVapor(rho, T);
  const g = atenuacionEspecifica(fGHz, P - e, e, T);
  return { P, e, pSeco: P - e, T, rho, ...g, A: g.g * dKm };
}

// ---------- Cálculos paso a paso (versión 1.5) ----------
const nc = (x, f) => (x === 0 ? '0' : Math.abs(x) < 1e-3 || Math.abs(x) >= 1e5 ? x.toExponential(3).replace('.', ',').replace(/e([+-])(\d+)/, (m, s, e) => `·10<sup>${s === '-' ? '−' : ''}${e}</sup>`) : f(x, 4));
export function pasosDisponibilidad(r, f) {
  if (!r?.ll) return [];
  const G = 'Disponibilidad (UIT-R P.530-19)';
  const { mp, ll, clima } = r;
  const origen = (k) => (clima[k].propio ? 'valor propio' : 'mapa de la UIT');
  const pasos = [];
  pasos.push({
    grupo: G, id: 'disp-margen', titulo: 'Margen frente a desvanecimientos planos (F)',
    corta: 'F = margen del presupuesto (50 % del tiempo)',
    formula: r.formulaF, sustitucion: r.sustitucionF, resultado: `F = ${f(r.F, 2)} dB`,
    nota: 'La P.530 parte del margen en condiciones medianas. Con Longley–Rice se recalcula la pérdida para el 50 % del tiempo, porque la variabilidad temporal la añade después la propia P.530.',
  });
  if (mp.aplica) {
    pasos.push({
      grupo: G, id: 'disp-geo', titulo: 'Datos geoclimáticos del punto medio',
      corta: 'K, dN<sub>75</sub>, ε<sub>p</sub>, h<sub>c</sub>',
      datos: `Punto medio: ${f(clima.medio.lat, 4)}° N, ${f(clima.medio.lon, 4)}° E. K = ${nc(clima.K.v, f)} (${origen('K')}); dN<sub>75</sub> = ${f(clima.dN75.v, 2)} (${origen('dN75')}).`,
      formula: '|ε<sub>p</sub>| = |h<sub>r</sub> − h<sub>e</sub>| / d (ec. 5);  h<sub>c</sub> = (h<sub>r</sub> + h<sub>e</sub>)/2 − d²/102 − h<sub>t</sub> (ec. 6)',
      sustitucion: `|ε<sub>p</sub>| = |${f(r.yB, 1)} − ${f(r.yA, 1)}| / ${f(r.dKm, 3)} = ${f(mp.ep, 3)} mrad;  h<sub>c</sub> = (${f(r.yB, 1)} + ${f(r.yA, 1)})/2 − ${f(r.dKm, 3)}²/102 − ${f(r.ht, 1)};  v<sub>sr</sub> = ${f(mp.vsr, 4)}`,
      resultado: `h<sub>c</sub> = ${f(mp.hc, 1)} m`,
      nota: 'K y dN<sub>75</sub> salen por interpolación bilineal de los ficheros LogK.csv y dN75.csv de la P.530-19 (§ 2.3.1, paso 1). h<sub>t</sub> es la cota media del terreno a lo largo del perfil; v<sub>sr</sub> es el parámetro subrefractivo de las ecs. (8) y (9).',
    });
    pasos.push({
      grupo: G, id: 'disp-p0', titulo: 'Factor de aparición del multitrayecto (p<sub>0</sub>)',
      corta: 'p<sub>0</sub> = K·d<sup>3,51</sup>·(f²+13)<sup>0,447</sup>·10<sup>…</sup>',
      formula: 'p<sub>0</sub> = K·d<sup>3,51</sup>·(f² + 13)<sup>0,447</sup>·10<sup>−0,376·tanh((h<sub>c</sub>−147)/125) − 0,334·|ε<sub>p</sub>|<sup>0,39</sup> − 0,00027·h<sub>L</sub> + 17,85·v<sub>sr</sub></sup>  (ec. 11)',
      sustitucion: `K = ${nc(clima.K.v, f)}; d = ${f(r.dKm, 3)} km; f = ${f(r.fGHz, 3)} GHz; h<sub>L</sub> = ${f(mp.hL, 1)} m`,
      resultado: `p<sub>0</sub> = ${nc(mp.p0, f)} %`,
      nota: 'Es la ec. (7) con A = 0: el porcentaje del peor mes en que se superaría un desvanecimiento de 0 dB según la distribución de desvanecimientos profundos.',
    });
    pasos.push({
      grupo: G, id: 'disp-pw', titulo: 'Multitrayecto: porcentaje del peor mes (p<sub>w</sub>)',
      corta: mp.profundo ? 'p<sub>w</sub> = p<sub>0</sub>·10<sup>−A/10</sup>' : 'p<sub>w</sub> = 100·[1 − exp(−10<sup>−q<sub>a</sub>·A/20</sup>)]',
      formula: mp.profundo ? `A ≥ A<sub>t</sub> = 25 + 1,2·log p<sub>0</sub> (ec. 12) → p<sub>w</sub> = p<sub>0</sub>·10<sup>−A/10</sup> (ec. 13)` : 'A < A<sub>t</sub> → interpolación de las ecs. (14) a (18): p<sub>w</sub> = 100·[1 − exp(−10<sup>−q<sub>a</sub>·A/20</sup>)]',
      sustitucion: `A = F = ${f(r.F, 2)} dB; A<sub>t</sub> = ${f(mp.At, 2)} dB${mp.profundo ? '' : `; q<sub>a</sub> = ${f(mp.qa, 4)}`}`,
      resultado: `p<sub>w</sub> = ${nc(mp.pwMes, f)} %`,
      nota: 'Porcentaje del peor mes medio en que el desvanecimiento supera el margen F: probabilidad de corte no selectivo P<sub>ns</sub> = p<sub>w</sub>/100 (§ 2.3.6). No incluye el desvanecimiento selectivo, que depende de la «firma» del equipo (§ 2.3.7).',
    });
    pasos.push({
      grupo: G, id: 'disp-anual', titulo: 'Multitrayecto: del peor mes al año (P.841-7)',
      corta: 'p = p<sub>w</sub> / Q(p)',
      formula: 'p = p<sub>w</sub>/Q (ec. 24), con Q(p) de la P.841-7 (ec. 4): Q<sub>1</sub> = 2,85 y β = 0,13',
      sustitucion: `p<sub>w</sub> = ${nc(mp.pwMes, f)} %; Q = ${f(mp.pwMes / mp.pAnual, 3)}`,
      resultado: `p = ${nc(mp.pAnual, f)} %`,
      nota: 'Q vale 12 para porcentajes muy pequeños y baja hacia 2,85·p<sup>−0,13</sup> al crecer p: el peor mes acumula buena parte del multitrayecto de todo el año.',
    });
  }
  pasos.push({
    grupo: G, id: 'disp-gammar', titulo: 'Atenuación específica por lluvia (γ<sub>R</sub>, UIT-R P.838-3)',
    corta: 'γ<sub>R</sub> = k·R<sup>α</sup>',
    datos: `R<sub>0,01</sub> = ${f(ll.R001, 2)} mm/h (${origen('R001')}); polarización ${ll.tau === 90 ? 'vertical' : 'horizontal'}; elevación del trayecto θ = ${f(ll.elev, 3)}°`,
    formula: 'γ<sub>R</sub> = k·R<sup>α</sup>, con k y α de las ecs. (2) a (5) de la P.838-3',
    sustitucion: `k = ${f(ll.k, 5)}; α = ${f(ll.alfa, 4)}; γ<sub>R</sub> = ${f(ll.k, 5)}·${f(ll.R001, 2)}<sup>${f(ll.alfa, 4)}</sup>`,
    resultado: `γ<sub>R</sub> = ${f(ll.gammaR, 4)} dB/km`,
    nota: 'k<sub>H</sub>, k<sub>V</sub>, α<sub>H</sub> y α<sub>V</sub> salen de ajustes gaussianos en log f (cuadros 1 a 4 de la P.838-3); para polarización vertical u horizontal en un trayecto casi horizontal coinciden con los del cuadro 5.',
  });
  pasos.push({
    grupo: G, id: 'disp-a001', titulo: 'Atenuación por lluvia superada el 0,01 % (A<sub>0,01</sub>)',
    corta: 'A<sub>0,01</sub> = γ<sub>R</sub>·d·r',
    formula: 'r = 1 / (0,477·d<sup>0,633</sup>·R<sub>0,01</sub><sup>0,073·α</sup>·f<sup>0,123</sup> − 10,579·(1 − e<sup>−0,024·d</sup>)) (ec. 32);  A<sub>0,01</sub> = γ<sub>R</sub>·d·r (ec. 33)',
    sustitucion: `d = ${f(r.dKm, 3)} km; f = ${f(r.fGHz, 3)} GHz (en la ec. 32: f ≥ 6 GHz, d ≤ 30 km, R ≥ 3 mm/h) → r = ${f(ll.r, 4)}, d<sub>ef</sub> = ${f(ll.deff, 3)} km`,
    resultado: `A<sub>0,01</sub> = ${f(ll.A001, 2)} dB`,
    nota: 'r es el factor de distancia: la lluvia intensa no cubre todo el trayecto a la vez.',
  });
  pasos.push({
    grupo: G, id: 'disp-lluvia', titulo: 'Porcentaje del año en que la precipitación supera F',
    corta: 'A<sub>p</sub> = A<sub>0,01</sub>·C<sub>1</sub>·p<sup>−(C<sub>2</sub> + C<sub>3</sub>·log p)</sup> = F',
    datos: `h<sub>0</sub> = ${f(clima.h0.v, 3)} km (${origen('h0')}) → h<sub>R</sub> = h<sub>0</sub> + 0,36 km = ${f(ll.hR, 0)} m (P.839-4); P<sub>0</sub> = ${f(ll.P0, 2)} % (${origen('P0')}); antenas a ${f(r.yA, 0)} y ${f(r.yB, 0)} m`,
    formula: ll.caso === 3 ? 'Método combinado de lluvia y nieve húmeda (§ 2.4.2, ecs. 37–71): se busca p con A<sub>lluvia+nieve</sub>(p) = F' : ll.caso === 2 ? 'h<sub>lo</sub> ≥ h<sub>R</sub> + 2 400 m → atenuación nula (§ 2.4.2, caso 2)' : 'A<sub>p</sub>/A<sub>0,01</sub> = C<sub>1</sub>·p<sup>−(C<sub>2</sub> + C<sub>3</sub>·log<sub>10</sub> p)</sup> (ec. 34), resuelta para A<sub>p</sub> = F',
    sustitucion: `F = ${f(r.F, 2)} dB; A<sub>0,01</sub> = ${f(ll.A001, 2)} dB${ll.caso === 3 ? ` (con nieve húmeda, A<sub>0,01</sub> = ${f(ll.A001total, 2)} dB)` : ''}`,
    resultado: ll.fuera === 'bajo' ? 'p < 0,001 %' : `p = ${nc(ll.p, f)} %`,
    nota: 'La capa de fusión (nieve húmeda) puede atenuar más que la lluvia en enlaces de montaña; la P.530-19 pide usar el método combinado salvo que se sepa que el trayecto no le afecta. La ec. (34) se ha validado entre el 0,001 y el 1 % del tiempo.',
  });
  pasos.push({
    grupo: G, id: 'disp-total', titulo: 'Indisponibilidad y disponibilidad del año',
    corta: 'U = p<sub>multitrayecto</sub> + p<sub>lluvia</sub>',
    formula: 'U = p<sub>multitrayecto, año</sub> + p<sub>lluvia</sub> ;  Disponibilidad = 100 − U (§ 7)',
    sustitucion: `U = ${nc(mp.pAnual, f)} + ${nc(ll.p, f)}`,
    resultado: `U = ${nc(r.indisp, f)} %`,
    nota: `Disponibilidad = ${f(r.disp, 6)} %; tiempo fuera de servicio: ${f(r.minAno, 1)} min/año. La P.530 (§ 7) asigna el corte por aire claro sobre todo a la calidad (G.826/G.828) y el de la lluvia a la disponibilidad; aquí se suman para dar una cifra única y orientativa del tiempo fuera de servicio.`,
  });
  return pasos;
}

// Filas para el informe CSV (apartado, magnitud, fórmula, sustitución, valor, unidad)
export function filasDisponibilidad(r) {
  if (!r?.ll) return [];
  const { mp, ll, clima } = r;
  const D = 'Disponibilidad (UIT-R P.530-19)';
  const o = (k) => (clima[k].propio ? ' (valor propio)' : ' (mapa de la UIT)');
  const filas = [
    [D, 'Punto medio del trayecto (lat, lon)', '', '', `${clima.medio.lat.toFixed(5)}, ${clima.medio.lon.toFixed(5)}`, '°', false],
    [D, 'Margen frente a desvanecimientos planos (F)', textoPlano(r.formulaF), textoPlano(r.sustitucionF), r.F, 'dB'],
    [D, 'Cota de la antena A (h_e)', '', '', r.yA, 'm'],
    [D, 'Cota de la antena B (h_r)', '', '', r.yB, 'm'],
    [D, 'Cota media del terreno (h_t)', '', '', r.ht, 'm'],
    [D, `Factor geoclimático K${o('K')}`, 'K = 10^LogK', '', clima.K.v, '%'],
    [D, `dN75${o('dN75')}`, '', '', clima.dN75.v, 'N'],
  ];
  if (mp.aplica) {
    filas.push([D, 'Inclinación del trayecto |εp|', '|εp| = |hr − he| / d', '', mp.ep, 'mrad']);
    filas.push([D, 'Despeje medio del trayecto (hc)', 'hc = (hr + he)/2 − d²/102 − ht', '', mp.hc, 'm']);
    filas.push([D, 'Parámetro subrefractivo (vsr)', 'vsr = min[(dN75/50)^1,8·exp(−hc/(2,5·√d)), vsr,lím]', '', mp.vsr, '']);
    filas.push([D, 'Factor de aparición del multitrayecto (p0)', 'p0 = K·d^3,51·(f²+13)^0,447·10^(…)', '', mp.p0, '%']);
    filas.push([D, 'Profundidad de transición (At)', 'At = 25 + 1,2·log10 p0', '', mp.At, 'dB']);
    filas.push([D, 'Multitrayecto: porcentaje del peor mes (pw)', mp.profundo ? 'pw = p0·10^(−F/10)' : 'pw = 100·[1 − exp(−10^(−qa·F/20))]', '', mp.pwMes, '%']);
    filas.push([D, 'Multitrayecto: porcentaje del año (P.841-7)', 'p = pw / Q(p); Q1 = 2,85; β = 0,13', '', mp.pAnual, '%']);
  } else filas.push([D, 'Multitrayecto', 'd ≤ 5 km: no se calcula (§ 2.3.1)', '', 0, '%']);
  filas.push([D, `Intensidad de lluvia R0,01${o('R001')}`, '', '', ll.R001, 'mm/h']);
  filas.push([D, 'Coeficiente k (P.838-3)', '', '', ll.k, '']);
  filas.push([D, 'Exponente α (P.838-3)', '', '', ll.alfa, '']);
  filas.push([D, 'Atenuación específica (γR)', 'γR = k·R^α', '', ll.gammaR, 'dB/km']);
  filas.push([D, 'Factor de distancia (r)', 'r = 1/(0,477·d^0,633·R^(0,073·α)·f^0,123 − 10,579·(1 − e^(−0,024·d)))', '', ll.r, '']);
  filas.push([D, 'Atenuación por lluvia superada el 0,01 % (A0,01)', 'A0,01 = γR·d·r', '', ll.A001, 'dB']);
  filas.push([D, `Isoterma de 0 °C (h0)${o('h0')}`, '', '', clima.h0.v, 'km']);
  filas.push([D, 'Altura media de la lluvia (hR, P.839-4)', 'hR = h0 + 0,36 km', '', ll.hR, 'm']);
  filas.push([D, `Probabilidad anual de lluvia (P0)${o('P0')}`, '', '', ll.P0, '%']);
  filas.push([D, 'Método de precipitación', '', '', ll.caso === 3 ? 'Lluvia y nieve húmeda (§ 2.4.2)' : ll.caso === 2 ? 'Sin atenuación (capa de fusión por debajo)' : 'Solo lluvia (§ 2.4.1)', '', false]);
  filas.push([D, 'Precipitación: porcentaje del año en que se supera F', 'Ap(p) = F', '', ll.p, '%']);
  filas.push([D, 'Indisponibilidad total (año)', 'U = p_multitrayecto + p_lluvia', '', r.indisp, '%']);
  filas.push([D, 'Tiempo fuera de servicio', 'U/100 · 525 960 min', '', r.minAno, 'min/año']);
  filas.push([D, 'Disponibilidad', '100 − U', '', r.disp, '%']);
  r.avisos.forEach((a, i) => filas.push([D, `Aviso ${i + 1}`, '', '', a, '', false]));
  return filas;
}
const textoPlano = (h) => String(h ?? '').replace(/<sup>/g, '^').replace(/<sub>/g, '').replace(/<[^>]+>/g, '');
