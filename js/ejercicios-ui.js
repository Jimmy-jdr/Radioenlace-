/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// ejercicios-ui.js — Ejercicios y código QR en la interfaz (versión 1.4)
//   · Ejercicio aleatorio: creación (profesor), enlace ?g=, identificador
//     del alumno, enunciado, casillas de respuesta, comprobación y solución,
//     solucionario CSV.
//   · Ejercicio con el mapa de cobertura: creación (puntos aleatorios o
//     marcados en el mapa), puntos P1…Pn, «Estudiar» (B en el punto),
//     comprobación, solución y solucionario.
//   · Código QR del enlace o de la app: PNG, SVG y pantalla completa.
// =====================================================================
import * as E from './ejercicios.js';
import { codificarQR, qrSVG } from './qr.js';
import { aCSV, descargar } from './informe.js';
import { distanciaKm } from './radio.js';
import { pixelDe, PIXEL } from './cobertura.js';

const $ = (s, el = document) => el.querySelector(s);

export function iniciarEjercicios(h) {
  // h = { mapa, f, esc, toast, contar, guardar, irA, urlApp(), enlaceDe(), estado(), cob(), revelado(), revelar(si),
  //       modoEjercicio(si), aplicarModoEjercicio(), ponerColocar(id), cargarEjemplo(id), cargarEstado(parcial), ponerB(geo, rx), restaurarB(o) }
  const { f, esc } = h;
  const urlEjercicio = (cfg) => `${h.urlApp()}?g=${E.configAParam(cfg)}`;
  const marca = (c) => (!c ? '' : c.vacia ? '<span class="aviso-texto">sin contestar</span>'
    : c.ok ? '<span class="ok-texto">✓ correcto</span>' : '<span class="mal-texto">✗ revisa</span>');

  // ---------- Hojas (diálogos) ----------
  const abrir = (id) => { const el = $(id); el.hidden = false; setTimeout(() => el.querySelector('input:not([type="radio"]):not([type="checkbox"]), select, button')?.focus(), 30); };
  const cerrar = (id) => { $(id).hidden = true; };
  document.addEventListener('click', (e) => { const b = e.target.closest('.cerrar-hoja'); if (b) b.closest('.hoja').hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#qr-grande').hidden) { cerrarGrande(); return; }
    for (const id of ['#hoja-qr', '#hoja-ej', '#hoja-ejcob']) if (!$(id).hidden) { cerrar(id); return; }
  });
  async function copiar(texto, input) {
    try { await navigator.clipboard.writeText(texto); h.toast('Enlace copiado.'); }
    catch { input?.select(); h.toast('Selecciona el enlace y cópialo.'); }
  }

  // =====================================================================
  // 1. Ejercicio aleatorio
  // =====================================================================
  let cache = null;
  const gen = () => h.estado().generado || null;
  function datosGen() {
    const g = gen();
    if (!g) return null;
    const clave = `${g.c}|${g.n}|${E.normalizarId(g.id)}`;
    if (cache?.clave !== clave) cache = { clave, ...E.generarDatos(g, g.id) };
    return cache;
  }

  // ---------- Creación (profesor) ----------
  $('#ej-nivel').innerHTML = Object.entries(E.NIVELES).map(([n, x]) => `<option value="${n}">${esc(x.titulo)}</option>`).join('');
  const textoNivel = () => { $('#ej-nivel-texto').textContent = E.NIVELES[$('#ej-nivel').value].texto; };
  $('#ej-nivel').addEventListener('change', textoNivel);
  textoNivel();
  let creado = null;
  function abrirCrear() {
    $('#ej-creado').hidden = true;
    creado = null;
    abrir('#hoja-ej');
  }
  $('#ej-crear').addEventListener('click', () => {
    creado = { v: 1, c: E.nuevoCodigo(), n: +$('#ej-nivel').value, s: $('#ej-sol').checked ? 1 : 0 };
    const url = urlEjercicio(creado);
    const caja = $('#ej-creado');
    caja.innerHTML = `<p class="codigo-ej">Código <b>${creado.c}</b> · ${esc(E.NIVELES[creado.n].titulo)}${creado.s ? '' : ' · sin ver la solución'}</p>
      <div class="campo"><label for="ej-url">Enlace para los alumnos</label><input id="ej-url" type="text" readonly value="${esc(url)}"></div>
      <div class="botones-exportar">
        <button type="button" data-acc="copiar" class="boton">Copiar enlace</button>
        <button type="button" data-acc="qr" class="boton secundario">Código QR</button>
        <button type="button" data-acc="probar" class="boton secundario">Probar como alumno</button>
      </div>
      <h4>Solucionario</h4>
      <div class="campo"><label for="ej-ids">Identificadores, uno por línea (si lo dejas vacío: del 1 al N)</label><textarea id="ej-ids" rows="3"></textarea></div>
      <div class="fila-n"><div class="campo"><label for="ej-num">N</label><input id="ej-num" type="text" inputmode="numeric" value="30"></div>
        <button type="button" data-acc="csv" class="boton secundario">Descargar solucionario CSV</button></div>`;
    caja.hidden = false;
    h.contar('ejercicio-creado', 'Ejercicio aleatorio creado');
  });
  $('#ej-creado').addEventListener('click', async (e) => {
    const acc = e.target.closest('[data-acc]')?.dataset.acc;
    if (!acc || !creado) return;
    const url = urlEjercicio(creado);
    if (acc === 'copiar') copiar(url, $('#ej-url'));
    if (acc === 'qr') abrirQR(url, 'Este ejercicio', `ejercicio_${creado.c}`);
    if (acc === 'probar') { cerrar('#hoja-ej'); pedirId({ tipo: 'aleatorio', cfg: creado }); }
    if (acc === 'csv') {
      const ids = E.listaIds($('#ej-ids').value, parseInt($('#ej-num').value, 10) || 30);
      const r = await descargar(aCSV(E.filasSolucionario(creado, ids)), `solucionario_${creado.c}_nivel${creado.n}.csv`);
      if (r !== 'cancelado') { h.toast(`Solucionario descargado (${ids.length} alumnos).`); h.contar('descarga-solucionario-csv', 'Descarga: solucionario CSV'); }
    }
  });

  // ---------- Identificador del alumno ----------
  let pendiente = null;
  function pedirId(p) {
    pendiente = p;
    const cob = p.tipo === 'cob';
    $('#hoja-id-tit').textContent = cob ? 'Ejercicio con el mapa de cobertura' : 'Ejercicio aleatorio';
    $('#hoja-id-texto').textContent = cob
      ? `Código ${h.estado().ejcob?.c}. Cada alumno tiene sus propios puntos del mapa.`
      : `Código ${p.cfg.c} · ${E.NIVELES[p.cfg.n].titulo}. Cada alumno tiene sus propios datos.`;
    $('#id-alumno').value = '';
    $('#id-alumno').classList.remove('invalido');
    $('#hoja-id .error').textContent = '';
    abrir('#hoja-id');
  }
  function empezar() {
    const id = $('#id-alumno').value.trim();
    if (!E.normalizarId(id)) {
      $('#id-alumno').classList.add('invalido');
      $('#hoja-id .error').textContent = 'Escribe tu número de lista (o tu identificador).';
      return;
    }
    cerrar('#hoja-id');
    const p = pendiente;
    pendiente = null;
    if (p.tipo === 'cob') {
      const ejc = h.estado().ejcob;
      if (!ejc) return;
      ejc.id = id; ejc.resp = {}; delete ejc.corregido;
      h.guardar();
      pintarCob();
      h.contar('ejercicio-cobertura-iniciado', 'Ejercicio de cobertura iniciado');
      h.toast(`Identificador: ${id}. Calcula el mapa de cobertura para ver tus puntos.`);
      return;
    }
    try {
      const { datos } = E.generarDatos(p.cfg, id);
      h.cargarEstado({ ...E.datosAEstado(datos), ejercicio: true, generado: { c: p.cfg.c, n: p.cfg.n, s: p.cfg.s, id, resp: {} } });
      h.irA('calculos');
      h.contar('ejercicio-iniciado', 'Ejercicio aleatorio iniciado');
      h.toast(`Ejercicio ${p.cfg.c} para «${id}»: lee el enunciado y escribe tus resultados.`);
    } catch (err) { h.toast(`No se pudo crear el ejercicio: ${err.message}`); }
  }
  $('#id-empezar').addEventListener('click', empezar);
  $('#id-alumno').addEventListener('keydown', (e) => { if (e.key === 'Enter') empezar(); });
  $('#id-cancelar').addEventListener('click', () => { cerrar('#hoja-id'); pendiente = null; });

  // ---------- Enunciado y respuestas (pestaña Cálculos) ----------
  function pintar() {
    const g = gen(), caja = $('#ej-respuestas');
    if (!g) { if (caja.dataset.clave) { caja.hidden = true; caja.innerHTML = ''; delete caja.dataset.clave; } return; }
    let d;
    try { d = datosGen(); } catch { caja.hidden = true; return; }
    const { datos, sol } = d;
    $('#enunciado').hidden = false;
    $('#enunciado-titulo').textContent = `Ejercicio aleatorio · ${E.NIVELES[g.n].titulo} · código ${g.c}`;
    $('#enunciado-texto').innerHTML = E.partesEnunciado(datos, g.n).map((t) => `<span class="parrafo">${esc(t)}</span>`).join('');
    const ver = h.revelado();
    const coincide = E.estadoCoincide(h.estado(), datos);
    const clave = `${d.clave}|${ver}|${g.corregido ? 1 : 0}|${g.s}`;
    if (caja.dataset.clave === clave) { $('#resp-aviso').hidden = coincide; return; }   // no se repinta mientras se escribe
    caja.dataset.clave = clave;
    const preg = E.preguntasDe(g.n);
    const corr = g.corregido ? E.corregir(g.resp, sol, g.n) : null;
    const bien = corr ? corr.filter((x) => x.ok).length : 0;
    caja.hidden = false;
    caja.innerHTML = `<div class="tarjeta-cab"><h2>Tus resultados</h2><span class="chip">${esc(g.id)}</span></div>
      <p class="nota">Calcula a mano con los datos del enunciado y escribe tus resultados (con coma o punto decimal). Se aceptan las pequeñas diferencias de redondeo y de constantes (c = 3·10⁸ m/s, 32,44 dB, R = 6370 km).</p>
      <p id="resp-aviso" class="aviso-texto" ${coincide ? 'hidden' : ''}>⚠ Has cambiado algún dato del enunciado: la comprobación usa siempre los datos originales.</p>
      <div class="tabla-desliza"><table class="tabla-resp">
        <thead><tr><th>Magnitud</th><th>Tu resultado</th><th>Comprobación</th>${ver ? '<th>Solución</th>' : ''}</tr></thead>
        <tbody>${preg.map((p, i) => `<tr>
          <td><label for="resp-${p.clave}">${esc(p.texto)}</label></td>
          <td><div class="con-ud"><input id="resp-${p.clave}" data-clave="${p.clave}" type="text" inputmode="decimal" autocomplete="off" value="${esc(g.resp?.[p.clave] ?? '')}">${p.unidad ? `<span>${p.unidad}</span>` : ''}</div></td>
          <td class="marca" data-marca="${p.clave}">${marca(corr?.[i])}</td>
          ${ver ? `<td class="num">${f(sol[p.clave], E.decimales(p, sol[p.clave]))} ${p.unidad}<small> ± ${f(E.tolerancia(p, sol[p.clave]), E.decimales(p, E.tolerancia(p, sol[p.clave])))}</small></td>` : ''}
        </tr>`).join('')}</tbody></table></div>
      ${corr ? `<p class="resumen-resp ${bien === preg.length ? 'ok-texto' : ''}"><b>${bien} de ${preg.length}</b> correctas${bien === preg.length ? '. ¡Muy bien!' : '.'}</p>` : ''}
      <div class="botones-exportar">
        <button type="button" id="resp-comprobar" class="boton">Comprobar mis resultados</button>
        ${g.s ? `<button type="button" id="resp-solucion" class="boton secundario">${ver ? 'Ocultar la solución' : 'Ver la solución'}</button>` : '<p class="nota">En este ejercicio no se puede ver la solución.</p>'}
      </div>`;
  }
  $('#ej-respuestas').addEventListener('input', (e) => {
    const clave = e.target.dataset.clave, g = gen();
    if (!clave || !g) return;
    g.resp = { ...g.resp, [clave]: e.target.value.slice(0, 20) };
    const m = $(`[data-marca="${clave}"]`);
    if (m) m.innerHTML = '';
    h.guardar();
  });
  $('#ej-respuestas').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) $('#resp-comprobar')?.click(); });
  $('#ej-respuestas').addEventListener('click', (e) => {
    const g = gen();
    if (!g) return;
    if (e.target.id === 'resp-comprobar') {
      g.corregido = true;
      h.guardar();
      delete $('#ej-respuestas').dataset.clave;
      pintar();
      const c = E.corregir(g.resp, datosGen().sol, g.n);
      h.toast(`${c.filter((x) => x.ok).length} de ${c.length} resultados correctos.`);
      h.contar('ejercicio-comprobado', 'Ejercicio aleatorio comprobado');
    }
    if (e.target.id === 'resp-solucion' && g.s) h.revelar(!h.revelado());
  });

  // =====================================================================
  // 2. Ejercicio con el mapa de cobertura
  // =====================================================================
  const ejc = () => h.estado().ejcob || null;
  let colocados = [];            // marcadores P1…Pn en el mapa
  let cachePuntos = null;
  function quitarPuntos() { for (const id of colocados) h.mapa.quitarMarcador(id); colocados = []; }
  function ponerPuntos(pts) {
    quitarPuntos();
    pts.forEach((p, k) => { const id = `P${k + 1}`; h.mapa.ponerMarcador(id, { lat: p.lat, lon: p.lon }, id, 'marcador-punto'); colocados.push(id); });
  }
  function resultadoListo() {
    const R0 = h.cob()?.resultado;
    return R0?.completo && !R0.desactualizado ? R0 : null;
  }
  function puntosCob() {
    const e = ejc(), R0 = resultadoListo();
    if (!e || !R0 || (!e.fijos && !e.id)) return null;
    const clave = `${e.c}|${e.id}|${JSON.stringify(e.fijos)}|${e.n}`;
    if (cachePuntos?.R0 !== R0 || cachePuntos.clave !== clave) {
      cachePuntos = { R0, clave, pts: E.elegirPuntos(R0.res, R0.malla, R0.params, e, e.id) };
      setTimeout(() => h.mapa.encuadrar([R0.params.a, ...cachePuntos.pts], 50), 0);   // A y los puntos a la vista
    }
    return cachePuntos.pts;
  }

  function pintarCob() {
    const est = h.estado(), e = ejc(), caja = $('#ej-cob');
    if (!e || !est.ejercicio) { caja.hidden = true; caja.innerHTML = ''; if (!marcado) quitarPuntos(); return; }
    caja.hidden = false;
    const R0Raw = h.cob()?.resultado, R0 = resultadoListo();
    const ver = h.revelado();
    const lectura = e.modo === 'lectura';
    let cuerpo;
    if (!e.fijos && !e.id) {
      quitarPuntos();
      cuerpo = '<p>Escribe tu identificador para recibir tus puntos.</p><button type="button" data-acc="id" class="boton">Escribir mi identificador</button>';
    } else if (!R0) {
      quitarPuntos();
      cuerpo = `${R0Raw?.desactualizado ? '<p class="aviso-texto">Los datos han cambiado desde que se calculó el mapa: vuelve a calcularlo con los datos del ejercicio.</p>' : ''}
        <p>Primero calcula el mapa de cobertura con los datos del ejercicio${lectura ? '' : ' (no se verá hasta el final)'}.</p>
        <button type="button" data-acc="calcular" class="boton" ${h.cob()?.ocupado ? 'disabled' : ''}>${h.cob()?.ocupado ? 'Calculando…' : 'Calcular cobertura'}</button>`;
    } else {
      const pts = puntosCob();
      ponerPuntos(pts);
      const corr = e.corregido ? pts.map((p) => E.corregirPunto(e.resp?.[p.k], E.solucionPunto(R0.res, p))) : null;
      const cuentan = corr ? corr.filter((c) => c.cuenta) : [];
      cuerpo = `<ol class="lista-puntos">${pts.map((p, k) => {
        const s = E.solucionPunto(R0.res, p);
        const c = corr?.[k];
        const marcaP = !c ? '' : !c.cuenta ? '<span class="nota">sin cálculo: no cuenta</span>' : c.vacia ? '<span class="aviso-texto">sin contestar</span>'
          : `<span class="${c.llega ? 'ok-texto' : 'mal-texto'}">${c.llega ? '✓' : '✗'} llega</span> <span class="${c.banda ? 'ok-texto' : 'mal-texto'}">${c.banda ? '✓' : '✗'} margen</span>`;
        return `<li>
          <div class="punto-cab"><b class="pastilla-p">P${k + 1}</b><span class="coord">${f(p.lat, 5)}°, ${f(p.lon, 5)}° · ${f(distanciaKm(R0.params.a, p), 2)} km de A</span></div>
          <div class="punto-resp">
            <select data-k="${k}" aria-label="Respuesta para P${k + 1}"><option value="">— Elige —</option>${E.OPCIONES_COB.map((o) => `<option value="${o.v}" ${String(e.resp?.[k] ?? '') === String(o.v) ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>
            ${lectura ? '' : `<button type="button" data-estudiar="${k}" class="boton secundario">Estudiar</button>`}
          </div>
          <div class="punto-marca">${marcaP}${ver ? `<span class="sol">${s ? `${esc(E.OPCIONES_COB.find((o) => o.v === s.banda).texto)} (margen ${f(s.margen, 1)} dB)` : 'sin cálculo'}</span>` : ''}</div>
        </li>`;
      }).join('')}</ol>
      ${e.bOrig ? '<p class="aviso-texto">B está ahora en un punto del ejercicio. <button type="button" data-acc="volver" class="boton secundario">Volver a B</button></p>' : ''}
      ${corr ? `<p class="resumen-resp">Llega o no llega: <b>${cuentan.filter((c) => c.llega).length} de ${cuentan.length}</b> · margen: <b>${cuentan.filter((c) => c.banda).length} de ${cuentan.length}</b>.</p>` : ''}
      <div class="botones-exportar">
        <button type="button" data-acc="comprobar" class="boton">Comprobar mis respuestas</button>
        ${e.s ? `<button type="button" data-acc="solucion" class="boton secundario">${ver ? 'Ocultar la solución' : 'Ver la solución'}</button>` : ''}
      </div>`;
    }
    caja.innerHTML = `<div class="tarjeta-cab"><h2>Ejercicio de cobertura</h2><span class="chip">código ${esc(e.c)}${e.id ? ` · ${esc(e.id)}` : ''}</span></div>
      <p class="nota">${lectura
        ? '¿Llega la señal de A a cada punto? Mira los colores del mapa de cobertura (la leyenda indica el margen sobre la sensibilidad) y elige la respuesta de cada punto.'
        : '¿Llega la señal de A a cada punto? Pulsa «Estudiar» para ver el perfil del terreno desde A hasta ese punto (B se coloca allí con la antena receptora del mapa), razona con la línea de visión y Fresnel y elige la respuesta. El mapa se verá al final.'}</p>
      ${cuerpo}`;
  }
  $('#ej-cob').addEventListener('change', (e) => {
    const k = e.target.dataset.k, x = ejc();
    if (k == null || !x) return;
    x.resp = { ...x.resp, [k]: e.target.value };
    h.guardar();
  });
  $('#ej-cob').addEventListener('click', (e) => {
    const x = ejc();
    if (!x) return;
    const acc = e.target.closest('[data-acc]')?.dataset.acc, est = e.target.closest('[data-estudiar]')?.dataset.estudiar;
    if (acc === 'id') pedirId({ tipo: 'cob' });
    if (acc === 'calcular') { $('#cobertura').open = true; h.cob()?.calcular(); setTimeout(pintarCob, 50); }
    if (acc === 'comprobar') {
      x.corregido = true; h.guardar(); pintarCob();
      h.contar('ejercicio-cobertura-comprobado', 'Ejercicio de cobertura comprobado');
    }
    if (acc === 'solucion' && x.s) h.revelar(!h.revelado());
    if (acc === 'volver' && x.bOrig) { const o = x.bOrig; delete x.bOrig; h.restaurarB(o); h.guardar(); pintarCob(); h.toast('B ha vuelto a su emplazamiento.'); }
    if (est != null) {
      const R0 = resultadoListo(), p = puntosCob()?.[+est];
      if (!R0 || !p) return;
      if (!x.bOrig) { const b = h.estado().b; x.bOrig = { lat: b.lat, lon: b.lon, h: b.h, g: b.g, l: b.l }; }
      h.ponerB({ lat: p.lat, lon: p.lon }, R0.params.rx);
      h.guardar();
      pintarCob();
      h.toast(`B está en P${+est + 1}: mira el perfil desde A.`);
      $('#s-perfil')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ---------- Creación (profesor) ----------
  let marcado = null;            // { cfg, puntos }
  let creadoCob = null;
  $('#cob-crear-ej').addEventListener('click', () => {
    const R0 = h.cob()?.resultado;
    if (!R0?.completo) { h.toast('Calcula antes el mapa de cobertura.'); return; }
    if (R0.desactualizado) { h.toast('Los datos han cambiado: vuelve a calcular el mapa antes de crear el ejercicio.'); return; }
    $('#ejcob-creado').hidden = true;
    abrir('#hoja-ejcob');
  });
  $('#ejcob-crear').addEventListener('click', () => {
    const cfg = { c: E.nuevoCodigo(), modo: $('#ejcob-modo').value, n: +$('#ejcob-n').value, s: $('#ejcob-sol').checked ? 1 : 0, fijos: null };
    if ($('#ejcob-puntos').value === 'fijos') {
      cerrar('#hoja-ejcob');
      marcado = { cfg, puntos: [] };
      h.ponerColocar('ninguno');
      h.irA('enlace');
      $('#banda-marcar').hidden = false;
      textoMarcado();
      return;
    }
    finalizarCob(cfg);
  });
  function textoMarcado() {
    const n = marcado.puntos.length;
    $('#banda-marcar-texto').textContent = n ? `${n} ${n === 1 ? 'punto marcado' : 'puntos marcados'} (máximo 8). Toca el mapa para añadir más o pulsa «Terminar».` : 'Toca el mapa (sobre la cobertura) para marcar los puntos del ejercicio: P1, P2…';
  }
  function alTocarMapa(geo) {
    if (!marcado) return false;
    const R0 = h.cob()?.resultado;
    if (!R0) return true;
    const p = pixelDe(R0.malla, geo.lat, geo.lon);
    const i = p ? p.r * R0.malla.N + p.c : -1;
    if (!p || R0.res.estado[i] !== PIXEL.OK) { h.toast('Ese punto no tiene cálculo de cobertura: elige otro.'); return true; }
    if (marcado.puntos.length >= 8) { h.toast('Como máximo, 8 puntos.'); return true; }
    marcado.puntos.push({ lat: R0.malla.latC[p.r], lon: R0.malla.lonC[p.c] });
    ponerPuntos(marcado.puntos);
    textoMarcado();
    return true;
  }
  $('#marcar-deshacer').addEventListener('click', () => { if (!marcado) return; marcado.puntos.pop(); ponerPuntos(marcado.puntos); textoMarcado(); });
  $('#marcar-cancelar').addEventListener('click', () => { marcado = null; $('#banda-marcar').hidden = true; quitarPuntos(); });
  $('#marcar-terminar').addEventListener('click', () => {
    if (!marcado?.puntos.length) { h.toast('Marca al menos un punto.'); return; }
    const cfg = { ...marcado.cfg, fijos: marcado.puntos, n: marcado.puntos.length };
    marcado = null;
    $('#banda-marcar').hidden = true;
    quitarPuntos();
    finalizarCob(cfg);
  });

  async function finalizarCob(cfg) {
    const { colocar, generado, ...datos } = h.estado();
    const url = await h.enlaceDe({ ...datos, ejercicio: true, ejcob: { c: cfg.c, modo: cfg.modo, n: cfg.n, s: cfg.s, fijos: cfg.fijos } });
    creadoCob = { cfg, url };
    const caja = $('#ejcob-creado');
    caja.innerHTML = `<p class="codigo-ej">Código <b>${cfg.c}</b> · ${cfg.modo === 'lectura' ? 'lectura del mapa' : 'predicción'} · ${cfg.fijos ? `${cfg.fijos.length} puntos fijos` : `${cfg.n} puntos aleatorios por alumno`}${cfg.s ? '' : ' · sin ver la solución'}</p>
      <div class="campo"><label for="ejcob-url">Enlace para los alumnos</label><input id="ejcob-url" type="text" readonly value="${esc(url)}"></div>
      <div class="botones-exportar">
        <button type="button" data-acc="copiar" class="boton">Copiar enlace</button>
        <button type="button" data-acc="qr" class="boton secundario">Código QR</button>
        <button type="button" data-acc="probar" class="boton secundario">Probar como alumno</button>
      </div>
      <h4>Solucionario</h4>
      ${cfg.fijos ? '' : '<div class="campo"><label for="ejcob-ids">Identificadores, uno por línea (si lo dejas vacío: del 1 al N)</label><textarea id="ejcob-ids" rows="3"></textarea></div>'}
      <div class="fila-n">${cfg.fijos ? '' : '<div class="campo"><label for="ejcob-num">N</label><input id="ejcob-num" type="text" inputmode="numeric" value="30"></div>'}
        <button type="button" data-acc="csv" class="boton secundario">Descargar solucionario CSV</button></div>
      <p class="nota">El alumno calcula el mismo mapa en su dispositivo: con el mismo relieve del IGN obtiene los mismos píxeles.</p>`;
    caja.hidden = false;
    abrir('#hoja-ejcob');
    h.contar('ejercicio-cobertura-creado', 'Ejercicio de cobertura creado');
  }
  $('#ejcob-creado').addEventListener('click', async (e) => {
    const acc = e.target.closest('[data-acc]')?.dataset.acc;
    if (!acc || !creadoCob) return;
    const { cfg, url } = creadoCob;
    if (acc === 'copiar') copiar(url, $('#ejcob-url'));
    if (acc === 'qr') abrirQR(url, 'Este ejercicio', `ejercicio_cobertura_${cfg.c}`);
    if (acc === 'probar') {
      cerrar('#hoja-ejcob');
      h.estado().ejcob = { c: cfg.c, modo: cfg.modo, n: cfg.n, s: cfg.s, fijos: cfg.fijos, resp: {} };
      h.modoEjercicio(true);
      h.irA('enlace');
      if (!cfg.fijos) pedirId({ tipo: 'cob' });
    }
    if (acc === 'csv') {
      const R0 = h.cob()?.resultado;
      if (!R0?.completo || R0.desactualizado) { h.toast('El mapa ya no está calculado con estos datos.'); return; }
      const ids = cfg.fijos ? [] : E.listaIds($('#ejcob-ids').value, parseInt($('#ejcob-num').value, 10) || 30);
      const filas = E.filasSolucionarioCob(R0.res, R0.malla, R0.params, E.normalizarEjCob(cfg), ids);
      const r = await descargar(aCSV(filas), `solucionario_cobertura_${cfg.c}.csv`);
      if (r !== 'cancelado') { h.toast('Solucionario descargado.'); h.contar('descarga-solucionario-csv', 'Descarga: solucionario CSV'); }
    }
  });

  // =====================================================================
  // 3. Salir de un ejercicio
  // =====================================================================
  function salir() {
    const est = h.estado();
    const sinSolucion = (est.generado && !est.generado.s) || (est.ejcob && !est.ejcob.s);
    if (est.ejcob?.bOrig) h.restaurarB(est.ejcob.bOrig);
    quitarPuntos();
    if (sinSolucion) {
      // Sin permiso para ver la solución: se cierra el ejercicio sin mostrar resultados
      h.cob()?.borrar();
      h.cargarEjemplo('talavera');
      h.toast('Ejercicio cerrado.');
      return;
    }
    delete est.generado;
    delete est.ejcob;
    delete $('#ej-respuestas').dataset.clave;
    h.modoEjercicio(false);
    h.toast('Ejercicio terminado: ya se ven todos los resultados.');
  }

  // =====================================================================
  // 4. Código QR
  // =====================================================================
  let qr = { enlace: '', nombre: 'radioenlace', actual: null };
  const textoQR = () => ($('#hoja-qr input[name="qr-que"]:checked').value === 'app' ? h.urlApp() : qr.enlace);
  function pintarQR() {
    const texto = textoQR();
    try {
      const q = codificarQR(texto, { nivel: 'M' });
      qr.actual = q;
      $('#qr-imagen').innerHTML = qrSVG(q, { modulo: 6 });
      $('#qr-info').textContent = `Versión ${q.version} (${q.tam} × ${q.tam} módulos) · corrección M (15 %) · ${q.bytes} caracteres.` +
        (q.version > 12 ? ' Es un código denso: proyéctalo grande o imprímelo de al menos 5 × 5 cm.' : '');
    } catch (err) {
      qr.actual = null;
      $('#qr-imagen').innerHTML = '';
      $('#qr-info').textContent = err.message;
    }
  }
  function abrirQR(url, etiqueta = 'Este enlace', nombre = 'radioenlace') {
    qr = { enlace: url, nombre, actual: null };
    $('#qr-que-enlace').textContent = etiqueta;
    $('#hoja-qr input[value="enlace"]').checked = true;
    pintarQR();
    abrir('#hoja-qr');
    h.contar('qr-generado', 'Código QR generado');
  }
  $('#hoja-qr').addEventListener('change', (e) => { if (e.target.name === 'qr-que') pintarQR(); });
  const nombreQR = (ext) => `qr_${$('#hoja-qr input[name="qr-que"]:checked').value === 'app' ? 'radioenlace_app' : qr.nombre}.${ext}`;
  $('#qr-svg').addEventListener('click', async () => {
    if (!qr.actual) return;
    const r = await descargar(qrSVG(qr.actual, { modulo: 10 }), nombreQR('svg'), 'image/svg+xml');
    if (r !== 'cancelado') { h.toast('Código QR descargado (SVG).'); h.contar('descarga-qr-svg', 'Descarga: código QR SVG'); }
  });
  $('#qr-png').addEventListener('click', async () => {
    const q = qr.actual;
    if (!q) return;
    const n = q.tam + 8, m = Math.max(4, Math.floor(1200 / n));
    const cv = document.createElement('canvas');
    cv.width = cv.height = n * m;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#000';
    for (let y = 0; y < q.tam; y++) for (let x = 0; x < q.tam; x++) if (q.modulos[y][x]) g.fillRect((x + 4) * m, (y + 4) * m, m, m);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    const r = await descargar(blob, nombreQR('png'), 'image/png');
    if (r !== 'cancelado') { h.toast('Código QR descargado (PNG).'); h.contar('descarga-qr-png', 'Descarga: código QR PNG'); }
  });
  function cerrarGrande() {
    $('#qr-grande').hidden = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  $('#qr-pantalla').addEventListener('click', () => {
    if (!qr.actual) return;
    const el = $('#qr-grande');
    el.innerHTML = `${qrSVG(qr.actual, { modulo: 10 })}<p>Toca para cerrar</p>`;
    el.hidden = false;
    el.requestFullscreen?.().catch(() => {});
  });
  $('#qr-grande').addEventListener('click', cerrarGrande);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !$('#qr-grande').hidden) $('#qr-grande').hidden = true; });

  // =====================================================================
  return {
    abrirCrear, pedirId, abrirQR, salir, urlEjercicio, alTocarMapa,
    alRecalcular() { pintar(); },
    alCambiarEjercicio() { pintar(); pintarCob(); },
    alCambiarCobertura() { pintarCob(); },
    aplicarEstado() {
      cachePuntos = null;
      delete $('#ej-respuestas').dataset.clave;
      pintar();
      pintarCob();
      const e = ejc();
      if (e && h.estado().ejercicio && !e.fijos && !e.id) pedirId({ tipo: 'cob' });
    },
    get marcando() { return !!marcado; },
  };
}
