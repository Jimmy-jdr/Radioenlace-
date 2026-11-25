// Pruebas automáticas de los cálculos. Ejecutar con:  node pruebas/prueba-calculos.mjs
import * as R from '../js/radio.js';
import { leerArcGrid, muestrearMalla } from '../js/terreno.js';
import { obtenerModelo } from '../js/modelos.js';

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

console.log(fallos ? `\n${fallos} prueba(s) fallida(s)` : '\nTodas las pruebas superadas');
process.exit(fallos ? 1 : 0);
