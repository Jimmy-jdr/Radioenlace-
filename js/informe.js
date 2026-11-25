/* Radioenlace PxP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// informe.js — Exportación del radioenlace a CSV
//   · Informe: una fila por dato o cálculo
//     (apartado; magnitud; fórmula; sustitución numérica; valor; unidad)
//   · Perfil: una fila por cada punto del trayecto
// Formato para Excel con configuración regional española:
//   UTF-8 con BOM, separador «;», coma decimal y saltos de línea CRLF.
// Las fórmulas y sustituciones se toman de los mismos pasos que se ven
// en pantalla (explicacion.js), así que siempre coinciden con ellos.
// Cuando se añada otro modelo (Longley–Rice), su paso aparecerá aquí.
// =====================================================================
import { R_TIERRA_KM, rumbo, dbmAW } from './radio.js';
import { FUENTES_BIBLIO } from './fuentes.js';

export const VERSION = '1.0.9';
const SEP = ';';
const FIN = '\r\n';

// Número para la columna «valor»: coma decimal, signo menos ASCII y sin
// separador de miles, para que Excel lo reconozca como número.
export function num(x, dec = 2) {
  if (x == null || Number.isNaN(x)) return '';
  if (!Number.isFinite(x)) return x > 0 ? 'infinito' : '-infinito';
  const r = Number(x.toFixed(dec));
  return (Object.is(r, -0) ? 0 : r).toFixed(dec).replace('.', ',');
}

// Número dentro de un texto (sustituciones): signo menos tipográfico «−»
const numT = (x, dec = 2) => num(x, dec).replace(/^-/, '−');

// Texto de las explicaciones (HTML) → texto plano legible en una celda
export function textoPlano(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<sup>(.*?)<\/sup>/g, '^$1')
    .replace(/log<sub>10<\/sub>/g, 'log10')
    .replace(/<sub>(.*?)<\/sub>/g, '_$1')
    .replace(/<br\s*\/?>/g, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Celda CSV segura: comillas cuando hace falta y protección frente a
// textos que Excel interpretaría como fórmula (=, +, -, @).
export function celda(v, esNumero = false) {
  let t = v == null ? '' : String(v);
  if (!esNumero && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  if (/[;"\r\n]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function aCSV(filas) {
  // La 5.ª columna de cada fila del informe es numérica (columna «valor»)
  return '﻿' + filas.map((f) => f.map((c, i) => celda(c, f.numericas?.includes(i))).join(SEP)).join(FIN) + FIN;
}

function fila(apartado, magnitud, formula, sustitucion, valor, unidad, esNumero = true) {
  const r = [apartado, magnitud, formula, sustitucion, valor, unidad];
  r.numericas = esNumero ? [4] : [];
  return r;
}

// ---------------------------------------------------------------------
// Informe del radioenlace
// ctx = { e, a, b, dKm, modelo, resModelo, pres, an, perfil, pasos, ejemplo, fecha }
// ---------------------------------------------------------------------
export function filasInforme(ctx) {
  const { e, a, b, dKm, modelo, resModelo, pres, an, perfil, pasos = [], ejemplo, fecha = new Date() } = ctx;
  const paso = (id) => pasos.find((p) => p.id === id) || {};
  const F = (id) => textoPlano(paso(id).formula);
  const S = (id) => textoPlano(paso(id).sustitucion);
  const filas = [];
  const cab = ['apartado', 'magnitud', 'fórmula', 'sustitución numérica', 'valor', 'unidad'];
  cab.numericas = [];
  filas.push(cab);

  // 1. Datos del informe
  const T = 'Informe';
  filas.push(fila(T, 'Aplicación', '', '', `Radioenlace PxP ${VERSION}`, '', false));
  filas.push(fila(T, 'Autor de la aplicación', '', '', 'Jaime Díaz Rodríguez (Jimmy-jdr) · CC BY-NC-ND 4.0', '', false));
  filas.push(fila(T, 'Fecha y hora de exportación', '', '', fecha.toLocaleString('es-ES'), '', false));
  if (ejemplo) filas.push(fila(T, 'Ejemplo o ejercicio', '', '', ejemplo, '', false));
  filas.push(fila(T, 'Enlace', '', '', `${a.nombre || 'A'} → ${b.nombre || 'B'}`, '', false));
  filas.push(fila(T, 'Modelo de propagación', '', '', modelo.nombre, '', false));
  if (perfil) {
    filas.push(fila(T, 'Fuente del relieve', '', '', perfil.fuente.nombre, '', false));
    filas.push(fila(T, 'Resolución del relieve', '', '', perfil.fuente.resolucion, '', false));
    filas.push(fila(T, 'Número de cotas del perfil', '', '', String(perfil.puntos.length), '', true));
    filas.push(fila(T, 'Separación entre cotas', '', '', num(perfil.paso, 1), 'm'));
    filas.push(fila(T, 'Cotas sin dato', '', '', String(perfil.faltan || 0), '', true));
    (perfil.avisos || []).forEach((av, i) => filas.push(fila(T, `Aviso ${i + 1}`, '', '', av, '', false)));
  } else {
    filas.push(fila(T, 'Perfil del terreno', '', '', 'No disponible: el informe no incluye el despeje', '', false));
  }

  // 2. Datos de entrada
  const D = 'Datos de entrada';
  filas.push(fila(D, 'Frecuencia (valor introducido)', '', '', num(e.fValor, 4), e.fUnidad));
  filas.push(fila(D, 'Frecuencia', e.fUnidad === 'GHz' ? 'f(MHz) = f(GHz) · 1000' : '', e.fUnidad === 'GHz' ? `f = ${numT(e.fValor, 4)} · 1000` : '', num(e.fMHz, 3), 'MHz'));
  filas.push(fila(D, 'Potencia del transmisor (valor introducido)', '', '', num(e.pValor, 4), e.pUnidad));
  filas.push(fila(D, 'Altura de la antena A sobre el suelo', '', '', num(e.hA, 2), 'm'));
  filas.push(fila(D, 'Altura de la antena B sobre el suelo', '', '', num(e.hB, 2), 'm'));
  filas.push(fila(D, 'Ganancia de la antena A (G_A)', '', '', num(e.gtx, 2), 'dBi'));
  filas.push(fila(D, 'Ganancia de la antena B (G_B)', '', '', num(e.grx, 2), 'dBi'));
  filas.push(fila(D, 'Pérdidas del lado A (L_A)', '', '', num(e.ltx, 2), 'dB'));
  filas.push(fila(D, 'Pérdidas del lado B (L_B)', '', '', num(e.lrx, 2), 'dB'));
  filas.push(fila(D, 'Sensibilidad del receptor (S_rx)', '', '', num(e.sens, 2), 'dBm'));
  filas.push(fila(D, 'Factor de radio terrestre equivalente (k)', '', '', num(e.k, 4), ''));
  filas.push(fila(D, 'Radio terrestre (R)', '', '', num(R_TIERRA_KM, 0), 'km'));
  filas.push(fila(D, 'Criterio de despeje (UIT-R P.526: inicio de la zona de difracción)', 'c ≥ 0,6 · r1', '', num(60, 0), '% de r1'));

  // 3. Emplazamientos
  const E = 'Emplazamientos';
  for (const [id, s, h, z] of [['A', a, e.hA, an?.zA], ['B', b, e.hB, an?.zB]]) {
    filas.push(fila(E, `Nombre de ${id}`, '', '', s.nombre || id, '', false));
    filas.push(fila(E, `Latitud de ${id}`, '', '', num(s.lat, 6), '° (ETRS89/WGS84)'));
    filas.push(fila(E, `Longitud de ${id}`, '', '', num(s.lon, 6), '° (ETRS89/WGS84)'));
    if (an) {
      filas.push(fila(E, `Cota del terreno en ${id} (z_${id})`, '', '', num(z, 2), 'm'));
      filas.push(fila(E, `Cota de la antena ${id} (y_${id})`, `y_${id} = z_${id} + h_${id}`, `y_${id} = ${numT(z, 2)} + ${numT(h, 2)}`, num(z + h, 2), 'm'));
    }
  }
  filas.push(fila(E, 'Rumbo de A hacia B', '', '', num(rumbo(a, b), 2), '° (desde el norte)'));

  // 4. Distancia y potencia
  filas.push(fila('Distancia', 'Distancia entre A y B (d)', F('distancia'), S('distancia'), num(dKm, 4), 'km'));
  if (e.pUnidad === 'W') {
    filas.push(fila('Potencia', 'Conversión de W a dBm (P_tx)', F('potencia'), S('potencia'), num(e.ptxDbm, 2), 'dBm'));
  } else {
    filas.push(fila('Potencia', 'Potencia del transmisor (P_tx)', '', '', num(e.ptxDbm, 2), 'dBm'));
    filas.push(fila('Potencia', 'Equivalente en vatios', F('potencia'), S('potencia'), num(dbmAW(e.ptxDbm), 4), 'W'));
  }
  filas.push(fila('Longitud de onda', 'Longitud de onda (λ)', F('lambda'), S('lambda'), num(299792458 / (e.fMHz * 1e6), 5), 'm'));

  // 5. Presupuesto
  const P = 'Presupuesto en espacio libre';
  filas.push(fila(P, `Pérdidas de propagación · ${modelo.nombre}`, F('perdida'), S('perdida'), num(resModelo.perdida, 2), 'dB'));
  filas.push(fila(P, 'PIRE', F('pire'), S('pire'), num(pres.pire, 2), 'dBm'));
  filas.push(fila(P, 'Potencia recibida (P_rx)', F('prx'), S('prx'), num(pres.prx, 2), 'dBm'));
  filas.push(fila(P, 'Margen respecto a la sensibilidad (M)', F('margen'), S('margen'), num(pres.margen, 2), 'dB'));
  filas.push(fila(P, 'Evaluación del presupuesto', 'M ≥ 0 dB', `M = ${numT(pres.margen, 2)} dB`,
    pres.margen >= 0 ? 'Suficiente: la señal supera la sensibilidad' : 'Insuficiente: no alcanza la sensibilidad', '', false));

  // 6. Despeje de Fresnel
  if (an) {
    const R = 'Despeje de Fresnel';
    filas.push(fila(R, 'Radio de la 1.ª zona de Fresnel en el punto medio (r1)', F('r1medio'), S('r1medio'), num(an.r1Medio, 2), 'm'));
    filas.push(fila(R, 'Flecha de la Tierra en el punto medio (h)', F('flecha'), S('flecha'), num(an.flechaMedio, 2), 'm'));
    const p = an.peor;
    if (p) {
      filas.push(fila(R, 'Distancia del transmisor (A) al punto más comprometido (d1)', '', '', num(p.d / 1000, 3), 'km'));
      filas.push(fila(R, 'Distancia del punto más comprometido al receptor (d2)', 'd2 = d − d1', `d2 = ${numT(an.D / 1000, 3)} − ${numT(p.d / 1000, 3)}`, num((an.D - p.d) / 1000, 3), 'km'));
      filas.push(fila(R, 'Cota del terreno en el punto más comprometido (z)', '', '', num(p.z, 2), 'm'));
      filas.push(fila(R, 'Flecha de la Tierra en ese punto (h)', 'h = d1 · d2 / (2 · k · R)',
        isFinite(e.k) ? `h = ${numT(p.d / 1000, 3)} km · ${numT((an.D - p.d) / 1000, 3)} km / (2 · ${numT(e.k, 3)} · ${numT(R_TIERRA_KM, 0)} km) · 1000 m/km` : 'k = ∞ → h = 0',
        num(p.flecha, 3), 'm'));
      filas.push(fila(R, 'Altura de la línea de visión en ese punto (y_LOS)', 'y_LOS = y_A + (y_B − y_A) · d1 / d',
        `y_LOS = ${numT(an.yA, 2)} + (${numT(an.yB, 2)} − ${numT(an.yA, 2)}) · ${numT(p.d / 1000, 3)} / ${numT(an.D / 1000, 3)}`, num(p.los, 2), 'm'));
      filas.push(fila(R, 'Radio de la 1.ª zona de Fresnel en ese punto (r1)', 'r1 = √(λ · d1 · d2 / d)',
        `r1 = √(${numT(299792458 / (e.fMHz * 1e6), 5)} m · ${numT(p.d, 1)} m · ${numT(an.D - p.d, 1)} m / ${numT(an.D, 1)} m)`, num(p.r1, 2), 'm'));
      filas.push(fila(R, 'Despeje sobre el relieve (c)', 'c = y_LOS − (z + h)', `c = ${numT(p.los, 2)} − (${numT(p.z, 2)} + ${numT(p.flecha, 3)})`, num(p.despeje, 2), 'm'));
      filas.push(fila(R, 'Despeje relativo (c / r1)', 'c / r1 · 100', `${numT(p.despeje, 2)} / ${numT(p.r1, 2)} · 100`, num(p.relacion * 100, 1), '% de r1'));
      const req = 0.6 * p.r1;
      filas.push(fila(R, 'Despeje necesario para el 60 %', '0,6 · r1', `0,6 · ${numT(p.r1, 2)}`, num(req, 2), 'm'));
      const dif = p.despeje - req;
      filas.push(fila(R, dif >= 0 ? 'Sobra respecto al 60 % de despeje' : 'Falta para cumplir el 60 % de despeje',
        'c − 0,6 · r1', `${numT(p.despeje, 2)} − ${numT(req, 2)}`, num(dif, 2), 'm'));
    }
    const ev = { despejado: 'Despejado: se cumple el 60 % de la 1.ª zona de Fresnel', fresnel: 'Fresnel invadido: hay visión directa pero no se cumple el 60 %', obstruido: 'Sin visión directa: el relieve corta la línea de visión' }[an.estado];
    filas.push(fila(R, 'Evaluación del despeje', 'c / r1 ≥ 0,6 en todo el trayecto', p ? `mínimo c / r1 = ${numT(p.relacion, 3)}` : '', ev, '', false));
    filas.push(fila(R, 'Tramos que invaden el 60 %', '', '', String(an.invasiones.length), '', true));
    an.invasiones.forEach((t, i) => filas.push(fila(R, `Tramo invadido ${i + 1}`, '', '',
      `${numT(t.desde / 1000, 3)} a ${numT(t.hasta / 1000, 3)} km desde A${t.obstruye ? ' (corta la línea de visión)' : ''}`, '', false)));
  }
  // 7. Fuentes
  for (const x of FUENTES_BIBLIO) filas.push(fila('Fuentes', `${x.ref}. ${x.titulo}`, x.uso, '', x.url, '', false));
  return filas;
}

// ---------------------------------------------------------------------
// Perfil completo: una fila por punto
// ---------------------------------------------------------------------
const ORIGEN = { mdt25: 'IGN MDT25', mdt200: 'IGN MDT200', copernicus: 'Copernicus GLO-90', plano: 'plano teórico' };

export function filasPerfil(an, perfil) {
  const cab = ['punto', 'distancia desde A (km)', 'latitud (°)', 'longitud (°)', 'cota del terreno (m)', 'origen de la cota',
    'flecha de la Tierra (m)', 'terreno + flecha (m)', 'línea de visión (m)', 'radio r1 (m)', 'límite del 60 % (m)',
    'despeje c (m)', 'despeje c/r1 (%)', 'invade el 60 %'];
  cab.numericas = [];
  const filas = [cab];
  for (const p of an.puntos) {
    const pp = perfil.puntos[p.i];
    const extremo = p.i === 0 || p.i === an.puntos.length - 1;
    const r = [
      String(p.i), num(p.d / 1000, 4), num(pp.lat, 6), num(pp.lon, 6), num(p.z, 2), p.z == null ? 'sin dato' : (ORIGEN[pp.origen] || pp.origen || ''),
      num(p.flecha, 3), num(p.zEf, 2), num(p.los, 2), num(p.r1, 3), num(p.los - 0.6 * p.r1, 2),
      num(p.despeje, 2), p.relacion == null ? '' : num(p.relacion * 100, 1),
      p.relacion == null || extremo ? '' : (p.relacion < 0.6 ? 'Sí' : 'No'),
    ];
    r.numericas = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
    filas.push(r);
  }
  return filas;
}

// ---------------------------------------------------------------------
// Nombre de archivo y descarga
// ---------------------------------------------------------------------
export function nombreArchivo(tipo, a, b, fecha = new Date()) {
  const limpiar = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'X';
  const d = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `radioenlace_${tipo}_${limpiar(a.nombre)}-${limpiar(b.nombre)}_${d}.csv`;
}

export async function descargar(texto, nombre) {
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
  // En la app instalada en iPhone/iPad la descarga directa no siempre está
  // disponible: se usa el menú Compartir (Guardar en Archivos, Mail…).
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (instalada && esIOS && typeof File === 'function' && navigator.canShare) {
    const archivo = new File([blob], nombre, { type: 'text/csv' });
    if (navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: nombre }); return 'compartido'; }
      catch (err) { if (err.name === 'AbortError') return 'cancelado'; }
    }
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'descargado';
}
