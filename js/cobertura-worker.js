/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// cobertura-worker.js — Cálculo del mapa de cobertura en segundo plano
// Recibe los datos y el relieve ya descargado, calcula las filas que le
// tocan con el mismo código que el punto a punto (cobertura.js) y envía
// cada fila al terminarla. Se cancela terminando el worker.
// =====================================================================
import { definirMalla, calcularFila, almacenDeMensaje, transferiblesFila } from './cobertura.js';

self.onmessage = (e) => {
  const { params, alm, filas } = e.data;
  try {
    const malla = definirMalla(params);
    const A = almacenDeMensaje(alm);
    for (const r of filas) {
      const fila = calcularFila(params, malla, A, r);
      self.postMessage({ tipo: 'fila', r, fila }, transferiblesFila(fila));
    }
    self.postMessage({ tipo: 'fin' });
  } catch (err) {
    self.postMessage({ tipo: 'error', mensaje: err?.message || String(err) });
  }
};
