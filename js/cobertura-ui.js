/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// cobertura-ui.js — Mapa de cobertura en la interfaz
//   · Panel plegable bajo el mapa (pestaña Enlace): radio, resolución,
//     antena receptora, cálculo con progreso y cancelación.
//   · Descarga del relieve por zonas fijas (terreno.js) y cálculo en uno o
//     varios Web Workers (cobertura-worker.js); si el navegador no admite
//     workers de módulo, se calcula en la página por tandas.
//   · Capa sobre el mapa, leyenda y ficha del píxel con «Poner B aquí».
//   · Zonas de relieve guardadas para usar sin conexión.
//   · Descargas: KMZ (Google Earth), PNG y CSV.
//   · Versión 1.4: ganchos para los ejercicios con el mapa (modo lectura,
//     puntos marcados por el profesor) y borrado del mapa al cerrar un ejercicio.
// =====================================================================
import * as C from './cobertura.js';
import { kmlCobertura, crearZip, filasCSV, aCSV, lineasParametros, textoBandas, nombreCobertura } from './cobertura-exportar.js';
import { contarFaltan, guardarZona, listarZonas, borrarZona, podarRelieveSuelto } from './terreno.js';
import { obtenerModelo } from './modelos.js';
import { destino, rumbo } from './radio.js';
import { proyectar } from './mapa.js';
import { descargar } from './informe.js';
import { NOMBRE, VERSION, AUTOR, LICENCIA, REGISTRO } from './version.js';

const $ = (s, el = document) => el.querySelector(s);
const MODOS = { 1: 'línea de visión', 2: 'difracción', 3: 'dispersión troposférica' };

