/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// app.js — Interfaz: une el mapa, los datos, el perfil y los cálculos
// =====================================================================
import * as R from './radio.js';
import { obtenerPerfil, FUENTES } from './terreno.js';
import { MODELOS, obtenerModelo, parametrosITM, ITM_DEFECTO } from './modelos.js';
import { NOMBRE, VERSION, URL_REGISTRO, REGISTRO } from './version.js';
import { CLIMAS, SUELOS } from './itm.js';
import { Mapa } from './mapa.js';
import { GraficoPerfil } from './perfil.js';
import { construirPasos } from './explicacion.js';
import { EJEMPLOS } from './ejemplos.js';
import { filasInforme, filasPerfil, aCSV, nombreArchivo, descargar } from './informe.js';
import { generarPDF, generarDXFPerfil, generarDXFPlanta, generarKML, nombrePlano } from './planos.js';
import { evaluarEnlace } from './veredicto.js';
import { FUENTES_BIBLIO } from './fuentes.js';
import { iniciarCobertura } from './cobertura-ui.js';
import { normalizarCobertura, COB_DEFECTO } from './cobertura.js';
import { iniciarEjercicios } from './ejercicios-ui.js';
import { paramAConfig, normalizarGenerado, normalizarEjCob } from './ejercicios.js';
import { codificarDatos, decodificarDatos } from './enlace.js';
import { iniciarLineas } from './lineas-ui.js';
import { normalizarLinea, perdidasLinea } from './lineas.js';
import { iniciarDisponibilidad } from './disponibilidad-ui.js';
import { normalizarDisponibilidad, datosClima, calcularDisponibilidad, atenuacionGases, puntoMedio, pasosDisponibilidad } from './disponibilidad.js';
import { alturasMinimasP530 } from './p530.js';
import { iniciarCapacidad } from './capacidad-ui.js';
import { normalizarCapacidad, calcularCapacidad, pasosCapacidad } from './capacidad.js';
import { atmosferaReferencia } from './p676.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const CLAVE = 'radioenlace-pxp-v1';   // se conserva tras el cambio de nombre para no perder los datos guardados

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
let avisoNinguno = false;   // aviso único al tocar el mapa con «Ninguno»
let cob = null;             // mapas de cobertura (cobertura-ui.js)
let ej = null;              // ejercicios aleatorios, de cobertura y código QR (ejercicios-ui.js, versión 1.4)
let lin = null;             // pérdidas de línea y accesorios (lineas-ui.js, versión 1.5)
let disp = null;            // disponibilidad P.530 y gases P.676 (disponibilidad-ui.js, versión 1.5)
let cap = null;             // capacidad según la modulación, ETSI EN 302 217-2 (capacidad-ui.js, versión 1.5)
let configPendiente = null; // ?g=…: ejercicio aleatorio que espera el identificador del alumno
let avisoInicial = '';

const ALTCRIT_DEFECTO = { criterio: '60', obstaculo: 'aislado', clima: 'templado' };
function copiaEjemplo(id) {
  const e = EJEMPLOS[id];
  return JSON.parse(JSON.stringify({
    ejemplo: id, terreno: e.terreno, a: e.a, b: e.b, f: e.f, p: e.p, sens: e.sens, k: e.k, modelo: 'espacio-libre', colocar: 'ninguno',
    plano: { formato: 'A4', exag: 10 }, itm: { ...ITM_DEFECTO }, cobertura: { ...COB_DEFECTO },
    obstaculo: { d: 5, z: 50 }, altmin: 'b',
    disp: normalizarDisponibilidad(), gases: false, altcrit: { ...ALTCRIT_DEFECTO }, cap: normalizarCapacidad(),
  }));
}

// Enlaces: ?e=… (todas las versiones), ?z=… (comprimido, 1.4) y ?g=… (ejercicio aleatorio, 1.4)
async function estadoInicial() {
  const q = new URLSearchParams(location.search);
  if (q.get('g')) {
    configPendiente = paramAConfig(q.get('g'));
    if (!configPendiente) avisoInicial = 'El enlace del ejercicio no es válido.';
  }
  try {
    const d = await decodificarDatos(q);
    if (d) return validar(d);
  } catch (e) { avisoInicial = e.message?.startsWith('Este navegador') ? e.message : 'El enlace no es válido: se abren los últimos datos guardados.'; }
  try {
    const g = localStorage.getItem(CLAVE);
    if (g) return validar(JSON.parse(g));
  } catch { /* sin almacenamiento */ }
  return copiaEjemplo('talavera');
}

function validar(s) {
  const base = copiaEjemplo('talavera');
  if (!s || !s.a || !s.b || !isFinite(s.a.lat) || !isFinite(s.b.lat)) return base;
  const r = { ...base, ...s, a: { ...base.a, ...s.a }, b: { ...base.b, ...s.b }, f: { ...base.f, ...s.f }, p: { ...base.p, ...s.p }, plano: { ...base.plano, ...s.plano } };
  if (!['A', 'B', 'ninguno'].includes(r.colocar)) r.colocar = 'ninguno';
  if (!['ign', 'plano', 'obstaculo'].includes(r.terreno)) r.terreno = 'ign';
  // Versión 1.5: línea y accesorios de cada lado (sin ella, las pérdidas guardadas siguen como valor manual)
  r.a.linea = normalizarLinea(s.a?.linea);
  r.b.linea = normalizarLinea(s.b?.linea);
  r.obstaculo = { ...base.obstaculo, ...s.obstaculo };
  if (!(Number.isFinite(+r.obstaculo.d) && Number.isFinite(+r.obstaculo.z))) r.obstaculo = { ...base.obstaculo };
  r.obstaculo = { d: +r.obstaculo.d, z: +r.obstaculo.z };
  if (!['a', 'b', 'igual'].includes(r.altmin)) r.altmin = 'b';
  // Versión 1.5: disponibilidad (P.530), gases (P.676) y criterio de despeje de la altura mínima
  r.disp = normalizarDisponibilidad(s.disp);
  r.gases = s.gases === true;
  r.cap = normalizarCapacidad(s.cap);
  const ac = { ...ALTCRIT_DEFECTO, ...(s.altcrit || {}) };
  r.altcrit = {
    criterio: ac.criterio === 'p530' ? 'p530' : '60',
    obstaculo: ac.obstaculo === 'extendido' ? 'extendido' : 'aislado',
    clima: ac.clima === 'tropical' ? 'tropical' : 'templado',
  };
  r.generado = normalizarGenerado(s.generado);
  r.ejcob = normalizarEjCob(s.ejcob);
  if (!r.generado) delete r.generado;
  if (!r.ejcob) delete r.ejcob;
  if (!['A4', 'A3'].includes(r.plano.formato)) r.plano.formato = 'A4';
  if (![1, 5, 10, 20].includes(+r.plano.exag)) r.plano.exag = 10;
  if (!MODELOS.some((m) => m.id === r.modelo && m.disponible)) r.modelo = 'espacio-libre';
  r.itm = parametrosITM(s.itm);
  r.cobertura = normalizarCobertura(s.cobertura);
  return r;
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado */ }
}

