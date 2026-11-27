/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// modelos.js — Registro de modelos de propagación
//
// Cada modelo es un objeto con la misma "forma":
//   id, nombre, corto, disponible, necesitaPerfil
//   calcular(ctx) -> { perdida (dB), simbolo, incluyeTerreno, aviso, detalle }
//       incluyeTerreno: true si la pérdida ya tiene en cuenta el relieve
//       (entonces no se suma la difracción en filo de cuchillo P.526).
//   explicar(ctx, res, fmt) -> paso o lista de pasos de la explicación
// ctx = { dKm, fMHz, perfil (puntos {d, z}), hA, hB, itm (parámetros) }
// Los mapas de cobertura (versión 1.3) podrán llamar a calcular() para
// cada píxel con terreno.obtenerPerfil() entre el transmisor y ese punto.
// =====================================================================
import { perdidasEspacioLibre, K_FSPL } from './radio.js';
import { ITM_P2P_TLS, perfilAPfl, SUELOS, CLIMAS, MODOS_PROPAGACION, ERRORES, textosAvisos } from './itm.js';

// Parámetros por defecto del ITM (aprobados para la versión 1.2)
export const ITM_DEFECTO = { clima: 5, n0: 301, suelo: 'medio', pol: 'V', tiempo: 50 };
export const ITM_TIEMPOS = [50, 90, 99, 99.9];
// Variabilidad: modo accidental (1) + 10 = sin variabilidad de ubicaciones
// (emplazamientos fijos); situaciones al 50 %.
export const ITM_MDVAR = 11;
export const ITM_SITUACIONES = 50;
const ITM_UBICACIONES = 50;        // sin efecto con mdvar = 11, pero debe ser válido

const esp = (dKm, fMHz) => perdidasEspacioLibre(dKm, fMHz);

// Normaliza los parámetros guardados (pueden llegar como texto del formulario)
export function parametrosITM(p = {}) {
  const r = { ...ITM_DEFECTO, ...p };
  r.clima = Number(r.clima);
  if (!CLIMAS[r.clima]) r.clima = ITM_DEFECTO.clima;
  r.n0 = Number(r.n0);
  if (!(r.n0 >= 250 && r.n0 <= 400)) r.n0 = ITM_DEFECTO.n0;
  if (!SUELOS[r.suelo]) r.suelo = ITM_DEFECTO.suelo;
  if (r.pol !== 'H' && r.pol !== 'V') r.pol = ITM_DEFECTO.pol;
  r.tiempo = Number(r.tiempo);
  if (!ITM_TIEMPOS.includes(r.tiempo)) r.tiempo = ITM_DEFECTO.tiempo;
  return r;
}

export function calcularITM({ dKm, fMHz, perfil, hA, hB, itm }) {
  const P = parametrosITM(itm);
  const suelo = SUELOS[P.suelo];
  const base = { simbolo: 'L<sub>b</sub>', parametros: P, suelo };
  const respaldo = (aviso) => ({ ...base, simbolo: 'L<sub>el</sub>', perdida: esp(dKm, fMHz), incluyeTerreno: false, aviso, detalle: null });
  if (!perfil || perfil.length < 3) {
    return respaldo('Longley–Rice necesita el perfil del terreno. Mientras se descarga se muestran las pérdidas en espacio libre.');
  }
  const faltan = perfil.filter((p) => p.z == null).length;
  if (faltan) {
    return respaldo(`Longley–Rice necesita todas las cotas del perfil y faltan ${faltan}. Se usan las pérdidas en espacio libre con la difracción en filo de cuchillo.`);
  }
  const pfl = perfilAPfl(perfil);
  const r = ITM_P2P_TLS(hA, hB, pfl, P.clima, P.n0, fMHz, P.pol === 'V' ? 1 : 0, suelo.epsilon, suelo.sigma,
    ITM_MDVAR, P.tiempo, ITM_UBICACIONES, ITM_SITUACIONES);
  if (r.error) {
    return respaldo(`Longley–Rice no se puede aplicar: ${ERRORES[r.error] || `error ${r.error}`} Se usan las pérdidas en espacio libre con la difracción en filo de cuchillo.`);
  }
  return {
    ...base,
    perdida: r.A__db,
    incluyeTerreno: true,
    aviso: null,
    detalle: { ...r, pfl: { n: pfl[0] + 1, paso: pfl[1] }, avisos: textosAvisos(r.warnings), modoTexto: MODOS_PROPAGACION[r.inter.mode] },
  };
}

