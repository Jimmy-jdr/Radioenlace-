// Pruebas automáticas de los cálculos. Ejecutar con:  node pruebas/prueba-calculos.mjs
import * as R from '../js/radio.js';
import { leerArcGrid, muestrearMalla } from '../js/terreno.js';
import { obtenerModelo } from '../js/modelos.js';
import { aUTM } from '../js/utm.js';

let fallos = 0;
function cerca(nombre, valor, esperado, tol) {
  const ok = Math.abs(valor - esperado) <= tol;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}: ${valor.toFixed(3)} (esperado ${esperado} ± ${tol})`);
}
function cierto(nombre, cond) { if (!cond) fallos++; console.log(`${cond ? 'OK   ' : 'FALLO'} ${nombre}`); }

// --- Ejercicio teórico: 5 GHz, 10 km, 20 W, 30 + 30 dBi, S = −90 dBm, pérdidas 0 dB ---
const fMHz = R.aMHz(5, 'GHz');
const ptx = R.potenciaDbm(20, 'W');
const L = obtenerModelo('espacio-libre').calcular({ dKm: 10, fMHz }).perdida;
const pb = R.presupuesto({ ptxDbm: ptx, gtx: 30, grx: 30, ltx: 0, lrx: 0, perdidaTrayecto: L, sensibilidad: -90 });
cerca('Ptx (dBm)', ptx, 43.01, 0.01);
cerca('Pérdidas espacio libre (dB)', L, 126.4, 0.05);
cerca('Potencia recibida (dBm)', pb.prx, -23.4, 0.05);
cerca('Margen (dB)', pb.margen, 66.6, 0.05);
cerca('Radio 1.ª zona de Fresnel en el punto medio (m)', R.radioFresnel(5000, 5000, fMHz), 12.2, 0.05);
cerca('Constante FSPL', R.K_FSPL, 32.45, 0.005);

// --- Geometría: puntos situados a 10 km exactos ---
const A = { lat: 39.96, lon: -4.83 };
const B = R.destino(A, 90, 10);
cerca('Distancia tras destino() (km)', R.distanciaKm(A, B), 10, 1e-6);
const pts = R.puntosTrayecto(A, B, 11);
cerca('Punto medio a 5 km', R.distanciaKm(A, pts[5]), 5, 1e-6);

// --- Curvatura: flecha en el centro de 10 km con k = 4/3 (fórmula d1·d2/(12,74·k)) ---
cerca('Flecha k=4/3 (m)', R.flechaTierra(5000, 5000, 4 / 3), (5 * 5) / (12.742 * 4 / 3), 0.01);
cierto('Flecha k=∞ es 0', R.flechaTierra(5000, 5000, Infinity) === 0);
cerca('k "4/3"', R.leerK('4/3'), 1.3333, 0.001);
cerca('Número con coma', R.leerNumero('−90,5'), -90.5, 1e-9);

// --- Análisis de perfil plano con antenas de 30 m ---
const perfil = pts.map((p) => ({ ...p, z: 0 }));
const an = R.analizarPerfil({ perfil, hA: 30, hB: 30, fMHz, k: 4 / 3 });
cierto('Perfil plano 30 m: despejado', an.estado === 'despejado');
cerca('r1 medio del análisis', an.r1Medio, 12.24, 0.01);
// Obstáculo en el centro de 25 m: invade el 60 % (despeje = 30 − 25 − 1,47 = 3,5 m < 0,6·12,24)
perfil[5].z = 25;
const an2 = R.analizarPerfil({ perfil, hA: 30, hB: 30, fMHz, k: 4 / 3 });
cierto('Obstáculo de 25 m: invade Fresnel', an2.estado === 'fresnel' && an2.peor.i === 5);
perfil[5].z = 40;
const an3 = R.analizarPerfil({ perfil, hA: 30, hB: 30, fMHz, k: 4 / 3 });
cierto('Obstáculo de 40 m: sin visión directa', an3.estado === 'obstruido' && an3.invasiones.length === 1);
perfil[5].z = null;
const an4 = R.analizarPerfil({ perfil, hA: 30, hB: 30, fMHz, k: 4 / 3 });
cierto('Cota que falta contabilizada', an4.faltan === 1 && an4.peor.i !== 5);

// --- Lector ArcGrid e interpolación ---
const asc = 'ncols 3\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n 10 20 30\n 0.5 1 2\n';
const m = leerArcGrid(asc);
cerca('ArcGrid: centro celda inferior izq.', muestrearMalla(m, 0.5, 0.5) ?? NaN, 0.5, 1e-9);
cerca('ArcGrid: bilineal', muestrearMalla(m, 1.0, 1.0) ?? NaN, (0.5 + 1 + 10 + 20) / 4, 1e-9);
const asc2 = 'ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ndx 2\ndy 1\nNODATA_value -9999\n 1 -9999\n 1 1\n';
cierto('ArcGrid: dx/dy y NODATA', muestrearMalla(leerArcGrid(asc2), 1, 2) === null);

// --- Difracción en filo de cuchillo (UIT-R P.526) ---
cerca('J(0) = 6,0 dB', R.perdidaFiloCuchillo(0), 6.02, 0.05);
cierto('J = 0 para ν ≤ −0,78', R.perdidaFiloCuchillo(-0.8) === 0 && R.perdidaFiloCuchillo(-2) === 0);
cerca('ν con h = r1 es √2', R.parametroNu(R.radioFresnel(4000, 6000, 5800), 4000, 6000, 5800), Math.SQRT2, 1e-9);
// Caso de la captura del 26/11: h = 118,4 m, r1 = 15,34 m → ν ≈ 10,9, J ≈ 33,6 dB
cerca('Obstáculo de 118,4 m sobre r1 = 15,34 m: J', R.perdidaFiloCuchillo(118.4 * Math.SQRT2 / 15.34), 33.6, 0.1);

// --- UTM ETRS89: vértice geodésico IGN 060239 «Cruces» (reseña oficial) ---
const v = aUTM(40 + 9 / 60 + 14.85926 / 3600, -(4 + 44 / 60 + 36.04026 / 3600)); // ETRS89
cerca('Vértice Cruces: X UTM ETRS89 (oficial 351519,844 m)', v.x, 351519.844, 0.002);
cerca('Vértice Cruces: Y UTM ETRS89 (oficial 4446320,995 m)', v.y, 4446320.995, 0.002);
cierto('Vértice Cruces: huso 30', v.huso === 30);

// --- Longley–Rice (ITM): casos oficiales del NTIA y salida de la referencia en C++ ---
const { ITM_P2P_TLS, perfilAPfl } = await import('../js/itm.js');
const { calcularITM, parametrosITM, ITM_DEFECTO } = await import('../js/modelos.js');
const { readFileSync } = await import('node:fs');
const casosITM = JSON.parse(readFileSync(new URL('./casos-ntia-itm.json', import.meta.url), 'utf8')).casos;
for (const c of casosITM) {
  const r = ITM_P2P_TLS(c.h_tx, c.h_rx, c.pfl, c.clima, c.N_0, c.f, c.pol, c.eps, c.sigma, c.mdvar, c.tiempo, c.ubicaciones, c.situaciones);
  const tag = `${c.origen}, ${c.f} MHz`;
  cerca(`ITM ${tag}: A frente al valor publicado`, r.A__db, c.A_ntia, 0.005 + (c.A_ntia === 114.5 ? 0.05 : 0));
  cerca(`ITM ${tag}: A frente a la referencia C++`, r.A__db, c.ref.A, 1e-9);
  cierto(`ITM ${tag}: avisos (0x${c.ref.avisos.toString(16)}) y modo (${c.ref.modo}) iguales`, r.warnings === c.ref.avisos && r.inter.mode === c.ref.modo && r.retorno === c.ref.retorno);
  cerca(`ITM ${tag}: Δh`, r.inter.delta_h__meter, c.ref.delta_h, 1e-9);
}
// Errores de entrada (mismos códigos que la referencia)
const pflPlano = [100, 100, ...Array(101).fill(0)];
const err = (args) => ITM_P2P_TLS(...args).error;
cierto('ITM: frecuencia de 15 MHz → error 1009', err([10, 10, pflPlano, 5, 301, 15, 1, 15, 0.005, 11, 50, 50, 50]) === 1009);
cierto('ITM: antena de 0,3 m → error 1000', err([0.3, 10, pflPlano, 5, 301, 1000, 1, 15, 0.005, 11, 50, 50, 50]) === 1000);
cierto('ITM: N0 = 200 → error 1008', err([10, 10, pflPlano, 5, 200, 1000, 1, 15, 0.005, 11, 50, 50, 50]) === 1008);
// Integración con la app: perfil plano de 10 km a 5 GHz con antenas de 30 m (ejercicio teórico)
const pp = R.puntosTrayecto(A, B, 241).map((p) => ({ ...p, z: 0 }));
const pf = perfilAPfl(pp);
cierto('Perfil → PFL: 240 intervalos', pf[0] === 240 && Math.abs(pf[1] * 240 - 10000) < 1e-6);
const rItm = calcularITM({ dKm: 10, fMHz, perfil: pp, hA: 30, hB: 30, itm: ITM_DEFECTO });
cierto('ITM en la app: incluye el relieve y modo línea de visión', rItm.incluyeTerreno && rItm.detalle.inter.mode === 1);
cerca('ITM en la app: L_bf del ITM (32,45 + 20 log f + 20 log d)', rItm.detalle.inter.A_fs__db, 32.45 + 20 * Math.log10(5000) + 20 * Math.log10(10), 1e-9);
cierto('ITM sin perfil → respaldo en espacio libre', calcularITM({ dKm: 10, fMHz, perfil: null, hA: 30, hB: 30 }).incluyeTerreno === false);
const conHueco = pp.map((p, i) => (i === 100 ? { ...p, z: null } : p));
cierto('ITM con cotas que faltan → respaldo con aviso', /faltan 1/.test(calcularITM({ dKm: 10, fMHz, perfil: conHueco, hA: 30, hB: 30 }).aviso));
cierto('ITM a 40 GHz → respaldo con aviso de rango', /20 GHz/.test(calcularITM({ dKm: 10, fMHz: 40000, perfil: pp, hA: 30, hB: 30 }).aviso));
const r90 = calcularITM({ dKm: 10, fMHz, perfil: pp, hA: 30, hB: 30, itm: { tiempo: 90 } });
cierto('ITM: al 90 % del tiempo la pérdida es mayor que al 50 %', r90.perdida > rItm.perdida);
cierto('Parámetros ITM inválidos → valores por defecto', JSON.stringify(parametrosITM({ clima: 9, n0: 'x', suelo: '?', pol: 'Z', tiempo: 42 })) === JSON.stringify(ITM_DEFECTO));

console.log(fallos ? `\n${fallos} prueba(s) fallida(s)` : '\nTodas las pruebas superadas');
process.exit(fallos ? 1 : 0);