const urlApp = () => `${location.origin}${location.pathname}`;
async function enlaceDe(datos) {
  const { clave, valor } = await codificarDatos(datos);
  return `${urlApp()}?${clave}=${valor}`;
}
// Ejercicio aleatorio: solo su configuración (?g=); ejercicio de cobertura: los datos
// sin el identificador ni las respuestas del alumno; si no, todos los datos.
async function enlaceCompartir() {
  if (estado.generado && estado.ejercicio) return ej.urlEjercicio(estado.generado);
  const { colocar, generado, ...datos } = estado;
  if (datos.ejcob) {
    const { id, resp, bOrig, corregido, ...cfg } = datos.ejcob;
    if (bOrig) datos.b = { ...datos.b, ...bOrig };
    datos.ejcob = cfg;
  }
  return enlaceDe(datos);
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
    // Solo se mueve el punto elegido en «Mover»; la selección no cambia sola
    if (estado.colocar !== 'A' && estado.colocar !== 'B') {
      if (cob?.alTocarMapa(geo)) return;   // consulta de un píxel del mapa de cobertura
      if (!avisoNinguno) { avisoNinguno = true; toast('Para mover un punto, elige A o B en «Mover» y toca el mapa.'); }
      return;
    }
    if (idMarcador) return; // tocar un marcador no lo mueve
    moverSitio(estado.colocar, geo, true);
  },
  alArrastrarMarcador: (id, geo) => moverSitio(id, geo, false),
  alSoltarMarcador: (id, geo) => moverSitio(id, geo, true),
});

const grafico = new GraficoPerfil($('#grafico'), f);

// Selector de modelos (la fase 2 aparece deshabilitada)
$('#modelo').innerHTML = MODELOS.map((m) => `<option value="${m.id}" ${m.disponible ? '' : 'disabled'}>${esc(m.nombre)}</option>`).join('');
$('#itm-clima').innerHTML = Object.entries(CLIMAS).map(([v, t]) => `<option value="${v}">${v} · ${esc(t)}</option>`).join('');
$('#itm-suelo').innerHTML = Object.entries(SUELOS).map(([v, s]) => `<option value="${v}">${esc(s.nombre)} · εr ${fe(s.epsilon, 0)}, σ ${fe(s.sigma, 3)} S/m</option>`).join('');
$('#ejemplo').innerHTML = '<option value="">Elegir ejemplo…</option>' +
  Object.entries(EJEMPLOS).map(([id, e]) => `<option value="${id}">${esc(e.titulo)}</option>`).join('') +
  '<option value="__aleatorio">Ejercicio aleatorio para clase…</option>';

// ---------------------------------------------------------------------
// Formulario ↔ estado
// ---------------------------------------------------------------------
const CAMPOS = [
  // [id del campo, ruta en el estado, decimales al mostrar]
  ['a-nombre', 'a.nombre'], ['b-nombre', 'b.nombre'],
  ['a-lat', 'a.lat', 6], ['a-lon', 'a.lon', 6], ['b-lat', 'b.lat', 6], ['b-lon', 'b.lon', 6],
  ['a-h', 'a.h', 1], ['b-h', 'b.h', 1], ['a-g', 'a.g', 2], ['b-g', 'b.g', 2], ['a-l', 'a.l', 2], ['b-l', 'b.l', 2],
  ['f-valor', 'f.v', 4], ['f-unidad', 'f.u'], ['p-valor', 'p.v', 4], ['p-unidad', 'p.u'],
  ['sens', 'sens', 2], ['k', 'k'], ['terreno', 'terreno'], ['obs-d', 'obstaculo.d', 3], ['obs-z', 'obstaculo.z', 1], ['modelo', 'modelo'],
  ['itm-clima', 'itm.clima'], ['itm-n0', 'itm.n0', 0], ['itm-suelo', 'itm.suelo'], ['itm-pol', 'itm.pol'], ['itm-tiempo', 'itm.tiempo'],
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
    } else el.value = dec != null ? fe(v, dec) : String(v);
    // Ejercicios de los niveles 5 y 6: las pérdidas calculadas de la línea no se enseñan hasta revelar
    if ((id === 'a-l' || id === 'b-l') && ocultando() && estado[id[0]].linea?.modo === 'calculada') el.value = '';
  }
  sincronizarDeslizadores();
  mostrarOpcionesModelo();
  mostrarObstaculo();
}
// Distancia y cota del obstáculo: solo con el relieve «plano con un obstáculo»
function mostrarObstaculo() {
  $$('.obst-campo').forEach((el) => { el.hidden = estado.terreno !== 'obstaculo'; });
}
const claveTerreno = () => (estado.terreno === 'obstaculo' ? `obstaculo:${estado.obstaculo.d}:${estado.obstaculo.z}` : estado.terreno === 'plano' ? 'plano' : 'ign');

// Las opciones de Longley–Rice solo se ven con ese modelo elegido
function mostrarOpcionesModelo() {
  $('#itm-opciones').hidden = estado.modelo !== 'longley-rice';
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
  'p.v': [-100, 100000], sens: [-160, 0], 'itm.n0': [250, 400], 'obstaculo.d': [0.001, 2000], 'obstaculo.z': [0, 9000],
};