export function iniciarCobertura(h) {
  // h = { mapa, estado(), entradas(), guardar(), toast(), contar(), ocultando(), ponerB(geo, rx), usarITM(), f, esc,
  //       mapaVisibleEnEjercicio(), marcando(geo), alCambiarResultado() }
  const { mapa, f, esc } = h;
  const mb = (bytes) => `${f(bytes / 1e6, bytes < 1e7 ? 1 : 0)} MB`;
  let resultado = null;     // último mapa calculado
  let trabajo = null;       // cálculo en curso
  let confirmar = null;     // huella pendiente de confirmación de una descarga grande
  let seleccion = null;     // { r, c } del píxel consultado

  // ---------- Elementos añadidos al mapa: leyenda y ficha ----------
  const leyenda = document.createElement('div');
  leyenda.className = 'cob-leyenda';
  leyenda.hidden = true;
  const ficha = document.createElement('div');
  ficha.className = 'cob-ficha';
  ficha.hidden = true;
  ficha.setAttribute('role', 'dialog');
  ficha.setAttribute('aria-label', 'Datos del píxel');
  for (const el of [leyenda, ficha]) { el.addEventListener('pointerdown', (e) => e.stopPropagation()); mapa.el.appendChild(el); }
  leyenda.addEventListener('click', (e) => { if (e.target.closest('button')) leyenda.classList.toggle('plegada'); });
  // La leyenda empieza plegada si el propio mapa es estrecho (móvil, panel lateral…);
  // después se respeta lo que elija el usuario.
  let leyendaIniciada = false;

  // ---------- Formulario del panel ----------
  const est = () => h.estado().cobertura;
  $('#cob-radio').innerHTML = C.RADIOS_KM.map((r) => `<option value="${r}">${r} km</option>`).join('');
  function escribirPanel() {
    const c = est();
    $('#cob-radio').value = String(c.radio);
    $('#cob-res').value = c.res;
    $('#cob-rx').value = c.rx;
    $('#cob-h').value = String(c.h).replace('.', ',');
    $('#cob-g').value = String(c.g).replace('.', ',');
    $('#cob-l').value = String(c.l).replace('.', ',');
    $('#cob-propio').hidden = c.rx !== 'propio';
    $('#cob-visible').checked = c.visible;
    $('#cob-opacidad').value = String(c.opacidad);
    pintarDetalle();
  }
  const leer = (t) => Number(String(t).trim().replace(',', '.').replace('−', '-'));
  function alCambiar(e) {
    const c = est(), el = e.target;
    if (el.id === 'cob-radio') c.radio = +el.value;
    if (el.id === 'cob-res') c.res = el.value;
    if (el.id === 'cob-rx') c.rx = el.value;
    for (const [id, k, lo, hi] of [['cob-h', 'h', 0.5, 500], ['cob-g', 'g', -10, 70], ['cob-l', 'l', 0, 100]]) {
      if (el.id !== id) continue;
      const v = leer(el.value);
      const okv = Number.isFinite(v) && v >= lo && v <= hi;
      el.classList.toggle('invalido', !okv);
      el.closest('.campo').querySelector('.error').textContent = okv ? '' : `Entre ${lo} y ${hi}`.replace('.', ',');
      if (okv) c[k] = v;
    }
    if (el.id === 'cob-visible') c.visible = el.checked;
    if (el.id === 'cob-opacidad') c.opacidad = +el.value;
    $('#cob-propio').hidden = c.rx !== 'propio';
    quitarConfirmacion();
    h.guardar();
    pintarDetalle();
    pintarCapa();
    comprobarVigencia();
  }
  $('#cobertura').addEventListener('input', alCambiar);
  $('#cobertura').addEventListener('change', (e) => { if (e.target.matches('select, input[type="checkbox"]')) alCambiar(e); });

  // Datos que se pasan al cálculo (los mismos que usa el punto a punto)
  function parametros() {
    const s = h.estado(), e = h.entradas(), c = s.cobertura;
    const rx = c.rx === 'b' ? { h: e.hB, g: e.grx, l: e.lrx } : { h: c.h, g: c.g, l: c.l };
    return {
      a: { lat: s.a.lat, lon: s.a.lon }, terreno: s.terreno === 'ign' ? 'ign' : 'plano',
      fMHz: e.fMHz, ptxDbm: e.ptxDbm, gtx: e.gtx, ltx: e.ltx, hA: e.hA, sens: e.sens, k: e.k,
      rx, modelo: s.modelo, itm: { ...s.itm }, radioKm: c.radio, N: C.RESOLUCIONES[c.res],
    };
  }

  function pintarDetalle() {
    const p = parametros();
    const modelo = obtenerModelo(p.modelo);
    const s = (2 * p.radioKm * 1000) / p.N;
    $('#cob-detalle').innerHTML = `Píxeles de <b>${f(s, 0)} m</b> (${p.N} × ${p.N}) · modelo <b>${esc(modelo.corto)}</b>` +
      ` · receptor a ${f(p.rx.h, 1)} m con ${f(p.rx.g, 1)} dBi orientado hacia A y ${f(p.rx.l, 1)} dB de pérdidas · sensibilidad ${f(p.sens, 1)} dBm.`;
    $('#cob-aviso-modelo').hidden = p.modelo === 'longley-rice';
  }
  $('#cob-usar-itm').addEventListener('click', () => { h.usarITM(); pintarDetalle(); comprobarVigencia(); });

  // Si cambian los datos, la confirmación de una descarga grande deja de valer
  function quitarConfirmacion() {
    if (confirmar && confirmar === C.huella(parametros())) return;
    confirmar = null;
    $('#cob-confirmar').hidden = true;
    if (!trabajo) $('#cob-calcular').textContent = 'Calcular cobertura';
  }

  // ---------- Capa del mapa y leyenda ----------
  function circulo(p) { const r = []; for (let g = 0; g < 360; g += 3) r.push(destino(p.a, g, p.radioKm)); return r; }
  function pintarCapa() {
    const c = est();
    const ver = !!resultado && c.visible && (!h.ocultando() || !!h.mapaVisibleEnEjercicio?.());
    mapa.ponerCobertura(resultado ? {
      imagen: resultado.lienzo, norte: resultado.malla.norte, oeste: resultado.malla.oeste, este: resultado.malla.este,
      dlat: resultado.malla.dlat, N: resultado.malla.N, opacidad: c.opacidad / 100, visible: ver, circulo: resultado.circulo,
    } : null);
    leyenda.hidden = !ver;
    if (ver && !leyendaIniciada) { leyendaIniciada = true; if (mapa.el.clientWidth < 560) leyenda.classList.add('plegada'); }
    if (ver) {
      leyenda.innerHTML = `<button type="button" class="cob-leyenda-cab" aria-label="Plegar o desplegar la leyenda">Margen sobre la sensibilidad<span aria-hidden="true"></span></button>
        <ul>${textoBandas(resultado.params.sens).map(([col, t]) => `<li><i style="background:${col ? C.hex(col) : 'rgba(120,120,120,.6)'}"></i>${esc(t)}</li>`).join('')}
        <li><i class="vacio"></i>sin color: sin cálculo</li></ul>
        <p>${esc(resultado.modeloNombre)} · ${resultado.params.radioKm} km · ${f(resultado.malla.s, 0)} m/píxel${resultado.desactualizado ? ' · <b>desactualizado</b>' : ''}</p>`;
    }
    if (!ver) cerrarFicha();
  }

  // ---------- Vigencia: si cambian los datos, el mapa queda desactualizado ----------
  function comprobarVigencia() {
    const chip = $('#cob-chip');
    if (!resultado) { chip.hidden = true; return; }
    resultado.desactualizado = C.huella(parametros()) !== resultado.huella;
    chip.hidden = false;
    chip.className = `chip ${resultado.desactualizado ? 'aviso' : 'bien'}`;
    chip.textContent = resultado.desactualizado ? 'Desactualizado' : 'Calculado';
    $('#cob-desactualizado').hidden = !resultado.desactualizado;
    pintarCapa();
    h.alCambiarResultado?.();
  }

  // ---------- Progreso ----------
  function progreso(fraccion, texto) {
    $('#cob-progreso').hidden = false;
    $('#cob-progreso .barra-prog span').style.width = `${Math.round(fraccion * 1000) / 10}%`;
    $('#cob-progreso-texto').textContent = texto;
  }
  function ponerOcupado(si) {
    $('#cob-calcular').hidden = si;
    $('#cob-cancelar').hidden = !si;
    $('#cobertura').classList.toggle('calculando', si);
    if (!si) $('#cob-progreso').hidden = true;
  }

  // ---------- Cálculo ----------
  async function calcular() {
    if (trabajo) return;
    if (h.estado().terreno === 'obstaculo') {
      h.toast('El mapa de cobertura no está disponible con el relieve «plano con un obstáculo»: elige el relieve real o el plano en «Datos».');
      return;
    }
    const params = parametros();
    const huella = C.huella(params);
    const malla = C.definirMalla(params);
    const movil = matchMedia('(pointer: coarse)').matches;
    if (params.terreno !== 'plano' && confirmar !== huella) {
      const urls = C.urlsTeselasCobertura(malla);
      const faltan = await contarFaltan(urls);
      const bytes = faltan * C.BYTES_TESELA;
      const grande = params.radioKm > 20 || params.N > 200 || bytes > 15e6;
      if (grande) {
        confirmar = huella;
        $('#cob-confirmar').hidden = false;
        $('#cob-confirmar-texto').textContent = `${faltan ? `Hay que descargar ${faltan} de ${urls.length} zonas de relieve (≈ ${mb(bytes)}, estimación).` : `El relieve de las ${urls.length} zonas ya está guardado.`} ` +
          `Se calcularán unos ${f(Math.round(Math.PI * (params.N / 2) ** 2), 0)} perfiles${movil && (params.N > 200 || params.radioKm > 20) ? '; en un móvil puede tardar varios minutos' : ''}.`;
        $('#cob-calcular').textContent = 'Confirmar y calcular';
        return;
      }
    }
    confirmar = null;
    $('#cob-confirmar').hidden = true;
    $('#cob-calcular').textContent = 'Calcular cobertura';
    const ctl = new AbortController();
    const t0 = performance.now();
    trabajo = { ctl, trabajadores: [], cancelado: false };
    ponerOcupado(true);
    cerrarFicha();
    try {
      // 1) Relieve
      progreso(0, params.terreno === 'plano' ? 'Terreno plano teórico: no hace falta descargar relieve.' : 'Preparando el relieve…');
      const nZonas = C.teselasCobertura(malla).length;
      const rel = await C.prepararRelieve(params, malla, {
        señal: ctl.signal,
        alProgreso: (fase, x, s) => progreso(x * (fase === 'ign' ? 0.9 : 1) * 0.25,
          fase === 'ign' ? `Relieve del IGN: ${Math.round(x * 100)} % de ${nZonas} zonas${s?.bytes ? ` · ${mb(s.bytes)} descargados` : ''}` : `Completando con Copernicus: ${Math.round(x * 100)} %`),
      });
      if (trabajo.cancelado) return;
      if (params.terreno !== 'plano' && rel.urls.length) {
        guardarZona({ id: `${params.a.lat},${params.a.lon},${params.radioKm}`, nombre: h.estado().a.nombre || 'A', lat: params.a.lat, lon: params.a.lon,
          radioKm: params.radioKm, fecha: new Date().toISOString(), urls: rel.urls, bytes: rel.bytes });
        navigator.storage?.persist?.().catch(() => {});
        pintarZonas();
      }
      // 2) Cálculo
      const lienzo = document.createElement('canvas');
      lienzo.width = lienzo.height = malla.N;
      const ctx = lienzo.getContext('2d');
      const res = C.nuevoResultado(malla.N);
      const nuevo = {
        params, malla, res, huella, lienzo, circulo: circulo(params), fecha: new Date(), avisos: rel.avisos,
        nombreA: h.estado().a.nombre || 'A', modeloNombre: obtenerModelo(params.modelo).nombre, completo: false,
      };
      resultado = nuevo;
      seleccion = null;
      mapa.ponerSeleccion(null);
      comprobarVigencia();
      const t1 = performance.now();
      const alFila = (r, fila) => {
        C.ponerFila(res, malla.N, r, fila);
        pintarFila(ctx, malla.N, r, fila);
        const x = res.filasHechas / malla.N;
        const seg = (performance.now() - t1) / 1000;
        const resta = x > 0.03 ? seg * (1 / x - 1) : null;
        progreso(0.25 + 0.75 * x, `Calculando perfiles: ${Math.round(x * 100)} %${resta != null ? ` · quedan unos ${resta < 60 ? `${Math.max(1, Math.round(resta))} s` : `${Math.round(resta / 60)} min`}` : ''}`);
        mapa.dibujar();
      };
      const nW = Math.max(1, Math.min(movil ? 1 : Math.min(4, (navigator.hardwareConcurrency || 2) - 1), params.radioKm >= 30 ? 2 : 4));
      const hecho = await calcularConWorkers(params, rel.alm, malla.N, nW, alFila).catch(async (err) => {
        if (trabajo?.cancelado) return false;
        if (res.filasHechas > 0) throw err;
        // Sin Web Workers de módulo: se calcula en la página por tandas
        const r = await C.calcularEnHilo(params, malla, rel.alm, {
          alFila, cancelado: () => trabajo?.cancelado, pausa: () => new Promise((ok) => setTimeout(ok, 0)),
        });
        return !!r;
      });
      if (!hecho || trabajo?.cancelado) return;
      nuevo.completo = true;
      nuevo.desactualizado = C.huella(parametros()) !== huella;
      nuevo.resumen = C.resumen(res);
      nuevo.segundos = (performance.now() - t0) / 1000;
      nuevo.rel = { teselas: rel.teselas, bloques: rel.bloques, bytes: rel.bytes, red: rel.red };
      pintarResultado();
      h.contar('cobertura-calculada', 'Mapa de cobertura calculado');
      h.toast(h.ocultando() ? 'Mapa de cobertura calculado: se mostrará al pulsar «Comprobar resultados».' : `Mapa de cobertura calculado: ${f(nuevo.resumen.conServicio, 0)} de ${f(nuevo.resumen.calculados, 0)} píxeles con servicio.`);
    } catch (err) {
      if (err.name !== 'AbortError') { h.toast(`No se pudo calcular la cobertura: ${err.message}`); $('#cob-resumen').textContent = `Error: ${err.message}`; }
    } finally {
      for (const w of trabajo?.trabajadores || []) w.terminate();
      trabajo = null;
      ponerOcupado(false);
      h.alCambiarResultado?.();
    }
  }

  function calcularConWorkers(params, alm, N, nW, alFila) {
    return new Promise((resolver, rechazar) => {
      let ws;
      try { ws = Array.from({ length: nW }, () => new Worker(new URL('./cobertura-worker.js', import.meta.url), { type: 'module' })); }
      catch (e) { rechazar(e); return; }
      trabajo.trabajadores = ws;
      trabajo.rechazar = rechazar;
      trabajo.resolver = resolver;
      const msg = C.almacenAMensaje(alm);
      let terminados = 0;
      ws.forEach((w, k) => {
        const filas = [];
        for (let r = k; r < N; r += nW) filas.push(r);
        w.onmessage = (e) => {
          const d = e.data;
          if (d.tipo === 'fila') alFila(d.r, d.fila);
          else if (d.tipo === 'fin') { if (++terminados === nW) resolver(true); }
          else if (d.tipo === 'error') rechazar(new Error(d.mensaje));
        };
        w.onerror = (e) => { e.preventDefault?.(); rechazar(new Error(e.message || 'el cálculo en segundo plano no está disponible')); };
        w.postMessage({ params, alm: msg, filas });
      });
    });
  }

  function cancelar() {
    if (!trabajo) return;
    trabajo.cancelado = true;
    trabajo.ctl.abort();
    for (const w of trabajo.trabajadores) w.terminate();
    trabajo.resolver?.(false);
    if (resultado && !resultado.completo) { resultado = null; mapa.ponerCobertura(null); leyenda.hidden = true; $('#cob-chip').hidden = true; }
    h.toast('Cálculo de la cobertura cancelado.');
    h.alCambiarResultado?.();
  }
  $('#cob-calcular').addEventListener('click', calcular);
  $('#cob-cancelar').addEventListener('click', cancelar);

  function pintarFila(ctx, N, r, fila) {
    const img = ctx.createImageData(N, 1);
    for (let c = 0; c < N; c++) {
      if (fila.estado[c] !== C.PIXEL.OK) continue;
      const b = C.bandaDe(fila.margen[c]);
      const col = b < 0 ? C.SIN_SERVICIO.color : C.BANDAS[b].color;
      img.data.set([col[0], col[1], col[2], b < 0 ? C.SIN_SERVICIO.alfa : 255], c * 4);
    }
    ctx.putImageData(img, 0, r);
  }

  function pintarResultado() {
    const r = resultado;
    $('#cob-resultado').hidden = !r;
    if (!r?.resumen) return;
    const s = r.resumen, pct = (x) => f((100 * x) / Math.max(1, s.calculados), 0);
    const sin = s.faltan + s.modelo + s.cerca;
    const nn = (x) => f(x, 0);
    const motivos = [s.faltan && `${nn(s.faltan)} por cotas que faltan`, s.modelo && `${nn(s.modelo)} porque el modelo no se puede aplicar`, s.cerca && `${nn(s.cerca)} a menos de 50 m de A`].filter(Boolean);
    $('#cob-resumen').innerHTML = `<b>${nn(s.calculados)}</b> píxeles calculados en ${f(r.segundos, r.segundos < 10 ? 1 : 0)} s: ` +
      `<span class="oculta">${nn(s.conServicio)} con servicio (${pct(s.conServicio)} %) y ${nn(s.sinServicio)} por debajo de la sensibilidad</span>` +
      `${sin ? ` · ${nn(sin)} sin cálculo (${motivos.join(', ')})` : ''}` +
      `${s.conCopernicus ? ` · ${nn(s.conCopernicus)} con cotas de Copernicus` : ''}` +
      `${r.params.terreno === 'plano' ? ' · terreno plano teórico' : ` · relieve: ${r.rel.teselas} zonas del MDT25${r.rel.bloques ? ` y ${r.rel.bloques} bloques de Copernicus` : ''}${r.rel.red ? ` (${r.rel.red} descargadas ahora)` : ' (ya guardadas)'}`}.`;
    $('#cob-avisos').hidden = !r.avisos.length;
    $('#cob-avisos').innerHTML = r.avisos.map((a) => `⚠ ${esc(a)}`).join('<br>');
    comprobarVigencia();
  }

  // ---------- Ficha del píxel ----------
  function cerrarFicha() { ficha.hidden = true; seleccion = null; mapa.ponerSeleccion(null); }
  function abrirFicha(r, c) {
    const R0 = resultado, m = R0.malla, res = R0.res, i = r * m.N + c;
    seleccion = { r, c };
    const norte = m.norte - r * m.dlat, oeste = m.oeste + c * m.dlon;
    mapa.ponerSeleccion({ norte, sur: norte - m.dlat, oeste, este: oeste + m.dlon });
    const lat = m.latC[r], lon = m.lonC[c], e = res.estado[i];
    const itm = R0.params.modelo === 'longley-rice';
    let cuerpo;
    if (h.ocultando()) cuerpo = '<p>Resultados ocultos hasta pulsar «Comprobar resultados».</p>';
    else if (e === C.PIXEL.OK) {
      const b = C.bandaDe(res.margen[i]);
      cuerpo = `<dl>
        <div><dt>Nivel recibido</dt><dd>${f(res.prx[i], 1)} dBm</dd></div>
        <div><dt>Margen</dt><dd class="${b < 0 ? 'mal' : ''}">${f(res.margen[i], 1)} dB</dd></div>
        <div><dt>Pérdida total</dt><dd>${f(res.perdida[i], 1)} dB</dd></div>
        <div><dt>Cota del terreno</dt><dd>${f(res.cota[i], 1)} m</dd></div>
      </dl>
      <p>${itm ? `Longley–Rice: modo ${MODOS[res.modo[i]] || '—'}${res.avisos[i] ? ' · con avisos del modelo' : ''}` : `Espacio libre ${f(res.perdida[i] - res.J[i], 1)} dB + difracción ${f(res.J[i], 1)} dB`}${res.cop[i] ? ' · con cotas de Copernicus' : ''}.</p>`;
    } else cuerpo = `<p>${esc(C.TEXTO_ESTADO[e])}.</p>`;
    ficha.innerHTML = `<div class="cob-ficha-cab"><b>Píxel ${r + 1} · ${c + 1}</b><button type="button" class="cerrar" aria-label="Cerrar">×</button></div>
      <p class="coord">${f(lat, 6)}°, ${f(lon, 6)}° · ${f(res.dKm[i], 2)} km de A · rumbo ${f(rumbo(R0.params.a, { lat, lon }), 1)}°</p>
      ${cuerpo}
      <button type="button" class="boton secundario poner-b">Poner B aquí</button>
      <p class="nota">B se coloca en el centro del píxel${R0.params.rx.h !== h.entradas().hB || R0.params.rx.g !== h.entradas().grx || R0.params.rx.l !== h.entradas().lrx ? ' y toma la antena receptora del mapa' : ''}: el enlace A–B da el mismo resultado.</p>`;
    ficha.hidden = false;
    ficha.querySelector('.cerrar').addEventListener('click', cerrarFicha);
    ficha.querySelector('.poner-b').addEventListener('click', () => {
      h.ponerB({ lat, lon }, R0.params.rx);
      cerrarFicha();
    });
  }

  // Devuelve true si el toque se ha usado para consultar un píxel
  function alTocarMapa(geo) {
    if (h.marcando?.(geo)) return true;          // el profesor marca los puntos de un ejercicio
    if (!resultado || !est().visible || h.ocultando()) return false;
    const p = C.pixelDe(resultado.malla, geo.lat, geo.lon);
    if (!p || resultado.res.estado[p.r * resultado.malla.N + p.c] === C.PIXEL.FUERA) { cerrarFicha(); return false; }
    abrirFicha(p.r, p.c);
    return true;
  }

  // ---------- Zonas guardadas ----------
  async function pintarZonas() {
    const zonas = listarZonas();
    const caja = $('#cob-zonas');
    let usado = '';
    try { const e = await navigator.storage?.estimate?.(); if (e?.usage != null) usado = `Espacio usado por la app en este dispositivo: ${mb(e.usage)}${e.quota ? ` de ${mb(e.quota)} disponibles` : ''}.`; } catch { /* sin estimación */ }
    caja.innerHTML = (zonas.length
      ? `<ul class="lista-zonas">${zonas.map((z) => `<li><span><b>${esc(z.nombre)}</b> · radio ${z.radioKm} km · ${new Date(z.fecha).toLocaleDateString('es-ES')} · ${mb(z.bytes || 0)}</span>
          <button type="button" class="boton secundario" data-borrar="${esc(z.id)}">Borrar</button></li>`).join('')}</ul>`
      : '<p class="nota">Todavía no hay zonas guardadas. Al calcular un mapa de cobertura, su relieve queda guardado aquí.</p>') +
      `<p class="nota">Con el relieve guardado, el mapa de cobertura y el perfil punto a punto de esa zona funcionan sin conexión. ${usado}</p>`;
  }
  $('#cob-zonas').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-borrar]')?.dataset.borrar;
    if (!id) return;
    await borrarZona(id);
    await podarRelieveSuelto();
    pintarZonas();
    h.toast('Zona borrada del dispositivo.');
  });
  $('#cob-zonas-det').addEventListener('toggle', (e) => { if (e.target.open) pintarZonas(); });

  // ---------- Descargas ----------
  function listoParaExportar() {
    if (h.ocultando()) { h.toast('En modo ejercicio, pulsa antes «Comprobar resultados».'); return false; }
    if (trabajo) { h.toast('Espera a que termine el cálculo de la cobertura.'); return false; }
    if (!resultado?.completo) { h.toast('Calcula antes un mapa de cobertura (pestaña Enlace, debajo del mapa).'); return false; }
    return true;
  }
  const aBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());
  const blobDe = (cv) => new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen'))), 'image/png'));
  const meta = () => ({ ...resultado, params: resultado.params, malla: resultado.malla, res: resultado.res, resumen: resultado.resumen });

  function lienzoLeyenda() {
    const filas = textoBandas(resultado.params.sens);
    const cv = document.createElement('canvas');
    const W = 330, H = 46 + filas.length * 24 + 26;
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#8a9499'; g.strokeRect(0.5, 0.5, W - 1, H - 1);
    g.fillStyle = '#14212a'; g.font = 'bold 15px Helvetica, Arial, sans-serif';
    g.fillText('Margen sobre la sensibilidad', 12, 24);
    g.font = '13px Helvetica, Arial, sans-serif';
    filas.forEach(([col, t], k) => {
      const y = 38 + k * 24;
      g.fillStyle = col ? C.hex(col) : 'rgba(120,120,120,.6)';
      g.fillRect(12, y, 26, 16);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(12.5, y + 0.5, 25, 15);
      g.fillStyle = '#14212a'; g.fillText(t, 46, y + 13);
    });
    g.fillStyle = '#56656e'; g.font = '11px Helvetica, Arial, sans-serif';
    g.fillText(`${NOMBRE} ${VERSION} · © ${AUTOR}`, 12, H - 10);
    return cv;
  }

  async function exportarKMZ() {
    const doc = new TextEncoder().encode(kmlCobertura(meta()));
    const img = await aBytes(await blobDe(resultado.lienzo));
    const ley = await aBytes(await blobDe(lienzoLeyenda()));
    return { datos: crearZip([{ nombre: 'doc.kml', datos: doc }, { nombre: 'cobertura.png', datos: img }, { nombre: 'leyenda.png', datos: ley }]), mime: 'application/vnd.google-earth.kmz', ext: 'kmz' };
  }
  function exportarCSV() { return { datos: aCSV(filasCSV(meta())), mime: 'text/csv;charset=utf-8', ext: 'csv' }; }
  async function exportarPNG() { return { datos: await blobDe(await lienzoPNG()), mime: 'image/png', ext: 'png' }; }

  // PNG: la cobertura sobre el mapa base (si el servidor de teselas lo permite)
  async function lienzoPNG() {
    const R0 = resultado, m = R0.malla, p = R0.params;
    const capa = mapa.capa;
    const ancho0 = proyectar(m.norte, m.este, 0).x - proyectar(m.norte, m.oeste, 0).x;
    const z = Math.max(5, Math.min(capa.max, Math.floor(Math.log2(900 / ancho0))));
    const pNO = proyectar(m.norte, m.oeste, z), pSE = proyectar(m.sur, m.este, z);
    const W = Math.ceil(pSE.x - pNO.x), H = Math.ceil(pSE.y - pNO.y);
    const PANEL = 380, CAB = 56, PIE = 64;
    const cv = document.createElement('canvas');
    cv.width = W + PANEL; cv.height = Math.max(H, 560) + CAB + PIE;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    // Mapa base
    const tiles = [];
    for (let ty = Math.floor(pNO.y / 256); ty <= Math.floor(pSE.y / 256); ty++) {
      for (let tx = Math.floor(pNO.x / 256); tx <= Math.floor(pSE.x / 256); tx++) tiles.push([tx, ty]);
    }
    const cargar = ([tx, ty]) => new Promise((ok, mal) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      const t = setTimeout(() => mal(new Error('tiempo')), 8000);
      im.onload = () => { clearTimeout(t); ok([tx, ty, im]); };
      im.onerror = () => { clearTimeout(t); mal(new Error('sin CORS')); };
      im.src = capa.url(z, tx, ty);
    });
    let fondo = 'ninguno';
    try {
      const ims = await Promise.all(tiles.map(cargar));
      g.save(); g.beginPath(); g.rect(0, CAB, W, H); g.clip();
      for (const [tx, ty, im] of ims) g.drawImage(im, tx * 256 - pNO.x, CAB + ty * 256 - pNO.y, 256, 256);
      g.restore();
      g.getImageData(0, CAB, 1, 1);      // comprueba que se puede exportar (CORS)
      fondo = capa.atrib;
    } catch {
      g.fillStyle = '#f3f4f0'; g.fillRect(0, CAB, W, H);
      g.strokeStyle = '#d9dcd6'; g.lineWidth = 1;
      for (let lat = Math.ceil(m.sur / 0.05) * 0.05; lat < m.norte; lat += 0.05) { const y = CAB + proyectar(lat, m.oeste, z).y - pNO.y; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let lon = Math.ceil(m.oeste / 0.05) * 0.05; lon < m.este; lon += 0.05) { const x = proyectar(m.norte, lon, z).x - pNO.x; g.beginPath(); g.moveTo(x, CAB); g.lineTo(x, CAB + H); g.stroke(); }
    }
    // Cobertura (fila a fila, de latitud a Mercator)
    g.save(); g.globalAlpha = 0.68; g.imageSmoothingEnabled = false;
    for (let r = 0; r < m.N; r++) {
      const y0 = CAB + proyectar(m.norte - r * m.dlat, m.oeste, z).y - pNO.y, y1 = CAB + proyectar(m.norte - (r + 1) * m.dlat, m.oeste, z).y - pNO.y;
      g.drawImage(R0.lienzo, 0, r, m.N, 1, 0, y0, W, Math.max(0.5, y1 - y0));
    }
    g.restore();
    // Radio y A
    g.strokeStyle = 'rgba(20,33,42,.85)'; g.lineWidth = 2; g.setLineDash([8, 5]); g.beginPath();
    R0.circulo.forEach((q, k) => { const s = proyectar(q.lat, q.lon, z); g[k ? 'lineTo' : 'moveTo'](s.x - pNO.x, CAB + s.y - pNO.y); });
    g.closePath(); g.stroke(); g.setLineDash([]);
    const sA = proyectar(p.a.lat, p.a.lon, z);
    g.fillStyle = '#1257d6'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.arc(sA.x - pNO.x, CAB + sA.y - pNO.y, 9, 0, 2 * Math.PI); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 12px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('A', sA.x - pNO.x, CAB + sA.y - pNO.y + 4); g.textAlign = 'left';
    // Barra de escala
    const mPorPx = (2 * Math.PI * 6378137 * Math.cos((p.a.lat * Math.PI) / 180)) / (256 * 2 ** z);
    const largo = [500, 1000, 2000, 5000, 10000, 20000].filter((x) => x / mPorPx <= W * 0.3).pop() || 500;
    const lx = 16, ly = CAB + H - 18, lpx = largo / mPorPx;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(lx - 6, ly - 20, lpx + 12, 30);
    g.fillStyle = '#14212a'; g.fillRect(lx, ly, lpx, 4);
    g.font = '12px Helvetica, Arial, sans-serif'; g.fillText(largo >= 1000 ? `${largo / 1000} km` : `${largo} m`, lx, ly - 6);
    // Título
    g.fillStyle = '#10222c'; g.fillRect(0, 0, cv.width, CAB);
    g.fillStyle = '#fff'; g.font = 'bold 20px Helvetica, Arial, sans-serif';
    g.fillText(`Cobertura desde ${R0.nombreA} · radio ${p.radioKm} km`, 16, 35);
    // Panel lateral: leyenda y datos
    const x0 = W + 18;
    g.drawImage(lienzoLeyenda(), x0, CAB + 14);
    let y = CAB + 14 + lienzoLeyenda().height + 26;
    g.fillStyle = '#14212a';
    const envolver = (texto, fuente, alto) => {
      g.font = fuente;
      const palabras = String(texto).split(' ');
      let linea = '';
      for (const w of palabras) {
        if (g.measureText(`${linea} ${w}`).width > PANEL - 36 && linea) { g.fillText(linea, x0, y); y += alto; linea = w; }
        else linea = linea ? `${linea} ${w}` : w;
      }
      if (linea) { g.fillText(linea, x0, y); y += alto; }
    };
    for (const [k, v] of lineasParametros(meta())) { envolver(k, 'bold 12px Helvetica, Arial, sans-serif', 15); envolver(v, '12px Helvetica, Arial, sans-serif', 15); y += 4; }
    // Pie
    g.fillStyle = '#56656e'; g.font = '12px Helvetica, Arial, sans-serif';
    const pieY = cv.height - PIE + 20;
    g.fillText(`${NOMBRE} ${VERSION} · © 2026 ${AUTOR} · ${LICENCIA} · Safe Creative ${REGISTRO} · ${R0.fecha.toLocaleString('es-ES')}`, 16, pieY);
    g.fillText(`Relieve: MDT25 © IGN/CNIG${R0.resumen?.conCopernicus ? ' y Copernicus GLO-90 (Open-Meteo)' : ''} · Mapa base: ${fondo === 'ninguno' ? 'no disponible para exportar (cuadrícula cada 0,05°)' : fondo}`, 16, pieY + 18);
    g.fillText('Cada píxel es el resultado punto a punto con el receptor en su centro (perfil propio desde A).', 16, pieY + 36);
    return cv;
  }

  const EXPORTAR = {
    kmz: { crear: exportarKMZ, texto: 'KMZ (Google Earth)', evento: 'descarga-cobertura-kmz' },
    png: { crear: exportarPNG, texto: 'Imagen PNG', evento: 'descarga-cobertura-png' },
    csv: { crear: exportarCSV, texto: 'CSV', evento: 'descarga-cobertura-csv' },
  };
  for (const [id, def] of Object.entries(EXPORTAR)) {
    $(`#btn-cob-${id}`).addEventListener('click', async () => {
      if (!listoParaExportar()) return;
      try {
        const x = await def.crear();
        const nombre = nombreCobertura(x.ext, resultado.nombreA, resultado.params.radioKm, resultado.fecha);
        const r = await descargar(x.datos, nombre, x.mime);
        if (r !== 'cancelado') { h.toast(`Cobertura exportada: ${nombre}`); h.contar(def.evento, `Descarga: cobertura ${def.texto}`); }
      } catch (err) { h.toast(`No se pudo generar el archivo: ${err.message}`); }
    });
  }

  // Relieve suelto antiguo: se poda al arrancar, sin prisa
  setTimeout(() => { podarRelieveSuelto().catch(() => {}); }, 4000);

  escribirPanel();
  return {
    alRecalcular() { pintarDetalle(); comprobarVigencia(); quitarConfirmacion(); },
    alCambiarEjercicio() { pintarCapa(); pintarResultado(); if (seleccion && resultado) abrirFicha(seleccion.r, seleccion.c); },
    aplicarEstado() { escribirPanel(); comprobarVigencia(); },
    alTocarMapa,
    calcular,
    // Al cerrar un ejercicio sin permiso para ver la solución, el mapa calculado se descarta
    borrar() {
      if (trabajo) cancelar();
      resultado = null; seleccion = null;
      mapa.ponerCobertura(null); leyenda.hidden = true; cerrarFicha();
      $('#cob-chip').hidden = true; $('#cob-resultado').hidden = true;
      h.alCambiarResultado?.();
    },
    get resultado() { return resultado; },
    get ocupado() { return !!trabajo; },
  };
}
