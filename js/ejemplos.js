/* Radioenlace PxP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// ejemplos.js — Ejemplos precargados
// Para añadir otro ejemplo, copia uno de los bloques y cambia los datos.
// =====================================================================
import { destino } from './radio.js';

const A_TEORICO = { lat: 39.96, lon: -4.832 };
const B_TEORICO = destino(A_TEORICO, 90, 10); // exactamente 10 km al este

export const EJEMPLOS = {
  talavera: {
    titulo: 'Talavera de la Reina → Cerro Cruces',
    descripcion:
      'Enlace real de 5,8 GHz entre el casco urbano de Talavera de la Reina (Toledo) y el Cerro Cruces, en la Sierra de San Vicente (1367 m), donde hay casetas y antenas. Relieve real del MDT25 del IGN. Prueba a mover B o a bajar las antenas para ver cómo cambia el despeje.',
    terreno: 'ign',
    a: { nombre: 'Talavera de la Reina (centro)', lat: 39.96, lon: -4.832, h: 20, g: 30, l: 1 },
    b: { nombre: 'Cerro Cruces (Sierra de San Vicente)', lat: 40.1541, lon: -4.7434, h: 15, g: 30, l: 1 },
    f: { v: 5.8, u: 'GHz' },
    p: { v: 0.5, u: 'W' },
    sens: -80,
    k: '4/3',
  },
  teorico: {
    titulo: 'Ejercicio teórico: 5 GHz y 10 km',
    descripcion:
      'Enunciado: enlace de 5 GHz y 10 km, 20 W de transmisión, dos antenas de 30 dBi, sensibilidad del receptor −90 dBm y 0 dB de pérdidas adicionales. Calcula las pérdidas en espacio libre, la potencia recibida, el margen y el radio de la 1.ª zona de Fresnel en el punto medio. Terreno plano teórico; los extremos se sitúan en el mapa solo como referencia y las alturas de 30 m son un supuesto para dibujar el perfil.',
    terreno: 'plano',
    a: { nombre: 'Extremo A', lat: A_TEORICO.lat, lon: A_TEORICO.lon, h: 30, g: 30, l: 0 },
    b: { nombre: 'Extremo B', lat: B_TEORICO.lat, lon: B_TEORICO.lon, h: 30, g: 30, l: 0 },
    f: { v: 5, u: 'GHz' },
    p: { v: 20, u: 'W' },
    sens: -90,
    k: '4/3',
    // Resultados de referencia para la comprobación automática
    esperado: [
      { clave: 'perdida', texto: 'Pérdidas en espacio libre', valor: 126.4, unidad: 'dB', dec: 1 },
      { clave: 'prx', texto: 'Potencia recibida', valor: -23.4, unidad: 'dBm', dec: 1 },
      { clave: 'margen', texto: 'Margen', valor: 66.6, unidad: 'dB', dec: 1 },
      { clave: 'r1Medio', texto: 'Radio de la 1.ª zona de Fresnel en el punto medio', valor: 12.2, unidad: 'm', dec: 1 },
    ],
  },
};