export const MODELOS = [
  {
    id: 'espacio-libre',
    nombre: 'Espacio libre (Friis)',
    corto: 'espacio libre',
    disponible: true,
    necesitaPerfil: false,
    calcular({ dKm, fMHz }) {
      return { perdida: esp(dKm, fMHz), simbolo: 'L<sub>el</sub>', incluyeTerreno: false, aviso: null, detalle: null };
    },
    explicar({ dKm, fMHz }, res, f) {
      return {
        titulo: 'Pérdidas en espacio libre (L<sub>el</sub>)',
        corta: 'L<sub>el</sub> = 20·log(4π·d / λ)',
        formula: 'L<sub>el</sub> = 32,45 + 20·log<sub>10</sub>(d<sub>km</sub>) + 20·log<sub>10</sub>(f<sub>MHz</sub>)',
        sustitucion:
          `L<sub>el</sub> = ${f(K_FSPL, 2)} + 20·log<sub>10</sub>(${f(dKm, 3)}) + 20·log<sub>10</sub>(${f(fMHz, 1)})` +
          ` = ${f(K_FSPL, 2)} + ${f(20 * Math.log10(dKm), 2)} + ${f(20 * Math.log10(fMHz), 2)}`,
        resultado: `${f(res.perdida, 2)} dB`,
        nota: 'Equivale a L = 20·log<sub>10</sub>(4π·d/λ) (UIT-R P.525). La constante sale de 20·log<sub>10</sub>(4π·10<sup>9</sup>/c) = 32,448 al expresar d en km y f en MHz; la UIT-R P.525 la redondea a 32,4 (diferencia de 0,05 dB). La app usa el valor exacto. Solo considera la dispersión de la energía con la distancia: no tiene en cuenta el relieve.',
      };
    },
  },
  {
    id: 'longley-rice',
    nombre: 'Longley–Rice (ITM 1.2.2, punto a punto)',
    corto: 'Longley–Rice',
    disponible: true,
    necesitaPerfil: true,
    calcular: calcularITM,
    explicar: (ctx, res, f) => pasosITM(ctx, res, f),
  },
];

export const obtenerModelo = (id) => MODELOS.find((m) => m.id === id && m.disponible) || MODELOS[0];

// ---------------------------------------------------------------------
// Explicación paso a paso del ITM
// ---------------------------------------------------------------------
const MODO_CORTO = { 1: 'línea de visión', 2: 'difracción', 3: 'dispersión troposférica' };