function alCambiarCampo(ev) {
  const el = ev.target;
  if (el.readOnly) return;   // pérdidas calculadas a partir de la línea (versión 1.5)
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
    if (ruta.startsWith('itm.')) estado.itm = parametrosITM(estado.itm);
    if (el.id === 'modelo') mostrarOpcionesModelo();
    if (el.id === 'terreno') { mostrarObstaculo(); pedirPerfil(0); return; }
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
  if (ruta.startsWith('obstaculo.')) { pedirPerfil(300); return; }
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
  mapa.ponerEditable(id === 'A' || id === 'B' ? id : null);
  guardar();
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
  const real = estado.terreno === 'ign';
  const clave = claveTerreno();
  $('#app').classList.add('cargando');
  grafico.mensaje(real ? 'Descargando el relieve del IGN…' : 'Preparando el perfil teórico…');
  try {
    const p = await obtenerPerfil(a, b, {
      modo: estado.terreno,
      obstaculo: { ...estado.obstaculo },
      señal: ctl.signal,
      alProgreso: (x) => grafico.mensaje(`Descargando el relieve del IGN… ${Math.round(x * 100)} %`),
    });
    if (ctl.signal.aborted) return;
    perfil = p;
    perfil.clave = clave;
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
// Versión 1.5: pérdidas calculadas a partir de la línea y los accesorios de cada lado,
// a la frecuencia actual. Si algún elemento no se puede calcular, se mantiene el último valor.
function aplicarLineas() {
  const fMHz = R.aMHz(estado.f.v, estado.f.u);
  for (const s of ['a', 'b']) {
    const ln = estado[s].linea;
    if (ln?.modo !== 'calculada') continue;
    const r = perdidasLinea(ln, fMHz);
    if (r.valido) estado[s].l = r.total;
  }
}
// Si se pone a mano una pérdida (antena receptora de un mapa), el lado pasa a «A mano»
function perdidaManual(s, l) {
  if (estado[s].l !== l && estado[s].linea?.modo === 'calculada') estado[s].linea.modo = 'manual';
  estado[s].l = l;
}

// ---------------------------------------------------------------------
// Gases (P.676-13) y disponibilidad (P.530-19), versión 1.5
// ---------------------------------------------------------------------
function altitudMediaKm(e, vigente) {
  if (!vigente) return Math.max(0, (e.hA + e.hB) / 2000);
  const p = perfil.puntos, zA = p.find((x) => x.z != null)?.z ?? 0, zB = [...p].reverse().find((x) => x.z != null)?.z ?? 0;
  return Math.max(0, (zA + e.hA + zB + e.hB) / 2000);
}
function gasesActuales(e, dKm, vigente) {
  if (!estado.gases) return null;
  const datos = disp?.datos();
  if (!datos) disp?.necesitaDatos();
  const altKm = altitudMediaKm(e, vigente);
  const clima = datosClima(datos, puntoMedio(estado.a, estado.b), altKm, estado.disp.propios);
  // Fuera de los mapas y sin valores propios: atmósfera de referencia (P.835-7: T(h) y ρ = 7,5·e^(−h/2) g/m³)
  const ref = atmosferaReferencia(altKm);
  const T = clima.T.v ?? ref.T, rho = clima.rho.v ?? 7.5 * Math.exp(-altKm / 2);
  const origen = clima.T.v != null && clima.rho.v != null ? (clima.T.propio || clima.rho.propio ? 'valores propios y mapas de la UIT' : 'mapas de la UIT (P.1510-1 y P.836-6)')
    : datos || !estado.gases ? 'atmósfera de referencia (P.835-7)' : 'atmósfera de referencia (P.835-7) mientras se cargan los mapas';
  return { ...atenuacionGases({ fGHz: e.fMHz / 1000, dKm, altKm, T, rho }), altKm, origen };
}
function alturasSegunCriterio(e, dKm) {
  if (estado.altcrit.criterio !== 'p530') return R.alturasMinimas(analisis);
  return alturasMinimasP530({
    dKm, clima: estado.altcrit.clima, obstaculo: estado.altcrit.obstaculo,
    analizar: (k) => R.analizarPerfil({ perfil: perfil.puntos, hA: e.hA, hB: e.hB, fMHz: e.fMHz, k }),
    minimas: R.alturasMinimas,
  });
}
// Datos de entrada de la P.530 (sin calcular): los usan la disponibilidad y la capacidad
function entradaDisponibilidad(ctx, vigente) {
  const datos = disp.datos();
  if (!datos && Object.keys(estado.disp.propios).length < 5) { disp.necesitaDatos(); return { pendiente: 'Cargando los mapas climáticos de la UIT…' }; }
  const { e, dKm, modelo, resModelo, an, dif, gases } = ctx;
  const Ag = gases?.A || 0;
  // Margen con la pérdida mediana (50 % del tiempo) y la difracción del obstáculo principal
  let L = resModelo.perdida, nota = '';
  if (resModelo.incluyeTerreno && resModelo.parametros.tiempo !== 50) {
    L = modelo.calcular({ dKm, fMHz: e.fMHz, perfil: perfil.puntos, hA: e.hA, hB: e.hB, itm: { ...estado.itm, tiempo: 50 } }).perdida;
    nota = ' (Longley–Rice recalculado al 50 % del tiempo)';
  }
  const p50 = R.presupuesto({ ptxDbm: e.ptxDbm, gtx: e.gtx, grx: e.grx, ltx: e.ltx, lrx: e.lrx, perdidaTrayecto: L + Ag, sensibilidad: e.sens });
  const J = !resModelo.incluyeTerreno && dif ? dif.J : 0;
  const F = p50.margen - J;
  const formulaF = `F = P<sub>tx</sub> + G<sub>A</sub> + G<sub>B</sub> − L<sub>A</sub> − L<sub>B</sub> − ${resModelo.simbolo || 'L<sub>el</sub>'}${Ag ? ' − A<sub>a</sub>' : ''}${J ? ' − J' : ''} − S<sub>rx</sub>`;
  const sustitucionF = `F = ${f(e.ptxDbm, 2)} + ${f(e.gtx, 2)} + ${f(e.grx, 2)} − ${f(e.ltx, 2)} − ${f(e.lrx, 2)} − ${f(L, 2)}${nota}${Ag ? ` − ${f(Ag, 2)}` : ''}${J ? ` − ${f(J, 2)}` : ''} − (${f(e.sens, 2)})`;
  const ptos = perfil.puntos.filter((p) => p.z != null);
  const ht = ptos.reduce((s, p) => s + p.z, 0) / ptos.length;
  const clima = datosClima(datos, puntoMedio(estado.a, estado.b), altitudMediaKm(e, vigente), estado.disp.propios);
  return { dKm, fGHz: e.fMHz / 1000, pol: estado.itm.pol, yA: an.yA, yB: an.yB, ht, F, clima, nieve: estado.disp.nieve, formulaF, sustitucionF };
}
function disponibilidadActual(ctx, vigente) {
  if (!disp?.abierta()) return null;
  const ent = entradaDisponibilidad(ctx, vigente);
  return ent.pendiente ? ent : calcularDisponibilidad(ent);
}
// Capacidad (versión 1.5): tabla de modulaciones con la disponibilidad de cada una
function capacidadActual(ctx, vigente) {
  if (!cap?.abierta()) return null;
  const e = ctx.e, base = { fGHz: e.fMHz / 1000, cap: estado.cap, sens: e.sens };
  if (!vigente || !ctx.an) return calcularCapacidad(base);
  const ent = entradaDisponibilidad(ctx, vigente);
  if (ent.pendiente) return { ...calcularCapacidad(base), pendiente: ent.pendiente };
  return calcularCapacidad({ ...base, F: ent.F, dispCon: (F) => calcularDisponibilidad({ ...ent, F }) });
}

function recalcular() {
  aplicarLineas();
  lin?.alRecalcular();
  guardar();
  pintarDistancia();
  mostrarOpcionesModelo();
  cob?.alRecalcular();
  const e = entradas();
  const dKm = R.distanciaKm(estado.a, estado.b);

  // El perfil solo vale si corresponde a los emplazamientos actuales
  const vigente = perfil && perfil.puntos.length > 1 &&
    Math.abs(perfil.puntos[0].lat - estado.a.lat) < 1e-6 && Math.abs(perfil.puntos[0].lon - estado.a.lon) < 1e-6 &&
    Math.abs(perfil.puntos[perfil.puntos.length - 1].lat - estado.b.lat) < 1e-6 &&
    Math.abs(perfil.puntos[perfil.puntos.length - 1].lon - estado.b.lon) < 1e-6 &&
    perfil.clave === claveTerreno();

  const modelo = obtenerModelo(estado.modelo);
  const resModelo = modelo.calcular({ dKm, fMHz: e.fMHz, perfil: vigente ? perfil.puntos : null, hA: e.hA, hB: e.hB, itm: estado.itm });
  // Versión 1.5: atenuación por gases (P.676) sumada al presupuesto si se pide
  const gases = gasesActuales(e, dKm, vigente);
  const Ag = gases?.A || 0;
  const pres = R.presupuesto({ ptxDbm: e.ptxDbm, gtx: e.gtx, grx: e.grx, ltx: e.ltx, lrx: e.lrx, perdidaTrayecto: resModelo.perdida + Ag, sensibilidad: e.sens });
  const base = { e, a: { ...estado.a }, b: { ...estado.b }, dKm, modelo, resModelo, pres, gases };
  pintarITM(modelo, resModelo);
  if (!vigente) {
    pintarPresupuesto(e, resModelo, pres, null);
    pintarDifraccion(pres, null, null, resModelo);
    pintarResumen(resModelo, pres, null, null);
    pintarAlturas(null);
    disp?.pintar(disp.abierta() ? { pendiente: 'Esperando el perfil del terreno.' } : null);
    const capR = capacidadActual(base, false);
    cap?.pintar(capR);
    ultimoContexto = { ...base, an: null, dif: null, perfil: null, cap: capR, pasos: construirPasos({ ...base, an: null }, f).concat(pasosCapacidad(capR, f)) };
    ej?.alRecalcular();
    return; // el perfil llegará al terminar la descarga en curso
  }

  analisis = R.analizarPerfil({ perfil: perfil.puntos, hA: e.hA, hB: e.hB, fMHz: e.fMHz, k: e.k });
  // Con Longley–Rice el relieve ya está en la pérdida: no se suma la difracción P.526
  const dif = resModelo.incluyeTerreno ? null : R.difraccionObstaculoPrincipal(analisis, e.fMHz);
  const alt = alturasSegunCriterio(e, dKm);
  grafico.pintar(analisis, { ocultar: ocultando(), altura: dibujoAltura(analisis, alt) });
  pintarAlturas(alt);
  pintarPresupuesto(e, resModelo, pres, analisis);
  pintarFresnel(analisis);
  pintarDifraccion(pres, analisis, dif, resModelo);
  pintarResumen(resModelo, pres, analisis, dif);
  pintarFuente(perfil, perfil.avisos);
  $('#a-cota').textContent = `${f(analisis.zA, 1)} m`;
  $('#b-cota').textContent = `${f(analisis.zB, 1)} m`;
  mapa.ponerPuntoCritico(analisis.peor && !ocultando() ? { lat: analisis.peor.lat, lon: analisis.peor.lon } : null, analisis.estado);

  const ctx = { ...base, an: analisis, dif, alt };
  ctx.disp = disponibilidadActual(ctx, vigente);
  disp?.pintar(ctx.disp);
  ctx.cap = capacidadActual(ctx, vigente);
  cap?.pintar(ctx.cap);
  const pasos = construirPasos(ctx, f).concat(pasosDisponibilidad(ctx.disp, f), pasosCapacidad(ctx.cap, f));
  pintarPasos(pasos);
  ultimoCalculo = { perdida: resModelo.perdida, prx: pres.prx, margen: pres.margen, r1Medio: analisis.r1Medio };
  ultimoContexto = { ...ctx, perfil, pasos };
  pintarComprobacion();
  ej?.alRecalcular();
}

// ---------------------------------------------------------------------
// Altura mínima de las antenas para despejar el 60 % de r1 (versión 1.4)
// ---------------------------------------------------------------------
const arriba01 = (h) => (h <= 0 ? 0 : Math.ceil(h * 10 - 1e-9) / 10);   // redondeo hacia arriba al decímetro
function dibujoAltura(an, alt) {
  if (!alt?.b || !$('#altmin').open || ocultando()) { $('#ley-altmin').hidden = true; return null; }
  $('#ley-altmin').hidden = false;
  $('#ley-altmin').lastChild.textContent = estado.altcrit.criterio === 'p530' ? 'Altura mínima (P.530)' : 'Altura mínima (60 %)';
  const v = estado.altmin, x = alt[v];
  if (v === 'a') return { yA: an.zA + Math.max(0, x.h), yB: an.yB, punto: x.punto, q: x.q };
  if (v === 'b') return { yA: an.yA, yB: an.zB + Math.max(0, x.h), punto: x.punto, q: x.q };
  return { yA: an.zA + Math.max(0, x.h), yB: an.zB + Math.max(0, x.h), punto: x.punto, q: x.q };
}
function pintarAlturas(alt) {
  const txt = (h) => (h <= 0 ? 'cualquier altura' : `${f(arriba01(h), 1)} m`);
  const donde = (p) => `${f(p.d / 1000, 2)} km de A (cota ${f(p.z, 0)} m)`;
  $('#altmin-var').value = estado.altmin;
  const ac = estado.altcrit, p530 = ac.criterio === 'p530';
  $('#altmin-criterio').value = ac.criterio;
  $('#altmin-obst').value = ac.obstaculo;
  $('#altmin-clima').value = ac.clima;
  for (const el of document.querySelectorAll('#altmin [data-p530]')) el.hidden = !p530;
  $('#altmin-resumen').textContent = p530 ? 'Altura mínima de las antenas (UIT-R P.530)' : 'Altura mínima de las antenas (60 % de r₁)';
  $('#altmin-explica').innerHTML = p530
    ? `Criterio completo de la UIT-R P.530-19 (§ 2.2.2.1): la mayor de las alturas que dan 1,0·r₁ de despeje con k = 4/3 (paso 1) y ${ac.clima === 'tropical' && alt?.criterio?.paso3.fraccion === 0.6 ? '0,6' : ac.obstaculo === 'extendido' ? '0,3' : '0,0'}·r₁ con el k<sub>e</sub> superado el 99,9 % del peor mes (pasos 2 y 3)${alt?.ke ? `, aquí k<sub>e</sub> = 157/(144 + 2 670/d) = ${f(alt.ke, 3)}` : ''}. Se redondea hacia arriba al decímetro.`
    : 'Altura de mástil con la que la línea de visión deja libre al menos el 60 % del radio de la 1.ª zona de Fresnel en todo el trayecto, con el factor k de «Datos» (criterio de la UIT-R P.530, § 2.2.2). Se redondea hacia arriba al decímetro.';
  if (!alt?.b) {
    $('#altmin-filas').innerHTML = '<tr><td colspan="3">Esperando el perfil del terreno.</td></tr>';
    $('#altmin-nota').textContent = '';
    $('#altmin-aplicar').disabled = true;
    return;
  }
  const filas = [
    [`B (con A a ${f(estado.a.h, 1)} m)`, alt.b], [`A (con B a ${f(estado.b.h, 1)} m)`, alt.a], ['A y B, la misma', alt.igual],
  ];
  $('#altmin-filas').innerHTML = filas.map(([t, x]) => `<tr><td>${esc(t)}</td><td class="num"><b>${txt(x.h)}</b></td><td>${x.h <= 0 ? '— (ya despeja)' : donde(x.punto)}</td></tr>`).join('');
  const notas = [];
  if (alt.sinCota) notas.push(`⚠ ${alt.sinCota} puntos sin cota no se han tenido en cuenta.`);
  if (estado.modelo === 'longley-rice') notas.push('El criterio es geométrico (despeje de Fresnel con el factor k): no depende del modelo de propagación elegido.');
  if (p530) {
    const paso = (x) => (x.h <= 0 ? '' : x.paso === 1 ? 'paso 1' : 'paso 3');
    notas.push(`Paso que limita: B, ${paso(alt.b) || '—'}; A, ${paso(alt.a) || '—'}; misma altura, ${paso(alt.igual) || '—'}.`);
    const fGHz = R.aMHz(estado.f.v, estado.f.u) / 1000;
    if (fGHz > 13) notas.push('Por encima de unos 13 GHz hay que sumar a esta altura la incertidumbre de la cota del obstáculo (P.530, § 2.2.2.1).');
    if (fGHz < 2) notas.push('Por debajo de unos 2 GHz la P.530 admite fracciones menores de r₁ para no exigir mástiles excesivos.');
  }
  const elegida = alt[estado.altmin];
  if (elegida.h > 500) notas.push('La altura elegida supera los 500 m: no se puede aplicar.');
  $('#altmin-nota').textContent = notas.join(' ');
  $('#altmin-aplicar').disabled = elegida.h > 500;
}
$('#altmin').addEventListener('toggle', () => recalcular());
$('#altmin-var').addEventListener('change', (e) => { estado.altmin = e.target.value; recalcular(); });
$('#altmin-criterio').addEventListener('change', (e) => { estado.altcrit.criterio = e.target.value; recalcular(); });
$('#altmin-obst').addEventListener('change', (e) => { estado.altcrit.obstaculo = e.target.value; recalcular(); });
$('#altmin-clima').addEventListener('change', (e) => { estado.altcrit.clima = e.target.value; recalcular(); });
$('#altmin-aplicar').addEventListener('click', () => {
  const alt = ultimoContexto?.alt;
  if (!alt?.b) return;
  const v = estado.altmin, h = arriba01(alt[v].h);
  if (h > 500) return;
  if (v === 'a' || v === 'igual') estado.a.h = h;
  if (v === 'b' || v === 'igual') estado.b.h = h;
  escribirFormulario();
  recalcular();
  const p530 = estado.altcrit.criterio === 'p530';
  if (p530) contar('altura-p530-aplicada', 'Altura mínima con el criterio de la P.530 aplicada');
  else contar('alturas-aplicadas', 'Altura mínima de antena aplicada');
  const cumple = p530 ? 'cumplen el criterio de despeje de la P.530' : 'despejan el 60 % de r₁';
  toast(v === 'igual' ? `Antenas A y B a ${f(h, 1)} m: ${cumple}.` : `Antena ${v.toUpperCase()} a ${f(h, 1)} m: ${p530 ? 'cumple el criterio de despeje de la P.530' : 'despeja el 60 % de r₁'}.`);
});

function pintarPresupuesto(e, res, pres, an) {
  const ok = pres.margen >= 0;
  const libre = !an || an.estado === 'despejado';
  const itm = res.incluyeTerreno;
  $('#tit-presupuesto').textContent = itm ? 'Presupuesto con Longley–Rice' : 'Presupuesto en espacio libre';
  $('#etq-perdida').innerHTML = itm ? 'Pérdidas Longley–Rice (L<sub>b</sub>)' : 'Pérdidas en espacio libre';
  $('#res-perdida').textContent = `${f(res.perdida, 1)} dB`;
  $('#res-pire').textContent = `${f(pres.pire, 1)} dBm`;
  $('#res-prx').textContent = `${f(pres.prx, 1)} dBm`;
  $('#res-margen').textContent = `${f(pres.margen, 1)} dB`;
  $('#res-ptx').textContent = `${f(e.ptxDbm, 2)} dBm`;
  const v = $('#veredicto-presupuesto');
  const clase = !ok ? 'mal' : libre ? 'bien' : 'aviso';   // mismo criterio que la evaluación global
  v.className = `veredicto solo-revelado ${clase}`;
  const t = res.parametros?.tiempo ?? 50;
  v.innerHTML = itm
    ? (ok ? `<b>Nivel suficiente según Longley–Rice.</b> La señal recibida supera la sensibilidad en ${f(pres.margen, 1)} dB durante el ${f(t, Number.isInteger(t) ? 0 : 1)}&nbsp;% del tiempo. El modelo ya incluye el efecto del relieve` +
        (libre ? '.' : `, pero ${an.estado === 'obstruido' ? 'el relieve corta la línea de visión' : 'el relieve invade la 1.ª zona de Fresnel'}: mira la evaluación.`)
      : `<b>Nivel insuficiente según Longley–Rice.</b> Faltan ${f(-pres.margen, 1)} dB para alcanzar la sensibilidad durante el ${f(t, Number.isInteger(t) ? 0 : 1)}&nbsp;% del tiempo.`)
    : !ok
    ? `<b>Nivel insuficiente.</b> Faltan ${f(-pres.margen, 1)} dB para alcanzar la sensibilidad del receptor, incluso en espacio libre.`
    : libre
      ? `<b>Nivel suficiente en espacio libre.</b> La señal recibida supera la sensibilidad en ${f(pres.margen, 1)} dB.`
      : `<b>Suficiente solo en espacio libre.</b> Este margen de ${f(pres.margen, 1)} dB supone el trayecto despejado, pero el relieve ${an.estado === 'obstruido' ? 'corta la línea de visión' : 'invade la 1.ª zona de Fresnel'}. Mira la difracción.`;
  const barra = Math.max(0, Math.min(100, ((pres.prx - e.sens + 20) / 100) * 100));
  $('#barra-margen').style.setProperty('--valor', `${barra}%`);
  $('#barra-margen').className = `barra solo-revelado ${clase}`;
}

function pintarDifraccion(pres, an, dif, res) {
  // Con Longley–Rice aplicado, la tarjeta de filo de cuchillo se sustituye por la del ITM
  $('#tarjeta-dif').hidden = !!res?.incluyeTerreno;
  const hay = an && dif;
  $('#res-dif-h').textContent = hay ? `${f(dif.h, 1)} m` : '—';
  $('#res-dif-nu').textContent = hay ? f(dif.nu, 2) : '—';
  $('#res-dif-j').textContent = hay ? `${f(dif.J, 1)} dB` : '—';
  $('#res-dif-prx').textContent = hay ? `${f(pres.prx - dif.J, 1)} dBm` : '—';
  $('#res-dif-margen').textContent = hay ? `${f(pres.margen - dif.J, 1)} dB` : '—';
  const ev = evaluarEnlace(pres, an, dif, f, res);
  const v = $(res?.incluyeTerreno ? '#veredicto-itm' : '#veredicto-global');
  $(res?.incluyeTerreno ? '#veredicto-global' : '#veredicto-itm').innerHTML = '';
  v.className = `veredicto solo-revelado ${ev.nivel === 'pendiente' ? '' : ev.nivel}`;
  v.innerHTML = `<b>${esc(ev.titulo)}.</b> ${esc(ev.texto)}`;
}

// Tira de resumen de la pestaña «Enlace»: cifras clave y estado con color
function pintarResumen(res, pres, an, dif) {
  const ev = evaluarEnlace(pres, an, dif, f, res);
  const J = ev.J;
  const caja = $('#sum-veredicto');
  caja.className = `veredicto-global solo-revelado ${ev.nivel === 'pendiente' ? '' : ev.nivel}`;
  $('#sum-titulo').textContent = ev.titulo;
  $('#sum-texto').textContent = ev.texto;
  $('#sum-perdidas').textContent = `${f(res.perdida + J, 1)} dB`;
  $('#sum-prx').textContent = `${f(pres.prx - J, 1)} dBm`;
  const m = $('#sum-margen');
  m.textContent = `${f(ev.margenCorregido, 1)} dB`;
  m.className = `oculta ${ev.margenCorregido < 0 ? 'mal' : ''}`;
  const d = $('#sum-despeje');
  d.textContent = an?.peor ? `${f(an.peor.relacion * 100, 0)} % de r₁` : '—';
  d.className = `oculta ${an ? { despejado: '', fresnel: 'aviso', obstruido: 'mal' }[an.estado] : ''}`;
  const fl = R.perdidasEspacioLibre(R.distanciaKm(estado.a, estado.b), entradas().fMHz);
  $('#sum-nota').textContent = res.aviso && estado.modelo === 'longley-rice' && an ? res.aviso
    : !an ? 'Esperando el perfil del terreno.'
    : res.incluyeTerreno ? `Pérdidas calculadas con Longley–Rice (modo ${res.detalle.modoTexto.toLowerCase()}) para el ${f(res.parametros.tiempo, Number.isInteger(res.parametros.tiempo) ? 0 : 1)} % del tiempo: ${comparaEspacioLibre(res.perdida, fl, f)}. Ya incluyen el relieve.`
    : J > 0 ? `Incluye la pérdida por difracción estimada del obstáculo principal (J = ${f(J, 1)} dB, UIT-R P.526). En espacio libre serían ${f(res.perdida, 1)} dB de pérdidas y ${f(pres.margen, 1)} dB de margen.`
      : 'Trayecto despejado: las pérdidas son las de espacio libre.';
}

// Tarjeta de Longley–Rice (pestaña Cálculos): solo con ese modelo elegido
function pintarITM(modelo, res) {
  const caja = $('#tarjeta-itm');
  caja.hidden = modelo.id !== 'longley-rice';
  if (caja.hidden) return;
  const d = res.detalle, v = d?.inter;
  const poner = (id, t) => { $(id).textContent = t; };
  const f1 = (x) => f(Math.abs(x) < 0.05 ? 0 : x, 1);   // sin «−0,0»
  $('#itm-aviso').hidden = !res.aviso;
  $('#itm-aviso').textContent = res.aviso || '';
  poner('#itm-modo', d ? d.modoTexto : '—');
  poner('#itm-afs', d ? `${f1(v.A_fs__db)} dB` : '—');
  poner('#itm-aref', d ? `${f1(v.A_ref__db)} dB` : '—');
  poner('#itm-var', d ? `${f1(v.corregida__db - v.A_ref__db)} dB` : '—');
  poner('#itm-lb', d ? `${f(res.perdida, 1)} dB` : '—');
  poner('#itm-dh', d ? `${f(v.delta_h__meter, 1)} m` : '—');
  poner('#itm-ns', d ? `${f(v.N_s, 1)} · ${f(v.a_e__meter / 6370e3, 2)}` : '—');
  poner('#itm-hzn', d ? `${f(v.d_hzn__meter[0] / 1000, 1)} · ${f(v.d_hzn__meter[1] / 1000, 1)} km` : '—');
  poner('#itm-tiempo-txt', `${f(res.parametros.tiempo, Number.isInteger(res.parametros.tiempo) ? 0 : 1)} %`);
  const av = d?.avisos || [];
  $('#itm-avisos').hidden = !av.length;
  $('#itm-avisos').innerHTML = av.length ? `⚠ ${av.map(esc).join('<br>⚠ ')}` : '';
  if (!d) { $('#veredicto-itm').className = 'veredicto solo-revelado'; $('#veredicto-itm').innerHTML = ''; }
}

// «X dB más/menos que en espacio libre (Y dB)», o «prácticamente iguales» si difieren menos de 0,05 dB
function comparaEspacioLibre(L, fl, fmt) {
  const d = L - fl;
  if (Math.abs(d) < 0.05) return `prácticamente iguales a las de espacio libre (${fmt(fl, 1)} dB)`;
  return `${fmt(Math.abs(d), 1)} dB ${d > 0 ? 'más' : 'menos'} que en espacio libre (${fmt(fl, 1)} dB)`;
}

function pintarFresnel(an) {
  const p = an.peor;
  const v = $('#veredicto-fresnel');
  const chip = $('#chip-perfil');
  const textos = {
    despejado: ['bien', 'Despejado', `<b>Trayecto despejado.</b> En el punto más comprometido queda libre el ${f(p ? p.relacion * 100 : 100, 0)}&nbsp;% del radio de la 1.ª zona de Fresnel (se exige ≥ 60&nbsp;%).`],
    fresnel: ['aviso', 'Fresnel invadido', `<b>El relieve invade la 1.ª zona de Fresnel.</b> Hay visión directa, pero solo queda libre el ${f(p ? p.relacion * 100 : 0, 0)}&nbsp;% de r₁ (se exige ≥ 60&nbsp;%). Hay pérdidas adicionales por difracción: sube las antenas o cambia el emplazamiento.`],
    obstruido: ['mal', 'Sin visión directa', `<b>El relieve corta la línea de visión.</b> El terreno sobresale ${f(p ? -p.despeje : 0, 1)} m por encima del rayo directo. El margen en espacio libre no es válido: se estima la pérdida por difracción.`],
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
  if (estado.generado) { $('#comprobacion').hidden = true; return; }   // lo pinta ejercicios-ui.js
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
  if (ocultando()) { toast('En modo ejercicio, pulsa antes «Comprobar resultados».'); return false; }
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
  if (r !== 'cancelado') {
    toast(`${tipo === 'perfil' ? 'Perfil' : 'Informe'} exportado: ${nombre}`);
    contar(`descarga-csv-${tipo}`, `Descarga: ${tipo === 'perfil' ? 'perfil' : 'informe'} CSV`);
  }
}
$('#btn-csv-informe').addEventListener('click', () => { if (listoParaExportar(false)) exportar('informe'); });
$('#btn-csv-perfil').addEventListener('click', () => { if (listoParaExportar(true)) exportar('perfil'); });

// ---------------------------------------------------------------------
// Exportar planos: PDF (lámina), DXF (CAD) y KML (Google Earth)
// ---------------------------------------------------------------------
const PLANOS = {
  pdf: { evento: 'descarga-pdf', tipo: 'plano', ext: 'pdf', mime: 'application/pdf', texto: 'Plano PDF', crear: (c) => generarPDF(c, { formato: estado.plano.formato, exag: +estado.plano.exag }) },
  'dxf-perfil': { evento: 'descarga-dxf-perfil', tipo: 'perfil', ext: 'dxf', mime: 'application/dxf', texto: 'Perfil DXF', crear: (c) => generarDXFPerfil(c, +estado.plano.exag) },
  'dxf-planta': { evento: 'descarga-dxf-planta', tipo: 'planta_UTM', ext: 'dxf', mime: 'application/dxf', texto: 'Planta DXF', crear: (c) => generarDXFPlanta(c) },
  kml: { evento: 'descarga-kml', tipo: 'enlace', ext: 'kml', mime: 'application/vnd.google-earth.kml+xml', texto: 'KML', crear: (c) => generarKML(c) },
};
async function exportarPlano(id) {
  if (!listoParaExportar(true)) return;
  const def = PLANOS[id];
  try {
    const nombre = nombrePlano(def.tipo, def.ext, ultimoContexto.a, ultimoContexto.b);
    const r = await descargar(def.crear(ultimoContexto), nombre, def.mime);
    if (r !== 'cancelado') { toast(`${def.texto} exportado: ${nombre}`); contar(def.evento, `Descarga: ${def.texto}`); }
  } catch (err) {
    toast(`No se pudo generar el archivo: ${err.message}`);
  }
}
for (const id of Object.keys(PLANOS)) $(`#btn-${id}`).addEventListener('click', () => exportarPlano(id));
$('#pl-formato').addEventListener('change', (e) => { estado.plano.formato = e.target.value; guardar(); });
$('#pl-exag').addEventListener('change', (e) => { estado.plano.exag = +e.target.value; guardar(); });

// ---------------------------------------------------------------------
// Modo ejercicio: se ocultan los resultados hasta pulsar «Comprobar»
// ---------------------------------------------------------------------
function ocultando() { return !!estado?.ejercicio && !revelado; }
function aplicarModoEjercicio() {
  const app = $('#app');
  app.classList.toggle('ejercicio', !!estado.ejercicio);
  app.classList.toggle('revelado', revelado);
  $('#btn-ejercicio').setAttribute('aria-pressed', String(!!estado.ejercicio));
  $('#btn-ejercicio').innerHTML = estado.ejercicio
    ? '<span class="txt-largo">Salir del modo ejercicio</span><span class="txt-corto">Salir</span>'
    : '<span class="txt-largo">Modo ejercicio</span><span class="txt-corto">Ejercicio</span>';
  $('#btn-compartir').textContent = estado.ejercicio ? 'Compartir ejercicio' : 'Compartir enlace';
  // Ejercicios creados sin permitir ver la solución: no se puede revelar
  const sinSolucion = !!estado.ejercicio && ((estado.generado && !estado.generado.s) || (estado.ejcob && !estado.ejcob.s));
  $('#btn-comprobar').hidden = sinSolucion;
  $('#barra-ejercicio').hidden = !estado.ejercicio;
  $('#btn-comprobar').textContent = revelado ? 'Ocultar resultados' : 'Comprobar resultados';
  $('#texto-ejercicio').textContent = revelado
    ? 'Resultados visibles: compara con tus cálculos y despliega «Ver cálculo» para ver la sustitución.'
    : 'Modo ejercicio: calcula a mano con los datos y las fórmulas, y después comprueba.';
  cob?.alCambiarEjercicio();
  ej?.alCambiarEjercicio();
}
function ponerModoEjercicio(activo) {
  if (!activo && (estado.generado || estado.ejcob)) { ej.salir(); return; }
  modoEjercicio(activo);
}
function modoEjercicio(activo) {
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
// Versión 1.5: al revelar un ejercicio de los niveles 5 a 9 se despliega la tarjeta que lo resuelve
function abrirTarjetasNivel() {
  const n = estado.generado?.n;
  if (!revelado || !(n >= 5)) return;
  const abrir = (sel) => { const d = $(sel); if (d && !d.open) d.open = true; };
  if (n <= 6) abrir('#lineas');
  if (n === 7) abrir('#altmin');
  if (n >= 8) abrir('#disp');
  if (n === 9) abrir('#cap');
}
$('#btn-comprobar').addEventListener('click', () => {
  revelado = !revelado;
  aplicarModoEjercicio();
  abrirTarjetasNivel();
  recalcular();
  if (revelado && vistaActual === 'datos') irA('calculos');
});

// ---------------------------------------------------------------------
// Ejemplos, compartir, instalación
// ---------------------------------------------------------------------
function cargarEjemplo(id) {
  if (id === '__aleatorio') { ej.abrirCrear(); return; }
  const { ejercicio, plano, modelo, itm, cobertura } = estado;
  estado = copiaEjemplo(id);
  estado.ejercicio = !!ejercicio;
  estado.plano = plano;
  estado.itm = itm;
  estado.cobertura = cobertura;
  // Los ejercicios con comprobación automática se resuelven en espacio libre
  if (!EJEMPLOS[id].esperado) estado.modelo = modelo;
  revelado = false;
  perfil = null;
  aplicarEstado();
  toast(`Ejemplo cargado: ${EJEMPLOS[id].titulo}`);
}
$('#ejemplo').addEventListener('change', (e) => { if (e.target.value) cargarEjemplo(e.target.value); e.target.value = ''; });

async function compartir() {
  const url = await enlaceCompartir();
  try {
    if (navigator.share) { await navigator.share({ title: estado.ejercicio ? 'Ejercicio de radioenlace' : 'Radioenlace punto a punto', url }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(estado.ejercicio ? 'Enlace del ejercicio copiado: se abrirá con los resultados ocultos.' : 'Enlace copiado: pégalo donde quieras o conviértelo en código QR'); }
  catch { $('#enlace-manual').hidden = false; $('#enlace-manual input').value = url; $('#enlace-manual input').select(); }
}
$('#btn-compartir').addEventListener('click', compartir);
$('#btn-qr').addEventListener('click', async () => ej.abrirQR(await enlaceCompartir(), estado.ejercicio ? 'Este ejercicio' : 'Este enlace'));
$('#btn-ej-aleatorio').addEventListener('click', () => ej.abrirCrear());

let avisoToast = 0;
function toast(texto) {
  const t = $('#toast');
  t.textContent = texto; t.hidden = false;
  clearTimeout(avisoToast);
  avisoToast = setTimeout(() => { t.hidden = true; }, 3500);
}

// ---------------------------------------------------------------------
// Instalación (aviso en la pestaña Enlace, la primera que se ve)
// ---------------------------------------------------------------------
let eventoInstalar = null;
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function pintarInstalacion(yaInstalada) {
  const caja = $('#instalar');
  caja.classList.toggle('instalada', yaInstalada);
  $('#instalar-texto').innerHTML = yaInstalada
    ? '<b>✓ App instalada</b> en este dispositivo: se abre desde su icono y funciona sin conexión.'
    : '<b>Instala la app</b> para abrirla desde un icono a pantalla completa y usarla sin conexión.';
  $('#btn-instalar').hidden = yaInstalada;
}
pintarInstalacion(instalada);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; });
window.addEventListener('appinstalled', () => {
  eventoInstalar = null;
  pintarInstalacion(true);
  contar('instalacion', 'App instalada');
  toast('App instalada. Ya puedes abrirla desde su icono.');
});
$('#btn-instalar').addEventListener('click', async () => {
  if (eventoInstalar) { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; return; }
  if (esIOS) { $('#ayuda-ios').hidden = false; return; }
  toast('Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».');
});
$('#ayuda-ios button').addEventListener('click', () => { $('#ayuda-ios').hidden = true; });

// ---------------------------------------------------------------------
// Estadísticas anónimas con GoatCounter (sin cookies y sin contador visible).
// count.js se carga de forma asíncrona: los eventos esperan a que esté listo.
// GoatCounter no cuenta las visitas desde localhost (pruebas locales).
// ---------------------------------------------------------------------
function contar(evento, titulo) {
  let intentos = 0;
  const enviar = () => {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') {
      try { gc.count({ path: evento, title: titulo, event: true }); } catch { /* sin estadísticas */ }
      return true;
    }
    return false;
  };
  if (enviar()) return;
  const t = setInterval(() => { if (enviar() || ++intentos > 40) clearInterval(t); }, 250);
}
if (instalada) contar('apertura-instalada', 'Apertura de la app instalada');

// ---------------------------------------------------------------------
// Pestañas: Enlace · Datos · Cálculos · Descargas · Acerca de (dirección #enlace…; «Acerca de» desde la 1.4.3)
// ---------------------------------------------------------------------
const VISTAS = ['enlace', 'datos', 'calculos', 'descargas', 'acerca'];
let vistaActual = 'enlace';
function mostrarVista(id) {
  if (!VISTAS.includes(id)) id = 'enlace';
  vistaActual = id;
  for (const v of VISTAS) {
    $(`#v-${v}`).hidden = v !== id;
    const t = $(`#t-${v}`);
    t.setAttribute('aria-selected', String(v === id));
    t.tabIndex = v === id ? 0 : -1;
  }
  // En «Acerca de» ya están la licencia y el registro completos: no se repite la línea del pie
  $('.pie').hidden = id === 'acerca';
  window.scrollTo({ top: 0 });
}
function irA(id) {
  if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  mostrarVista(id);
}
$$('.pestanas a, a.enlace-vista').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  irA(a.getAttribute('href').slice(1));
}));
$('.pestanas').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = (VISTAS.indexOf(vistaActual) + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length;
  irA(VISTAS[i]);
  $(`#t-${VISTAS[i]}`).focus();
});
window.addEventListener('popstate', () => mostrarVista(location.hash.slice(1)));

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
// Pie: nombre, versión y código de registro salen de version.js
$('#pie-nombre').textContent = NOMBRE;
$('#pie-version').textContent = VERSION;
$('#pie-mini-nombre').textContent = NOMBRE;
$('#pie-mini-version').textContent = VERSION;
$('#acerca-correo').addEventListener('click', () => contar('contacto-correo', 'Correo de contacto'));
$('#pie-registro').textContent = REGISTRO;
$('#pie-registro').href = URL_REGISTRO;

