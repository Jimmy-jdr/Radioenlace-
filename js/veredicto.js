/* Radioenlace PxP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// veredicto.js — Evaluación global y coherente del enlace.
// El margen en espacio libre solo vale si el trayecto está despejado:
// con Fresnel invadido o sin visión directa se descuenta la pérdida por
// difracción del obstáculo principal (UIT-R P.526) antes de opinar.
// Textos sin HTML: sirven para la pantalla, el CSV y el PDF.
// =====================================================================
const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ',').replace('-', '−'));

/**
 * @param {{margen:number}} pres  presupuesto en espacio libre
 * @param {object|null} an        análisis del perfil (null si aún no hay perfil)
 * @param {object|null} dif       difracción del obstáculo principal
 * @returns {{nivel:'bien'|'aviso'|'mal'|'pendiente', clave:string, titulo:string, texto:string, J:number, margenCorregido:number}}
 */
export function evaluarEnlace(pres, an, dif, f = fmt) {
  const M = pres.margen;
  if (!an) {
    return M >= 0
      ? { nivel: 'pendiente', clave: 'sin-perfil', titulo: 'Nivel suficiente en espacio libre', texto: `Margen de ${f(M, 1)} dB sin tener en cuenta el relieve. Falta el perfil del terreno para comprobar el despeje.`, J: 0, margenCorregido: M }
      : { nivel: 'mal', clave: 'sin-perfil', titulo: 'Nivel insuficiente', texto: `Faltan ${f(-M, 1)} dB para alcanzar la sensibilidad incluso en espacio libre.`, J: 0, margenCorregido: M };
  }
  const J = dif?.J ?? 0;
  const Mc = M - J;
  const r = { J, margenCorregido: Mc, clave: an.estado };
  if (an.estado === 'despejado') {
    return Mc >= 0
      ? { ...r, nivel: 'bien', titulo: 'Enlace viable', texto: `Trayecto despejado (≥ 60 % de r1) y margen de ${f(Mc, 1)} dB sobre la sensibilidad.` }
      : { ...r, nivel: 'mal', titulo: 'Nivel insuficiente', texto: `El trayecto está despejado, pero faltan ${f(-Mc, 1)} dB para alcanzar la sensibilidad.` };
  }
  if (an.estado === 'fresnel') {
    return Mc >= 0
      ? { ...r, nivel: 'aviso', titulo: 'Viable con reservas', texto: `El relieve invade la 1.ª zona de Fresnel: la difracción estimada resta ${f(J, 1)} dB y el margen queda en ${f(Mc, 1)} dB. Conviene subir las antenas.` }
      : { ...r, nivel: 'mal', titulo: 'Enlace no viable', texto: `El relieve invade la 1.ª zona de Fresnel: con la difracción (${f(J, 1)} dB) faltan ${f(-Mc, 1)} dB.` };
  }
  return Mc >= 0
    ? { ...r, nivel: 'aviso', titulo: 'Dudoso: sin visión directa', texto: `El relieve corta la línea de visión. Con la difracción estimada (${f(J, 1)} dB) el margen sería ${f(Mc, 1)} dB, pero un único filo de cuchillo suele ser optimista: no se recomienda.` }
    : { ...r, nivel: 'mal', titulo: 'Enlace no viable', texto: `El relieve corta la línea de visión: con la difracción (${f(J, 1)} dB) faltan ${f(-Mc, 1)} dB.` };
}