function pasosITM(ctx, res, f) {
  const { dKm, fMHz } = ctx;
  const P = res.parametros, S = res.suelo;
  const sci = (x, d = 3) => { // notación científica: 1,57·10⁻⁷
    if (x === 0 || !Number.isFinite(x)) return f(x, d);
    const e = Math.floor(Math.log10(Math.abs(x)));
    return `${f(x / 10 ** e, d)}·10<sup>${String(e).replace('-', '−')}</sup>`;
  };
  if (!res.detalle) {
    // Sin ITM (perfil pendiente, cotas que faltan o datos fuera de rango): se usa espacio libre
    const pe = MODELOS[0].explicar(ctx, { perdida: res.perdida }, f);
    return [{ ...pe, nota: `${res.aviso} ${pe.nota}` }];
  }
  const r = res.detalle, v = r.inter, c = v.coef;
  const ae = v.a_e__meter, kEf = ae / 6370e3;
  const dm = v.d__km * 1000;
  const pasos = [];
  const G = 'Propagación: Longley–Rice (ITM)';
  const pct = (t) => f(t, Number.isInteger(t) ? 0 : 1);

  pasos.push({
    grupo: G, id: 'itm-datos',
    titulo: 'Datos del modelo Longley–Rice',
    corta: 'ITM 1.2.2 · modo punto a punto',
    datos: `Perfil: ${r.pfl.n} cotas cada ${f(r.pfl.paso, 1)} m · d = ${f(v.d__km, 3)} km · f = ${f(fMHz, 1)} MHz · h<sub>A</sub> = ${f(ctx.hA, 1)} m, h<sub>B</sub> = ${f(ctx.hB, 1)} m`,
    formula: 'Entradas: perfil del terreno, alturas, frecuencia, clima, N<sub>0</sub>, suelo (ε<sub>r</sub>, σ), polarización y variabilidad',
    sustitucion: `Clima ${P.clima} (${CLIMAS[P.clima].toLowerCase()}) · N<sub>0</sub> = ${f(P.n0, 0)} unidades N · ${S.nombre.toLowerCase()}: ε<sub>r</sub> = ${f(S.epsilon, 0)}, σ = ${f(S.sigma, 3)} S/m · polarización ${P.pol === 'V' ? 'vertical' : 'horizontal'}<br>` +
      `Variabilidad: modo accidental, sin variabilidad de ubicaciones (emplazamientos fijos), situaciones al ${f(ITM_SITUACIONES, 0)} % y tiempo al ${pct(P.tiempo)} %`,
    resultado: `Modo de propagación: ${MODO_CORTO[v.mode]}`,
    nota: 'Modelo de terreno irregular del ITS/NTIA (Longley y Rice, 1968; algoritmo de Hufford, versión 1.2.2), válido de 20 MHz a 20 GHz y de 1 a 2000 km. La app reproduce la implementación de referencia en C++ del NTIA (github.com/NTIA/itm) y se ha verificado contra ella con miles de casos (diferencias menores de 10<sup>−9</sup> dB). El ITM usa el perfil completo, pero no tiene en cuenta edificios ni vegetación.',
  });

  pasos.push({
    grupo: G, id: 'itm-refractividad',
    titulo: 'Refractividad en superficie y radio terrestre efectivo',
    corta: 'N<sub>s</sub> = N<sub>0</sub>·e<sup>−h<sub>s</sub>/9460</sup> ; a<sub>e</sub> = 1/γ<sub>e</sub>',
    datos: `h<sub>s</sub> = ${f(v.h_sys__meter, 1)} m (cota media del perfil sin el 10 % de cada extremo)`,
    formula: 'N<sub>s</sub> = N<sub>0</sub>·e<sup>−h<sub>s</sub>/9460</sup> ;  γ<sub>e</sub> = 157·10<sup>−9</sup>·(1 − 0,04665·e<sup>N<sub>s</sub>/179,3</sup>) m<sup>−1</sup> ;  a<sub>e</sub> = 1/γ<sub>e</sub> ;  k = a<sub>e</sub> / 6370 km',
    sustitucion: `N<sub>s</sub> = ${f(P.n0, 0)}·e<sup>−${f(v.h_sys__meter, 1)}/9460</sup> = ${f(v.N_s, 2)} ;  γ<sub>e</sub> = 157·10<sup>−9</sup>·(1 − 0,04665·e<sup>${f(v.N_s, 2)}/179,3</sup>) = ${sci(1 / ae, 4)} m<sup>−1</sup>`,
    resultado: `N<sub>s</sub> = ${f(v.N_s, 1)} ; a<sub>e</sub> = ${f(ae / 1000, 0)} km (k = ${f(kEf, 3)})`,
    nota: 'Ecuaciones 4.3 y 4.4 de la NBS Technical Note 101. El ITM calcula su propia curvatura a partir de N<sub>0</sub> y de la altitud del trayecto: el factor k elegido en «Datos» solo se usa para dibujar el perfil y comprobar el despeje de Fresnel. Con N<sub>s</sub> = 301 resulta k ≈ 4/3.',
  });

  const dhd = v.delta_h__meter * (1 - 0.8 * Math.exp(-(v.d_end__meter - v.d_start__meter) / 50e3));
  pasos.push({
    grupo: G, id: 'itm-deltah',
    titulo: 'Irregularidad del terreno (Δh)',
    corta: 'Δh = Δh(d) / (1 − 0,8·e<sup>−d/50 km</sup>)',
    datos: `Tramo analizado: de ${f(v.d_start__meter / 1000, 3)} a ${f(v.d_end__meter / 1000, 3)} km desde A`,
    formula: 'Δh(d) = diferencia entre los percentiles 10 y 90 de las desviaciones del terreno respecto a su recta de regresión ;  Δh = Δh(d) / (1 − 0,8·e<sup>−d/50 km</sup>)',
    sustitucion: `Δh(d) = ${f(dhd, 2)} m ;  Δh = ${f(dhd, 2)} / (1 − 0,8·e<sup>−${f((v.d_end__meter - v.d_start__meter) / 1000, 3)}/50</sup>)`,
    resultado: `Δh = ${f(v.delta_h__meter, 1)} m`,
    nota: 'Δh mide lo accidentado que es el terreno (ERL 79-ITS 67, ec. 3). Valores orientativos del ITM: agua o terreno muy liso ≈ 0 m, llanuras ≈ 30 m, colinas ≈ 90 m, montañas ≈ 200 m y montañas muy abruptas ≈ 500 m. Se descarta el terreno cercano a cada antena: el menor de 15 veces su altura o el 10 % de su distancia al horizonte.',
  });

  pasos.push({
    grupo: G, id: 'itm-horizontes',
    titulo: 'Horizontes y alturas efectivas',
    corta: 'd<sub>L</sub> = d<sub>L1</sub> + d<sub>L2</sub> ; d<sub>Ls</sub> = √(2h<sub>e1</sub>a<sub>e</sub>) + √(2h<sub>e2</sub>a<sub>e</sub>)',
    formula: 'd<sub>Ls</sub> = √(2·h<sub>e1</sub>·a<sub>e</sub>) + √(2·h<sub>e2</sub>·a<sub>e</sub>) (horizonte en tierra lisa) ;  d<sub>L</sub> = d<sub>L1</sub> + d<sub>L2</sub> (horizontes reales) ;  θ<sub>e</sub> = θ<sub>1</sub> + θ<sub>2</sub> + d/a<sub>e</sub>',
    sustitucion: `h<sub>e1</sub> = ${f(v.h_e__meter[0], 1)} m, h<sub>e2</sub> = ${f(v.h_e__meter[1], 1)} m ;  d<sub>L1</sub> = ${f(v.d_hzn__meter[0] / 1000, 3)} km, d<sub>L2</sub> = ${f(v.d_hzn__meter[1] / 1000, 3)} km ;  θ<sub>1</sub> = ${f(v.theta_hzn[0] * 1000, 2)} mrad, θ<sub>2</sub> = ${f(v.theta_hzn[1] * 1000, 2)} mrad<br>` +
      `d<sub>Ls</sub> = ${f(c.d_sML__meter / 1000, 3)} km ;  d<sub>L</sub> = ${f(c.d_ML__meter / 1000, 3)} km ;  d = ${f(v.d__km, 3)} km`,
    resultado: dm < c.d_sML__meter ? `d < d<sub>Ls</sub> → región de línea de visión` : `d ≥ d<sub>Ls</sub> → trayecto transhorizonte (${MODO_CORTO[v.mode]})`,
    nota: 'Las alturas efectivas h<sub>e</sub> son las alturas de las antenas sobre la recta que mejor se ajusta al terreno cercano (o, en trayectos cortos, sobre todo el perfil). Los ángulos de horizonte θ son las elevaciones del rayo que roza el obstáculo más alto visto desde cada extremo; negativos si el horizonte queda por debajo de la horizontal. El modo de propagación lo decide el ITM comparando d con d<sub>Ls</sub> (el horizonte en tierra lisa con las alturas efectivas), no con el rayo real: puede indicar «línea de visión» aunque el relieve corte el rayo, y en ese caso la rugosidad Δh y la recta de difracción elevan la atenuación. Algoritmo de Hufford, ec. 4.12 y 6.15 de la TN101.',
  });

  let formulaRef, sustRef;
  if (v.mode === 1) {
    formulaRef = 'A<sub>ref</sub> = A<sub>o</sub> + k<sub>1</sub>·d + k<sub>2</sub>·ln(d)   (d en m)';
    sustRef = `A<sub>ref</sub> = ${f(c.A_o__db, 3)} + ${sci(c.kHat_1__db_per_meter, 4)}·${f(dm, 1)} + ${f(c.kHat_2__db_per_meter, 4)}·ln(${f(dm, 1)})`;
  } else if (v.mode === 2) {
    formulaRef = 'A<sub>ref</sub> = A<sub>ed</sub> + m<sub>d</sub>·d   (d en m)';
    sustRef = `A<sub>ref</sub> = ${f(c.A_d0__db, 3)} + ${sci(c.M_d, 4)}·${f(dm, 1)}`;
  } else {
    formulaRef = 'A<sub>ref</sub> = A<sub>es</sub> + m<sub>s</sub>·d   (d en m)';
    sustRef = `A<sub>ref</sub> = ${f(c.A_s0__db, 3)} + ${sci(c.M_s, 4)}·${f(dm, 1)}`;
  }
  if (v.A_ref_sin_limitar__db < 0) sustRef += ` = ${f(v.A_ref_sin_limitar__db, 2)} → se limita a 0 dB`;
  pasos.push({
    grupo: G, id: 'itm-aref',
    titulo: 'Atenuación de referencia sobre el espacio libre (A<sub>ref</sub>)',
    corta: formulaRef,
    datos: `Recta de difracción: m<sub>d</sub> = ${sci(c.M_d, 4)} dB/m, A<sub>ed</sub> = ${f(c.A_d0__db, 3)} dB`,
    formula: formulaRef,
    sustitucion: sustRef,
    resultado: `A<sub>ref</sub> = ${f(v.A_ref__db, 2)} dB`,
    nota: {
      1: 'Línea de visión: el ITM ajusta una curva entre la atenuación de dos rayos (directo y reflejado en el suelo, ponderada por la rugosidad Δh) y la recta de difracción en el horizonte de tierra lisa (ERL 79-ITS 67, ec. 3.16 a 3.21).',
      2: 'Difracción: combinación ponderada de la difracción en filo de cuchillo doble y la difracción en tierra esférica (Vogler), más un término de obstáculos (ERL 79-ITS 67, ec. 3.23 a 3.38). Es la recta que pasa por dos distancias muy dentro de la región de difracción.',
      3: 'Dispersión troposférica: la señal llega por dispersión en la troposfera, más allá del alcance de la difracción (TN101, cap. 9). Solo aparece en trayectos largos.',
    }[v.mode],
  });

  pasos.push({
    grupo: G, id: 'itm-afs',
    titulo: 'Pérdidas en espacio libre del ITM (L<sub>bf</sub>)',
    corta: 'L<sub>bf</sub> = 32,45 + 20·log f + 20·log d',
    formula: 'L<sub>bf</sub> = 32,45 + 20·log<sub>10</sub>(f<sub>MHz</sub>) + 20·log<sub>10</sub>(d<sub>km</sub>)',
    sustitucion: `L<sub>bf</sub> = 32,45 + 20·log<sub>10</sub>(${f(fMHz, 1)}) + 20·log<sub>10</sub>(${f(v.d__km, 3)})`,
    resultado: `L<sub>bf</sub> = ${f(v.A_fs__db, 2)} dB`,
    nota: 'El ITM usa la constante 32,45 (la del modelo de espacio libre de la app es la exacta, 32,448): 0,002 dB de diferencia.',
  });

  const corregida = v.sin_corregir__db < 0;
  pasos.push({
    grupo: G, id: 'itm-variabilidad',
    titulo: 'Variabilidad: clima y porcentaje de tiempo',
    corta: 'A = A<sub>ref</sub> − V<sub>med</sub> − Y<sub>T</sub> − Y<sub>S</sub>',
    datos: `Distancia efectiva d<sub>e</sub> = ${f(v.d_e__meter / 1000, 2)} km ; z<sub>T</sub> = ${f(v.z_T, 4)} (tiempo ${pct(P.tiempo)} %) ; z<sub>S</sub> = ${f(v.z_S, 4)} (situaciones ${f(ITM_SITUACIONES, 0)} %)`,
    formula: 'A = A<sub>ref</sub> − V<sub>med</sub> − Y<sub>T</sub> − Y<sub>S</sub>   (si A &lt; 0: A·(29 − A)/(29 − 10·A))',
    sustitucion: `A = ${f(v.A_ref__db, 2)} − (${f(v.V_med__db, 2)}) − (${f(v.Y_R__db, 2)}) − (${f(v.Y_S__db, 2)}) = ${f(v.sin_corregir__db, 2)} dB` +
      (corregida ? ` → corregida: ${f(v.corregida__db, 2)} dB` : ''),
    resultado: `A = ${f(v.corregida__db, 2)} dB`,
    nota: `V<sub>med</sub> es la corrección del valor mediano anual según el clima (${CLIMAS[P.clima].toLowerCase()}); Y<sub>T</sub> = σ<sub>T</sub>·z<sub>T</sub> es la desviación para el porcentaje de tiempo elegido (al 50 % vale casi 0); Y<sub>S</sub> recoge las situaciones y vale 0 al 50 %. Con un porcentaje de tiempo mayor, la pérdida que no se supera es mayor (Algoritmo de Hufford, cap. 5).`,
  });

  pasos.push({
    grupo: G, id: 'perdida',
    titulo: 'Pérdida básica de transmisión con Longley–Rice (L<sub>b</sub>)',
    corta: 'L<sub>b</sub> = L<sub>bf</sub> + A',
    formula: 'L<sub>b</sub> = L<sub>bf</sub> + A',
    sustitucion: `L<sub>b</sub> = ${f(v.A_fs__db, 2)} dB ${v.corregida__db < 0 ? '−' : '+'} ${f(Math.abs(v.corregida__db), 2)} dB`,
    resultado: `${f(res.perdida, 2)} dB`,
    nota: `Es la pérdida que no se supera durante el ${pct(P.tiempo)} % del tiempo. Diferencia con la pérdida en espacio libre de la app (${f(esp(dKm, fMHz), 2)} dB): ${f(res.perdida - esp(dKm, fMHz), 2)} dB. Ya incluye el efecto del relieve, así que no se suma la difracción en filo de cuchillo.` +
      (r.avisos.length ? ` Avisos del modelo: ${r.avisos.join(' ')}` : ''),
  });
  return pasos;
}