function aplicarEstado() {
  cob?.aplicarEstado();
  lin?.pintar();
  aplicarModoEjercicio();
  escribirFormulario();
  ponerColocar(estado.colocar || 'ninguno');
  $('#pl-formato').value = estado.plano.formato;
  $('#pl-exag').value = String(estado.plano.exag);
  mapa.ponerMarcador('A', estado.a, 'A');
  mapa.ponerMarcador('B', estado.b, 'B');
  mapa.ponerLinea(estado.a, estado.b);
  mapa.encuadrar([estado.a, estado.b], 40);
  pintarDistancia();
  pedirPerfil(0);
  recalcular();
  ej?.aplicarEstado();
}

estado = await estadoInicial();

// ---------------------------------------------------------------------
// Mapas de cobertura (versión 1.3)
// ---------------------------------------------------------------------
cob = iniciarCobertura({
  mapa, f, esc,
  estado: () => estado,
  entradas,
  guardar,
  toast,
  contar,
  ocultando,
  // «Poner B aquí»: B en el centro del píxel y, si el mapa usa una antena
  // receptora propia, también su altura, ganancia y pérdidas
  ponerB(geo, rx) {
    const b = estado.b;
    const cambiaAntena = b.h !== rx.h || b.g !== rx.g || b.l !== rx.l;
    if (cambiaAntena) { b.h = rx.h; b.g = rx.g; perdidaManual('b', rx.l); lin?.pintar(); }
    moverSitio('B', geo, true);
    sincronizarDeslizadores();
    toast(`B colocado en el centro del píxel${cambiaAntena ? ' con la antena receptora del mapa' : ''}: el enlace A–B da el mismo resultado que el mapa.`);
  },
  usarITM() {
    estado.modelo = 'longley-rice';
    escribirFormulario();
    recalcular();
    toast('Modelo cambiado a Longley–Rice (también para el enlace A–B).');
  },
  // Versión 1.4: ejercicios con el mapa de cobertura
  mapaVisibleEnEjercicio: () => !!estado.ejercicio && estado.ejcob?.modo === 'lectura',
  marcando: (geo) => !!ej?.alTocarMapa(geo),
  alCambiarResultado: () => ej?.alCambiarCobertura(),
});

