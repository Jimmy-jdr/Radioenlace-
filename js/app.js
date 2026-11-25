/* Radioenlace PxP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// app.js — Interfaz: une el mapa, los datos, el perfil y los cálculos
// =====================================================================
import * as R from './radio.js';
import { obtenerPerfil, FUENTES } from './terreno.js';
import { MODELOS, obtenerModelo } from './modelos.js';
import { Mapa } from './mapa.js';
import { GraficoPerfil } from './perfil.js';
import { construirPasos } from './explicacion.js';
import { EJEMPLOS } from './ejemplos.js';
import { filasInforme, filasPerfil, aCSV, nombreArchivo, descargar } from './informe.js';
import { FUENTES_BIBLIO } from './fuentes.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const CLAVE = 'radioenlace-pxp-v1';

// Números en formato español (coma decimal, signo menos tipográfico)
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—'
  : x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−'));
const fe = (x, d) => (x == null || !isFinite(x) ? '' : String(+x.toFixed(d)).replace('.', ','));
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------
let estado = null;          // datos que introduce el usuario
let perfil = null;          // resultado de obtenerPerfil()
let analisis = null;
let controlDescarga = null;
let temporizador = 0;
let ultimoCalculo = null;
let ultimoContexto = null;  // lo que se exporta a CSV
let revelado = false;       // modo ejercicio: resultados visibles tras «Comprobar»

function copiaEjemplo(id) {
  const e = EJEMPLOS[id];
  return JSON.parse(JSON.stringify({
    ejemplo: id, terreno: e.terreno, a: e.a, b: e.b, f: e.f, p: e.p, sens: e.sens, k: e.k, modelo: 'espacio-libre', colocar: 'B',
  }));
}

function estadoInicial() {
  try {
    const q = new URLSearchParams(location.search).get('e');
    if (q) return validar(JSON.parse(decodeURIComponent(escape(atob(q.replace(/-/g, '+').replace(/_/g, '/'))))));
  } catch { /* enlace no válido: se ignora */ }
  try {
    const g = localStorage.getItem(CLAVE);
    if (g) return validar(JSON.parse(g));
  } catch { /* sin almacenamiento */ }
  return copiaEjemplo('talavera');
}

function validar(s) {
  const base = copiaEjemplo('talavera');
  if (!s || !s.a || !s.b || !isFinite(s.a.lat) || !isFinite(s.b.lat)) return base;
  return { ...base, ...s, a: { ...base.a, ...s.a }, b: { ...base.b, ...s.b }, f: { ...base.f, ...s.f }, p: { ...base.p, ...s.p } };
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado */ }
}

