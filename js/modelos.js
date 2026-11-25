// =====================================================================
// modelos.js — Registro de modelos de propagación
//
// Cada modelo es un objeto con la misma "forma":
//   id, nombre, disponible, necesitaPerfil
//   calcular(ctx) -> { perdida (dB), detalle }
//   explicar(ctx, res, fmt) -> paso de la explicación (fórmula,
//                              sustitución y resultado)
// ctx = { dKm, fMHz, perfil, analisis, parametros }
//
// FASE 2: para añadir Longley–Rice (ITM) basta con implementar
// calcular() usando ctx.perfil (cotas cada pocos metros, ya disponibles)
// y marcar disponible: true. La interfaz y el presupuesto de enlace
// usan siempre "perdida", así que no hay que tocar nada más.
// Los mapas de cobertura podrán llamar a calcular() para cada píxel
// usando terreno.obtenerPerfil() entre el transmisor y ese punto.
// =====================================================================
import { perdidasEspacioLibre, K_FSPL } from './radio.js';

export const MODELOS = [
  {
    id: 'espacio-libre',
    nombre: 'Espacio libre (Friis)',
    disponible: true,
    necesitaPerfil: false,
    calcular({ dKm, fMHz }) {
      return { perdida: perdidasEspacioLibre(dKm, fMHz), detalle: null };
    },
    explicar({ dKm, fMHz }, res, f) {
      return {
        titulo: 'Pérdidas en espacio libre (L<sub>el</sub>)',
        formula: 'L<sub>el</sub> = 32,45 + 20·log<sub>10</sub>(d<sub>km</sub>) + 20·log<sub>10</sub>(f<sub>MHz</sub>)',
        sustitucion:
          `L<sub>el</sub> = ${f(K_FSPL, 2)} + 20·log<sub>10</sub>(${f(dKm, 3)}) + 20·log<sub>10</sub>(${f(fMHz, 1)})` +
          ` = ${f(K_FSPL, 2)} + ${f(20 * Math.log10(dKm), 2)} + ${f(20 * Math.log10(fMHz), 2)}`,
        resultado: `${f(res.perdida, 2)} dB`,
        nota: 'Equivale a L = 20·log<sub>10</sub>(4π·d/λ). La constante 32,45 sale de 20·log<sub>10</sub>(4π·10<sup>9</sup>/c) al expresar d en km y f en MHz. Solo considera la dispersión de la energía con la distancia: no tiene en cuenta el relieve.',
      };
    },
  },
  {
    id: 'longley-rice',
    nombre: 'Longley–Rice / ITM (fase 2)',
    disponible: false,
    necesitaPerfil: true,
    calcular() {
      throw new Error('El modelo Longley–Rice se incorporará en la fase 2.');
    },
    explicar() { return null; },
  },
];

export const obtenerModelo = (id) => MODELOS.find((m) => m.id === id && m.disponible) || MODELOS[0];