// ---------------------------------------------------------------------
// Pérdidas de línea y accesorios de cada lado (versión 1.5)
// ---------------------------------------------------------------------
lin = iniciarLineas({
  f, fe, esc, contar, ocultar: () => ocultando(),
  estado: () => estado,
  fMHz: () => R.aMHz(estado.f.v, estado.f.u),
  leerNumero: R.leerNumero,
  recalcular,
});

// ---------------------------------------------------------------------
// Disponibilidad (UIT-R P.530-19) y atenuación por gases (versión 1.5)
// ---------------------------------------------------------------------
disp = iniciarDisponibilidad({
  f, esc, contar, recalcular, escribirFormulario,
  estado: () => estado,
  leerNumero: R.leerNumero,
});

// ---------------------------------------------------------------------
// Capacidad según la modulación (versión 1.5)
// ---------------------------------------------------------------------
cap = iniciarCapacidad({
  f, esc, contar, recalcular, escribirFormulario, toast,
  estado: () => estado,
  leerNumero: R.leerNumero,
  necesitaDatos: () => disp?.necesitaDatos(),
});

// ---------------------------------------------------------------------
// Ejercicios aleatorios, ejercicios de cobertura y código QR (versión 1.4)
// ---------------------------------------------------------------------
ej = iniciarEjercicios({
  mapa, f, esc, toast, contar, guardar, irA, urlApp, enlaceDe,
  estado: () => estado,
  cob: () => cob,
  revelado: () => revelado,
  revelar(si) { revelado = si; aplicarModoEjercicio(); abrirTarjetasNivel(); recalcular(); },
  modoEjercicio,
  aplicarModoEjercicio,
  ponerColocar,
  cargarEjemplo(id) { estado.ejercicio = false; cargarEjemplo(id); },
  // Carga un estado nuevo (ejercicio) conservando las preferencias de planos, ITM y cobertura
  cargarEstado(parcial) {
    const { plano, itm, cobertura } = estado;
    // Versión 1.5: un ejercicio puede fijar parte de las opciones de Longley–Rice (la polarización)
    const p = parcial.itm ? { ...parcial, itm: { ...itm, ...parcial.itm } } : parcial;
    estado = validar({ ...copiaEjemplo('teorico'), ejemplo: null, plano, itm, cobertura, ...p });
    revelado = false;
    perfil = null;
    aplicarEstado();
  },
  // «Estudiar» un punto del ejercicio de cobertura: B en el punto con la antena del mapa
  ponerB(geo, rx) {
    const b = estado.b;
    b.h = rx.h; b.g = rx.g; perdidaManual('b', rx.l); lin?.pintar();
    moverSitio('B', geo, true);
    sincronizarDeslizadores();
  },
  restaurarB(o) {
    const b = estado.b;
    b.h = o.h; b.g = o.g; perdidaManual('b', o.l); lin?.pintar();
    moverSitio('B', { lat: o.lat, lon: o.lon }, true);
    sincronizarDeslizadores();
  },
});

if (location.search) history.replaceState(null, '', location.pathname + location.hash);
mostrarVista(location.hash.slice(1));
aplicarEstado();
if (avisoInicial) toast(avisoInicial);
if (configPendiente) ej.pedirId({ tipo: 'aleatorio', cfg: configPendiente });

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin modo sin conexión */ });
}
window.__app = { get estado() { return estado; }, get analisis() { return analisis; }, get perfil() { return perfil; }, get calculo() { return ultimoCalculo; }, get contexto() { return ultimoContexto; }, mapa, get cobertura() { return cob; }, get ejercicios() { return ej; }, get revelado() { return revelado; }, enlaceCompartir, recalcular };