function enlaceCompartir() {
  const { colocar, ...datos } = estado;
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(datos)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}?e=${b64}`;
}

// Entradas numéricas del estado (para leer/escribir el formulario)
function entradas() {
  const e = estado;
  return {
    fValor: e.f.v, fUnidad: e.f.u, fMHz: R.aMHz(e.f.v, e.f.u),
    pValor: e.p.v, pUnidad: e.p.u, ptxDbm: R.potenciaDbm(e.p.v, e.p.u),
    gtx: e.a.g, grx: e.b.g, ltx: e.a.l, lrx: e.b.l, sens: e.sens,
    hA: e.a.h, hB: e.b.h, k: R.leerK(e.k),
  };
}

// ---------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------
const mapa = new Mapa($('#mapa'), {
  centro: { lat: 40.05, lon: -4.79 },
  zoom: 11,
  alTocar: (geo, idMarcador) => {
    if (idMarcador) { ponerColocar(idMarcador); return; }
    const id = estado.colocar;
    moverSitio(id, geo, true);
    // tras colocar un extremo se propone colocar el otro
    ponerColocar(id === 'A' ? 'B' : 'A');
  },
  alArrastrarMarcador: (id, geo) => moverSitio(id, geo, false),
  alSoltarMarcador: (id, geo) => moverSitio(id, geo, true),
});

const grafico = new GraficoPerfil($('#grafico'), f);

// Selector de modelos (la fase 2 aparece deshabilitada)
$('#modelo').innerHTML = MODELOS.map((m) => `<option value="${m.id}" ${m.disponible ? '' : 'disabled'}>${esc(m.nombre)}</option>`).join('');
$('#ejemplo').innerHTML = '<option value="">Elegir ejemplo…</option>' +
  Object.entries(EJEMPLOS).map(([id, e]) => `<option value="${id}">${esc(e.titulo)}</option>`).join('');

// ---------------------------------------------------------------------
// Formulario ↔ estado
// ---------------------------------------------------------------------
const CAMPOS = [
  // [id del campo, ruta en el estado, decimales al mostrar]
  ['a-nombre', 'a.nombre'], ['b-nombre', 'b.nombre'],
  ['a-lat', 'a.lat', 6], ['a-lon', 'a.lon', 6], ['b-lat', 'b.lat', 6], ['b-lon', 'b.lon', 6],
  ['a-h', 'a.h', 1], ['b-h', 'b.h', 1], ['a-g', 'a.g', 2], ['b-g', 'b.g', 2], ['a-l', 'a.l', 2], ['b-l', 'b.l', 2],
  ['f-valor', 'f.v', 4], ['f-unidad', 'f.u'], ['p-valor', 'p.v', 4], ['p-unidad', 'p.u'],
  ['sens', 'sens', 2], ['k', 'k'], ['terreno', 'terreno'], ['modelo', 'modelo'],
];
const leerRuta = (ruta) => ruta.split('.').reduce((o, k) => o[k], estado);
const ponerRuta = (ruta, v) => { const ks = ruta.split('.'); const u = ks.pop(); ks.reduce((o, k) => o[k], estado)[u] = v; };

function escribirFormulario(excepto) {
  for (const [id, ruta, dec] of CAMPOS) {
    const el = document.getElementById(id);
    if (!el || el === excepto) continue;
    const v = leerRuta(ruta);
    if (el.id === 'k') {
      const opciones = [...el.options].map((o) => o.value);
      el.value = opciones.includes(String(v)) ? String(v) : 'otro';
      $('#k-otro').value = el.value === 'otro' ? String(v).replace('.', ',') : '';
      $('#k-otro-campo').hidden = el.value !== 'otro';
    } else el.value = dec != null ? fe(v, dec) : v;
  }
  sincronizarDeslizadores();
}

function errorCampo(el, msg) {
  el.classList.toggle('invalido', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  const ayuda = el.closest('.campo')?.querySelector('.error');
  if (ayuda) ayuda.textContent = msg || '';
}

const LIMITES = {
  'a.lat': [-85, 85], 'b.lat': [-85, 85], 'a.lon': [-180, 180], 'b.lon': [-180, 180],
  'a.h': [0, 500], 'b.h': [0, 500], 'a.g': [-10, 70], 'b.g': [-10, 70], 'a.l': [0, 100], 'b.l': [0, 100],
  'p.v': [-100, 100000], sens: [-160, 0],
};

function alCambiarCampo(ev) {
  const el = ev.target;
  if (el.id === 'k-otro') {
    const k = R.leerK(el.value);
    errorCampo(el, isFinite(k) && k > 0 ? '' : 'Escribe un número mayor que 0 (p. ej. 1,33)');
    if (isFinite(k) && k > 0) { estado.k = el.value.replace(',', '.'); recalcular(); }
    return;
  }
  const def = CAMPOS.find(([id]) => id === el.id);
  if (!def) return;
  const [, ruta, dec] = def;
  if (dec == null) {
    if (el.id === 'k') {
      $('#k-otro-campo').hidden = el.value !== 'otro';
      if (el.value === 'otro') { $('#k-otro').focus(); return; }
    }
    ponerRuta(ruta, el.value);
    if (el.id === 'terreno') { pedirPerfil(0); return; }
    if (el.id === 'f-unidad' || el.id === 'p-unidad') sincronizarDeslizadores();
    recalcular();
    return;
  }
  const v = R.leerNumero(el.value);
  let msg = '';
  if (!isFinite(v)) msg = 'Escribe un número';
  else if (LIMITES[ruta] && (v < LIMITES[ruta][0] || v > LIMITES[ruta][1])) msg = `Valor fuera de rango (${LIMITES[ruta][0]} a ${LIMITES[ruta][1]})`;
  else if (ruta === 'f.v' && (R.aMHz(v, estado.f.u) < 1 || R.aMHz(v, estado.f.u) > 300000)) msg = 'Frecuencia entre 1 MHz y 300 GHz';
  else if (ruta === 'p.v' && estado.p.u === 'W' && v <= 0) msg = 'La potencia en W debe ser mayor que 0';
  errorCampo(el, msg);
  if (msg) return;
  ponerRuta(ruta, v);
  if (/^[ab]\.(lat|lon)$/.test(ruta)) {
    const id = ruta[0].toUpperCase();
    moverSitio(id, { lat: estado[ruta[0]].lat, lon: estado[ruta[0]].lon }, true, el);
    return;
  }
  sincronizarDeslizadores();
  recalcular();
}

document.addEventListener('input', (ev) => { if (ev.target.closest('#formulario')) alCambiarCampo(ev); });
document.addEventListener('change', (ev) => { if (ev.target.matches('select') && ev.target.closest('#formulario')) alCambiarCampo(ev); });

// Distancia editable: mueve B sobre el mismo rumbo
$('#distancia').addEventListener('change', (ev) => {
  const d = R.leerNumero(ev.target.value);
  if (!(d > 0.01 && d < 2000)) { errorCampo(ev.target, 'Distancia entre 0,01 y 2000 km'); return; }
  errorCampo(ev.target, '');
  const rumbo = R.rumbo(estado.a, estado.b);
  moverSitio('B', R.destino(estado.a, rumbo, d), true);
  mapa.encuadrar([estado.a, estado.b], 40);
});

// ---------------------------------------------------------------------
// Deslizadores rápidos junto al perfil
// ---------------------------------------------------------------------
const F_MIN = Math.log10(30), F_MAX = Math.log10(100000); // 30 MHz – 100 GHz
function sincronizarDeslizadores() {
  $('#r-ha').value = estado.a.h; $('#v-ha').textContent = `${f(estado.a.h, 0)} m`;
  $('#r-hb').value = estado.b.h; $('#v-hb').textContent = `${f(estado.b.h, 0)} m`;
  const fMHz = R.aMHz(estado.f.v, estado.f.u);
  $('#r-f').value = Math.round(((Math.log10(fMHz) - F_MIN) / (F_MAX - F_MIN)) * 1000);
  $('#v-f').textContent = fMHz >= 1000 ? `${f(fMHz / 1000, 2)} GHz` : `${f(fMHz, 0)} MHz`;
}
$('#r-ha').addEventListener('input', (e) => { estado.a.h = +e.target.value; escribirFormulario(); recalcular(); });
$('#r-hb').addEventListener('input', (e) => { estado.b.h = +e.target.value; escribirFormulario(); recalcular(); });
$('#r-f').addEventListener('input', (e) => {
  let fMHz = Math.pow(10, F_MIN + (e.target.value / 1000) * (F_MAX - F_MIN));
  fMHz = fMHz >= 1000 ? Math.round(fMHz / 10) * 10 : Math.round(fMHz);
  estado.f = fMHz >= 1000 ? { v: +(fMHz / 1000).toFixed(2), u: 'GHz' } : { v: fMHz, u: 'MHz' };
  escribirFormulario(); recalcular();
});

// ---------------------------------------------------------------------
// Emplazamientos
// ---------------------------------------------------------------------
function ponerColocar(id) {
  estado.colocar = id;
  $$('.colocar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}
$$('.colocar button').forEach((b) => b.addEventListener('click', () => ponerColocar(b.dataset.id)));

function moverSitio(id, geo, definitivo, origen) {
  const s = estado[id.toLowerCase()];
  s.lat = +geo.lat.toFixed(6); s.lon = +geo.lon.toFixed(6);
  mapa.ponerMarcador(id, s, id);
  mapa.ponerLinea(estado.a, estado.b);
  mapa.ponerPuntoCritico(null);
  escribirFormulario(origen);
  pintarDistancia();
  if (definitivo) pedirPerfil(origen ? 600 : 150);
}

function pintarDistancia() {
  const d = R.distanciaKm(estado.a, estado.b);
  if (document.activeElement !== $('#distancia')) $('#distancia').value = fe(d, 3);
  $('#rumbo').textContent = `${f(R.rumbo(estado.a, estado.b), 1)}°`;
  $('#resumen-distancia').textContent = `${f(d, d < 10 ? 2 : 1)} km`;
  $('#resumen-a').textContent = estado.a.nombre || 'A';
  $('#resumen-b').textContent = estado.b.nombre || 'B';
}

// ---------------------------------------------------------------------
// Relieve
// ---------------------------------------------------------------------
function pedirPerfil(espera = 300) {
  clearTimeout(temporizador);
  temporizador = setTimeout(descargarPerfil, espera);
}

async function descargarPerfil() {
  controlDescarga?.abort();
  const ctl = new AbortController();
  controlDescarga = ctl;
  const a = { ...estado.a }, b = { ...estado.b };
  if (R.distanciaKm(a, b) < 0.05) {
    grafico.mensaje('Los emplazamientos A y B están demasiado cerca. Separa los puntos en el mapa.');
    return;
  }
  const real = estado.terreno !== 'plano';
  $('#app').classList.add('cargando');
  grafico.mensaje(real ? 'Descargando el relieve del IGN…' : 'Preparando el perfil teórico…');
  try {
    const p = await obtenerPerfil(a, b, {
      modo: real ? 'ign' : 'plano',
      señal: ctl.signal,
      alProgreso: (x) => grafico.mensaje(`Descargando el relieve del IGN… ${Math.round(x * 100)} %`),
    });
    if (ctl.signal.aborted) return;
    perfil = p;
    recalcular();
  } catch (e) {
    if (e.name === 'AbortError') return;
    perfil = null;
    grafico.mensaje(`No se pudo obtener el relieve: ${e.message}`);
    pintarFuente(null, [`No se pudo obtener el relieve (${e.message}). Comprueba la conexión a internet o usa «Terreno plano teórico».`]);
  } finally {
    if (controlDescarga === ctl) $('#app').classList.remove('cargando');
  }
}

// ---------------------------------------------------------------------
// Cálculo y pintado
// ---------------------------------------------------------------------
function recalcular() {
  guardar();
  pintarDistancia();
  const e = entradas();
  const dKm = R.distanciaKm(estado.a, estado.b);
  const modelo = obtenerModelo(estado.modelo);
  const resModelo = modelo.calcular({ dKm, fMHz: e.fMHz, perfil: perfil?.puntos });
  const pres = R.presupuesto({ ptxDbm: e.ptxDbm, gtx: e.gtx, grx: e.grx, ltx: e.ltx, lrx: e.lrx, perdidaTrayecto: resModelo.perdida, sensibilidad: e.sens });
  pintarPresupuesto(e, resModelo, pres);

  // El perfil solo vale si corresponde a los emplazamientos actuales
  const vigente = perfil && perfil.puntos.length > 1 &&
    Math.abs(perfil.puntos[0].lat - estado.a.lat) < 1e-6 && Math.abs(perfil.puntos[0].lon - estado.a.lon) < 1e-6 &&
    Math.abs(perfil.puntos[perfil.puntos.length - 1].lat - estado.b.lat) < 1e-6 &&
    Math.abs(perfil.puntos[perfil.puntos.length - 1].lon - estado.b.lon) < 1e-6 &&
    (perfil.fuente.id === 'plano') === (estado.terreno === 'plano');
  const base = { e, a: { ...estado.a }, b: { ...estado.b }, dKm, modelo, resModelo, pres };
  if (!vigente) {
    ultimoContexto = { ...base, an: null, perfil: null, pasos: construirPasos({ ...base, an: null }, f) };
    return; // el perfil llegará al terminar la descarga en curso
  }

  analisis = R.analizarPerfil({ perfil: perfil.puntos, hA: e.hA, hB: e.hB, fMHz: e.fMHz, k: e.k });
  grafico.pintar(analisis, { ocultar: ocultando() });
  pintarFresnel(analisis);
  pintarFuente(perfil, perfil.avisos);
  $('#a-cota').textContent = `${f(analisis.zA, 1)} m`;
  $('#b-cota').textContent = `${f(analisis.zB, 1)} m`;
  mapa.ponerPuntoCritico(analisis.peor && !ocultando() ? { lat: analisis.peor.lat, lon: analisis.peor.lon } : null, analisis.estado);

  const pasos = construirPasos({ e, a: estado.a, b: estado.b, dKm, modelo, resModelo, pres, an: analisis }, f);
  pintarPasos(pasos);
  ultimoCalculo = { perdida: resModelo.perdida, prx: pres.prx, margen: pres.margen, r1Medio: analisis.r1Medio };
  ultimoContexto = { ...base, an: analisis, perfil, pasos };
  pintarComprobacion();
}

function pintarPresupuesto(e, res, pres) {
  const ok = pres.margen >= 0;
  $('#res-perdida').textContent = `${f(res.perdida, 1)} dB`;
  $('#res-pire').textContent = `${f(pres.pire, 1)} dBm`;
  $('#res-prx').textContent = `${f(pres.prx, 1)} dBm`;
  $('#res-margen').textContent = `${f(pres.margen, 1)} dB`;
  $('#res-ptx').textContent = `${f(e.ptxDbm, 2)} dBm`;
  const v = $('#veredicto-presupuesto');
  v.className = `veredicto solo-revelado ${ok ? 'bien' : 'mal'}`;
  v.innerHTML = ok
    ? `<b>Nivel suficiente en espacio libre.</b> La señal recibida supera la sensibilidad en ${f(pres.margen, 1)} dB.`
    : `<b>Nivel insuficiente.</b> Faltan ${f(-pres.margen, 1)} dB para alcanzar la sensibilidad del receptor.`;
  const barra = Math.max(0, Math.min(100, ((pres.prx - e.sens + 20) / 100) * 100));
  $('#barra-margen').style.setProperty('--valor', `${barra}%`);
  $('#barra-margen').className = `barra solo-revelado ${ok ? 'bien' : 'mal'}`;
}

function pintarFresnel(an) {
  const p = an.peor;
  const v = $('#veredicto-fresnel');
  const chip = $('#chip-perfil');
  const textos = {
    despejado: ['bien', 'Despejado', `<b>Trayecto despejado.</b> En el punto más comprometido queda libre el ${f(p ? p.relacion * 100 : 100, 0)}&nbsp;% del radio de la 1.ª zona de Fresnel (se exige ≥ 60&nbsp;%).`],
    fresnel: ['aviso', 'Fresnel invadido', `<b>El relieve invade la 1.ª zona de Fresnel.</b> Hay visión directa, pero solo queda libre el ${f(p ? p.relacion * 100 : 0, 0)}&nbsp;% de r₁ (se exige ≥ 60&nbsp;%). Habrá pérdidas adicionales por difracción: sube las antenas o cambia el emplazamiento.`],
    obstruido: ['mal', 'Sin visión directa', `<b>El relieve corta la línea de visión.</b> El terreno sobresale ${f(p ? -p.despeje : 0, 1)} m por encima del rayo directo. Con este trayecto el presupuesto en espacio libre no es realista.`],
  }[an.estado];
  v.className = `veredicto solo-revelado ${textos[0]}`;
  v.innerHTML = textos[2];
  chip.className = `chip solo-revelado ${textos[0]}`;
  chip.textContent = textos[1];
  $('#res-peor-d').textContent = p ? `${f(p.d / 1000, 2)} km desde A` : '—';
  $('#res-peor-c').textContent = p ? `${f(p.despeje, 1)} m` : '—';
  $('#res-peor-r1').textContent = p ? `${f(p.r1, 2)} m` : '—';
  $('#res-peor-pct').textContent = p ? `${f(p.relacion * 100, 0)} %` : '—';
  $('#res-r1-medio').textContent = `${f(an.r1Medio, 2)} m`;
  $('#res-flecha').textContent = `${f(an.flechaMedio, 2)} m`;
  const inv = an.invasiones;
  $('#aviso-perfil').hidden = !inv.length;
  $('#aviso-perfil').innerHTML = inv.length
    ? `<b>⚠ El relieve invade el 60 % de la 1.ª zona de Fresnel</b> en ${inv.length === 1 ? 'el tramo' : `${inv.length} tramos`}: ` +
      inv.slice(0, 4).map((t) => `${f(t.desde / 1000, 2)}–${f(t.hasta / 1000, 2)} km${t.obstruye ? ' (corta la línea de visión)' : ''}`).join(', ') +
      (inv.length > 4 ? '…' : '') + '. Zonas marcadas en rojo en el perfil.'
    : '';
}

function pintarFuente(p, avisos) {
  const caja = $('#fuente');
  if (!p) { caja.innerHTML = `<p class="aviso-texto">${avisos.map(esc).join('<br>')}</p>`; return; }
  const fu = p.fuente;
  const porFuente = Object.entries(p.porFuente).map(([k, n]) =>
    `${k === 'sin-dato' ? 'sin dato' : (FUENTES[k]?.nombre.split(' (')[0] || k)}: ${n}`).join(' · ');
  caja.innerHTML = `
    <dl class="datos-fuente">
      <div><dt>Fuente</dt><dd>${esc(fu.nombre)}${fu.enlace ? ` · <a href="${fu.enlace}" target="_blank" rel="noopener">más información</a>` : ''}</dd></div>
      <div><dt>Resolución</dt><dd>${esc(fu.resolucion)}</dd></div>
      <div><dt>Muestras</dt><dd>${p.puntos.length} cotas, una cada ${f(p.paso, 1)} m</dd></div>
      <div><dt>Origen de las cotas</dt><dd>${esc(porFuente)}</dd></div>
    </dl>
    ${avisos.length ? `<p class="aviso-texto">⚠ ${avisos.map(esc).join('<br>⚠ ')}</p>` : '<p class="ok-texto">✓ No falta ninguna cota.</p>'}
    ${fu.id !== 'plano' ? '<p class="nota">El MDT representa el suelo desnudo: no incluye edificios ni árboles. Tenlo en cuenta en zonas urbanas o con arbolado.</p>' : ''}`;
}

function pintarPasos(pasos) {
  // Se conservan abiertos los cálculos que el usuario había desplegado
  const abiertos = new Set($$('#pasos details[open]').map((d) => d.dataset.id));
  let grupo = '';
  $('#pasos').innerHTML = pasos.map((p, i) => {
    const cab = p.grupo !== grupo ? `<h3 class="grupo">${p.grupo}</h3>` : '';
    grupo = p.grupo;
    return `${cab}<details class="paso" data-id="${p.id}" ${abiertos.has(p.id) ? 'open' : ''}>
      <summary>
        <span class="num">${i + 1}</span>
        <span class="paso-tit"><b>${p.titulo}</b><span class="corta">${p.corta || p.formula}</span></span>
        <span class="paso-res oculta">${p.resultado}</span>
        <span class="ver" aria-hidden="true"></span>
      </summary>
      <div class="paso-detalle">
        ${p.datos ? `<div class="fila-det"><span class="etq">Datos</span><div>${p.datos}</div></div>` : ''}
        <div class="fila-det formula"><span class="etq">Fórmula</span><div>${p.formula}</div></div>
        <div class="fila-det"><span class="etq">Sustitución</span><div class="oculta izq">${p.sustitucion}</div></div>
        <div class="fila-det resultado"><span class="etq">Resultado</span><div class="oculta izq">${p.resultado}</div></div>
        ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}
      </div>
    </details>`;
  }).join('');
}

function pintarFuentesBiblio() {
  $('#fuentes-biblio').innerHTML = FUENTES_BIBLIO.map((x) => `<li><b>${esc(x.ref)}</b>. ${esc(x.titulo)}.
    <span class="uso">${esc(x.uso)}</span>${x.url ? ` <a href="${x.url}" target="_blank" rel="noopener">${esc(x.url.replace('https://', ''))}</a>` : ''}</li>`).join('');
}
pintarFuentesBiblio();

function pintarComprobacion() {
  const ej = EJEMPLOS[estado.ejemplo];
  const caja = $('#comprobacion');
  $('#enunciado').hidden = !ej;
  if (ej) { $('#enunciado-titulo').textContent = ej.titulo; $('#enunciado-texto').textContent = ej.descripcion; }
  if (!ej?.esperado || !ultimoCalculo) { caja.hidden = true; return; }
  caja.hidden = false;
  caja.innerHTML = '<h3>Comprobación del ejercicio</h3><table><thead><tr><th>Magnitud</th><th>Esperado</th><th>Calculado</th><th></th></tr></thead><tbody>' +
    ej.esperado.map((x) => {
      const v = ultimoCalculo[x.clave];
      const ok = Math.abs(v - x.valor) <= 0.051;
      return `<tr><td>${x.texto}</td><td class="num">≈ ${f(x.valor, x.dec)} ${x.unidad}</td><td class="num">${f(v, x.dec)} ${x.unidad}</td><td>${ok ? '<span class="ok-texto">✓ coincide</span>' : '<span class="aviso-texto">datos modificados</span>'}</td></tr>`;
    }).join('') + '</tbody></table>';
}

// ---------------------------------------------------------------------
// Exportar a CSV
// ---------------------------------------------------------------------
function listoParaExportar(necesitaPerfil) {
  if ($('#app').classList.contains('cargando')) { toast('Espera a que termine de descargarse el relieve del terreno.'); return false; }
  if (!ultimoContexto) { toast('Todavía no hay resultados que exportar.'); return false; }
  if (necesitaPerfil && !ultimoContexto.an) { toast('No hay perfil del terreno disponible para exportar.'); return false; }
  return true;
}
async function exportar(tipo) {
  const c = ultimoContexto;
  const fecha = new Date();
  const filas = tipo === 'perfil'
    ? filasPerfil(c.an, c.perfil)
    : filasInforme({ ...c, ejemplo: EJEMPLOS[estado.ejemplo]?.titulo, fecha });
  const nombre = nombreArchivo(tipo, c.a, c.b, fecha);
  const r = await descargar(aCSV(filas), nombre);
  if (r !== 'cancelado') toast(`${tipo === 'perfil' ? 'Perfil' : 'Informe'} exportado: ${nombre}`);
}
$('#btn-csv-informe').addEventListener('click', () => { if (listoParaExportar(false)) exportar('informe'); });
$('#btn-csv-perfil').addEventListener('click', () => { if (listoParaExportar(true)) exportar('perfil'); });

// ---------------------------------------------------------------------
// Modo ejercicio: se ocultan los resultados hasta pulsar «Comprobar»
// ---------------------------------------------------------------------
function ocultando() { return !!estado?.ejercicio && !revelado; }
function aplicarModoEjercicio() {
  const app = $('#app');
  app.classList.toggle('ejercicio', !!estado.ejercicio);
  app.classList.toggle('revelado', revelado);
  $('#btn-ejercicio').setAttribute('aria-pressed', String(!!estado.ejercicio));
  $('#btn-ejercicio').textContent = estado.ejercicio ? 'Salir del modo ejercicio' : 'Modo ejercicio';
  $('#btn-compartir').textContent = estado.ejercicio ? 'Compartir ejercicio' : 'Compartir';
  $('#barra-ejercicio').hidden = !estado.ejercicio;
  $('#btn-comprobar').textContent = revelado ? 'Ocultar resultados' : 'Comprobar resultados';
  $('#texto-ejercicio').textContent = revelado
    ? 'Resultados visibles: compara con tus cálculos y despliega «Ver cálculo» para ver la sustitución.'
    : 'Modo ejercicio: calcula a mano con los datos y las fórmulas, y después comprueba.';
}
function ponerModoEjercicio(activo) {
  estado.ejercicio = activo;
  revelado = false;
  aplicarModoEjercicio();
  recalcular();
}
$('#btn-ejercicio').addEventListener('click', () => {
  ponerModoEjercicio(!estado.ejercicio);
  toast(estado.ejercicio ? 'Modo ejercicio activado: los resultados están ocultos.' : 'Modo ejercicio desactivado.');
});
$('#btn-salir-ejercicio').addEventListener('click', () => ponerModoEjercicio(false));
$('#btn-comprobar').addEventListener('click', () => {
  revelado = !revelado;
  aplicarModoEjercicio();
  recalcular();
  if (revelado) document.getElementById('s-resultados').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------------------------------------------------------------
// Ejemplos, compartir, instalación
// ---------------------------------------------------------------------
function cargarEjemplo(id) {
  const ejercicio = !!estado.ejercicio;
  estado = copiaEjemplo(id);
  estado.ejercicio = ejercicio;
  revelado = false;
  perfil = null;
  aplicarEstado();
  toast(`Ejemplo cargado: ${EJEMPLOS[id].titulo}`);
}
$('#ejemplo').addEventListener('change', (e) => { if (e.target.value) cargarEjemplo(e.target.value); e.target.value = ''; });

async function compartir() {
  const url = enlaceCompartir();
  try {
    if (navigator.share) { await navigator.share({ title: estado.ejercicio ? 'Ejercicio de radioenlace' : 'Radioenlace punto a punto', url }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(estado.ejercicio ? 'Enlace del ejercicio copiado: se abrirá con los resultados ocultos.' : 'Enlace copiado: pégalo donde quieras o conviértelo en código QR'); }
  catch { $('#enlace-manual').hidden = false; $('#enlace-manual input').value = url; $('#enlace-manual input').select(); }
}
$('#btn-compartir').addEventListener('click', compartir);

let avisoToast = 0;
function toast(texto) {
  const t = $('#toast');
  t.textContent = texto; t.hidden = false;
  clearTimeout(avisoToast);
  avisoToast = setTimeout(() => { t.hidden = true; }, 3500);
}

let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; $('#btn-instalar').hidden = false; });
$('#btn-instalar').addEventListener('click', async () => {
  if (eventoInstalar) { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; $('#btn-instalar').hidden = true; return; }
  $('#ayuda-ios').hidden = false;
});
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (esIOS && !instalada) $('#btn-instalar').hidden = false;
$('#ayuda-ios button').addEventListener('click', () => { $('#ayuda-ios').hidden = true; });

// Navegación por secciones
$$('.nav a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById(a.getAttribute('href').slice(1)).scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
function aplicarEstado() {
  aplicarModoEjercicio();
  escribirFormulario();
  ponerColocar(estado.colocar || 'B');
  mapa.ponerMarcador('A', estado.a, 'A');
  mapa.ponerMarcador('B', estado.b, 'B');
  mapa.ponerLinea(estado.a, estado.b);
  mapa.encuadrar([estado.a, estado.b], 40);
  pintarDistancia();
  pedirPerfil(0);
  recalcular();
}

estado = estadoInicial();
if (location.search) history.replaceState(null, '', location.pathname);
aplicarEstado();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin modo sin conexión */ });
}
window.__app = { get estado() { return estado; }, get analisis() { return analisis; }, get perfil() { return perfil; }, get calculo() { return ultimoCalculo; }, get contexto() { return ultimoContexto; }, mapa };
