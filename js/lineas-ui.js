/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// lineas-ui.js — Panel «Pérdidas de cada lado: línea y accesorios» de la
// pestaña Datos (versión 1.5). Los cálculos están en lineas.js.
//
// · Cada lado (A y B) tiene sus pérdidas «A mano» (como hasta ahora) o
//   «Calculadas» a partir de su lista de elementos a la frecuencia del enlace.
// · Con «Calculadas», el campo «Pérdidas (dB)» de la tabla de arriba se
//   rellena solo (y no se puede escribir en él). Si algún elemento no se
//   puede calcular a esa frecuencia, se mantiene el último valor válido y se
//   avisa en rojo.
// =====================================================================
import * as L from './lineas.js';
import { COAXIALES, ELIPTICAS, RECTANGULARES, MATERIALES, ACCESORIOS, CONSULTA, FUENTE_WR, FUENTE_F758 } from './catalogo-lineas.js';

const $ = (s, el = document) => el.querySelector(s);

export function iniciarLineas(h) {
  // h = { estado(), fMHz(), recalcular(), contar(), f, fe, esc, leerNumero }
  const { f, fe, esc } = h;
  const panel = $('#lineas');
  const lado = (s) => h.estado()[s];
  const linea = (s) => {
    const x = lado(s);
    if (!x.linea) x.linea = { modo: 'manual', elementos: [] };
    return x.linea;
  };
  let ultimo = { a: null, b: null };   // último resultado de perdidasLinea por lado

  // ---------- Opciones de los selectores ----------
  const opt = (v, t, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(t)}</option>`;
  const gruposCoax = () => {
    const grupos = [['Flexibles de baja pérdida (Times Microwave LMR)', COAXIALES.filter((c) => c.id.startsWith('LMR'))],
      ['Coaxiales RG (Belden)', COAXIALES.filter((c) => c.id.startsWith('RG'))],
      ['Corrugados HELIAX (ANDREW)', COAXIALES.filter((c) => /^(LDF|FSJ|AVA)/.test(c.id))]];
    return (sel) => grupos.map(([g, cs]) => `<optgroup label="${esc(g)}">${cs.map((c) => opt(c.id, `${c.clase} · ${c.modelo}`, c.id === sel)).join('')}</optgroup>`).join('');
  };
  const optCoax = gruposCoax();
  const optEW = (sel) => ELIPTICAS.map((g) => opt(g.id, `${g.id} · ${fe(g.banda[0], 3)}–${fe(g.banda[1], 3)} GHz`, g.id === sel)).join('');
  const optWR = (sel) => RECTANGULARES.map((g) => opt(g.id, `${g.id} (${g.iec}) · ${fe(g.banda[0], 2)}–${fe(g.banda[1], 2)} GHz`, g.id === sel)).join('');
  const optMat = (sel) => MATERIALES.map((m) => opt(m.id, m.nombre, m.id === sel)).join('');
  const optAcc = (sel) => ACCESORIOS.map((a) => opt(a.id, a.nombre, a.id === sel)).join('');
  const optAnadir = () => '<option value="">Añadir elemento…</option>' +
    `<optgroup label="Línea">${opt('coaxial', 'Cable coaxial')}${opt('eliptica', 'Guía de onda elíptica')}${opt('rectangular', 'Guía de onda rectangular (WR)')}${opt('propia', 'Línea con datos propios')}</optgroup>` +
    `<optgroup label="Accesorios">${ACCESORIOS.map((a) => opt(`acc:${a.id}`, a.nombre)).join('')}</optgroup>`;

  // ---------- Pintado ----------
  function filaElemento(s, el, i) {
    const n = (campo, valor, etq, ancho = '6em', extra = '') => `<label class="lin-num" style="--ancho:${ancho}"><span>${etq}</span><input type="text" inputmode="decimal" data-campo="${campo}" value="${esc(valor ?? '')}" ${extra}></label>`;
    let datos = '';
    switch (el.tipo) {
      case 'coaxial':
        datos = `<label class="lin-sel"><span>Cable</span><select data-campo="modelo">${optCoax(el.modelo)}</select></label>${n('longitud', fe(el.longitud, 1), 'Longitud (m)')}`;
        break;
      case 'eliptica':
        datos = `<label class="lin-sel"><span>Guía elíptica (ANDREW)</span><select data-campo="modelo">${optEW(el.modelo)}</select></label>${n('longitud', fe(el.longitud, 1), 'Longitud (m)')}`;
        break;
      case 'rectangular':
        datos = `<label class="lin-sel"><span>Guía rectangular</span><select data-campo="modelo">${optWR(el.modelo)}</select></label>` +
          `<label class="lin-sel"><span>Material</span><select data-campo="material">${optMat(el.material)}</select></label>${n('longitud', fe(el.longitud, 1), 'Longitud (m)')}`;
        break;
      case 'propia':
        datos = `<label class="lin-sel"><span>Nombre</span><input type="text" data-campo="nombre" maxlength="60" value="${esc(el.nombre)}" placeholder="p. ej. modelo de la ficha"></label>` +
          `<label class="lin-sel"><span>Datos de la ficha</span><select data-campo="forma">${opt('k', 'α = k1·√f + k2·f (dB/100 m, f en MHz)', el.forma === 'k')}${opt('puntos', 'Tabla: frecuencia (MHz) y dB/100 m', el.forma === 'puntos')}</select></label>` +
          (el.forma === 'k'
            ? `${n('k1', Number.isFinite(el.k1) ? fe(el.k1, 6) : '', 'k1')}${n('k2', Number.isFinite(el.k2) ? fe(el.k2, 7) : '', 'k2')}`
            : `<label class="lin-sel lin-puntos"><span>Una fila por punto: «MHz; dB/100 m»</span><textarea data-campo="puntos" rows="3">${esc((el.puntos || []).filter((p) => p.every(Number.isFinite)).map((p) => `${fe(p[0], 3)}; ${fe(p[1], 3)}`).join('\n'))}</textarea></label>`) +
          n('longitud', fe(el.longitud, 1), 'Longitud (m)');
        break;
      case 'accesorio': {
        const a = L.accesorio(el.id);
        const ref = a.coef != null ? `${fe(a.coef, 2)}·√f` : fe(a.valor, 2);
        datos = `<label class="lin-sel"><span>Accesorio</span><select data-campo="id">${optAcc(el.id)}</select></label>${n('n', String(el.n), 'Cantidad', '4.5em')}` +
          n('valor', el.valor != null ? fe(el.valor, 3) : '', 'dB/unidad (vacío: catálogo)', '9em', `placeholder="${esc(ref)}"`);
        break;
      }
      default: break;
    }
    return `<li class="lin-elem" data-lado="${s}" data-i="${i}">
      <div class="lin-datos">${datos}</div>
      <div class="lin-res"><b data-salida="dB">—</b><small data-salida="alfa"></small>
        <button type="button" class="lin-quitar" data-acc="quitar" aria-label="Quitar este elemento" title="Quitar">×</button></div>
      <p class="lin-msg" data-salida="msg"></p>
    </li>`;
  }

  function pintarLado(s) {
    const ln = linea(s);
    const cont = $(`#lin-${s}`);
    const calc = ln.modo === 'calculada';
    cont.innerHTML = `
      <div class="lin-cab">
        <h3><i class="pastilla-${s}">${s.toUpperCase()}</i> Lado ${s.toUpperCase()}</h3>
        <div class="lin-modo" role="radiogroup" aria-label="Pérdidas del lado ${s.toUpperCase()}">
          <label><input type="radio" name="lin-modo-${s}" value="manual" ${calc ? '' : 'checked'}> A mano</label>
          <label><input type="radio" name="lin-modo-${s}" value="calculada" ${calc ? 'checked' : ''}> Calculadas</label>
        </div>
      </div>
      ${calc ? `
      <div class="lin-config"><span>Partir de:</span>
        ${Object.entries(L.CONFIGURACIONES).map(([id, c]) => `<button type="button" class="boton secundario" data-acc="config" data-conf="${id}" title="${esc(c.texto)}">${esc(c.titulo)}</button>`).join('')}
      </div>
      <ul class="lin-lista">${ln.elementos.map((el, i) => filaElemento(s, el, i)).join('') || '<li class="nota lin-vacia">Sin elementos: 0 dB (radio junto a la antena).</li>'}</ul>
      <div class="lin-pie">
        <select data-acc="anadir" aria-label="Añadir un elemento al lado ${s.toUpperCase()}">${optAnadir()}</select>
        <button type="button" class="boton secundario" data-acc="copiar">Copiar al lado ${s === 'a' ? 'B' : 'A'}</button>
        <p class="lin-total">Total: <b data-salida="total">—</b></p>
      </div>
      <p class="lin-error" data-salida="error" hidden></p>` : `<p class="nota">Se usan las pérdidas escritas en la tabla de arriba (${f(lado(s).l, 2)} dB).</p>`}`;
    actualizarSalidas();
  }

  function pintar() {
    pintarLado('a');
    pintarLado('b');
    pintarOrientacion();
    pintarFuentes();
  }

  // ---------- Resultados (sin volver a crear los campos) ----------
  function actualizarSalidas() {
    const fMHz = h.fMHz();
    for (const s of ['a', 'b']) {
      const ln = linea(s);
      const campo = $(`#${s}-l`);
      const calc = ln.modo === 'calculada';
      campo.readOnly = calc;
      campo.classList.toggle('calculado', calc);
      campo.title = calc ? 'Calculadas a partir de la línea y los accesorios (debajo de la tabla)' : '';
      if (!calc) { ultimo[s] = null; continue; }
      const r = L.perdidasLinea(ln, fMHz);
      ultimo[s] = r;
      // En un ejercicio sin revelar, las pérdidas calculadas son parte de la respuesta: no se muestran
      const oculta = !!h.ocultar?.();
      campo.placeholder = oculta ? 'a calcular' : '';
      if (document.activeElement !== campo) campo.value = oculta ? '' : fe(lado(s).l, 2);
      const cont = $(`#lin-${s}`);
      r.elementos.forEach((x, i) => {
        const li = cont.querySelector(`.lin-elem[data-i="${i}"]`);
        if (!li) return;
        li.querySelector('[data-salida="dB"]').textContent = x.error ? '—' : oculta ? '? dB' : `${f(x.dB, 2)} dB`;
        li.querySelector('[data-salida="alfa"]').textContent = oculta ? '' : x.dB100m != null ? `${f(x.dB100m, 2)} dB/100 m` : x.unidad != null && x.el.n !== 1 ? `${f(x.unidad, 3)} dB/u.` : '';
        const msg = li.querySelector('[data-salida="msg"]');
        msg.textContent = x.error || x.avisos.join(' · ');
        msg.className = `lin-msg ${x.error ? 'mal' : x.avisos.length ? 'aviso' : ''}`;
      });
      const tot = cont.querySelector('[data-salida="total"]');
      if (tot) tot.textContent = oculta ? 'a calcular' : r.valido ? `${f(r.total, 2)} dB a ${fMHz >= 1000 ? `${f(fMHz / 1000, 3)} GHz` : `${f(fMHz, 1)} MHz`}` : '—';
      const err = cont.querySelector('[data-salida="error"]');
      if (err) {
        err.hidden = r.valido || oculta;
        err.textContent = r.valido ? '' : `No se pueden calcular las pérdidas a esta frecuencia: se mantiene el último valor (${f(lado(s).l, 2)} dB). Revisa los elementos marcados en rojo.`;
      }
    }
    const res = h.ocultar?.() ? [] : ['a', 'b'].map((s) => (linea(s).modo === 'calculada' ? `${s.toUpperCase()}: ${f(lado(s).l, 2)} dB (calculadas)` : null)).filter(Boolean);
    $('#lin-resumen').textContent = res.join(' · ');
  }

  function pintarOrientacion() {
    const fGHz = h.fMHz() / 1000;
    const filas = L.f758DeBanda(fGHz);
    $('#lin-orientacion').innerHTML = `<b>Orientación.</b> ${Object.values(L.CONFIGURACIONES).map((c) => `<b>${esc(c.titulo)}:</b> ${esc(c.texto)}`).join(' ')} ` +
      (filas.length ? `Para ${f(fGHz, 3)} GHz, la UIT-R F.758-8 da unas pérdidas de alimentador y multiplexor de ${filas.map((x) => `${esc(x.rango)} dB (${fe(x.f[0], 3)}–${fe(x.f[1], 3)} GHz, cuadro ${x.cuadro})`).join('; ')}.` : '');
  }

  function pintarFuentes() {
    const usados = [];
    for (const s of ['a', 'b']) {
      if (linea(s).modo !== 'calculada') continue;
      for (const el of linea(s).elementos) {
        const fu = L.fuenteElemento(el);
        if (fu && !usados.some((u) => u.texto === fu.texto)) usados.push(fu);
      }
    }
    const lista = usados.map((u) => `<li>${esc(u.texto)}${u.url ? ` <a href="${esc(u.url)}" target="_blank" rel="noopener">Ficha</a>` : ''}</li>`).join('');
    $('#lin-fuentes').innerHTML = `
      <p class="nota">Datos copiados de las fichas de los fabricantes (consultadas el ${CONSULTA}); las pruebas de la app comprueban que reproduce cada valor publicado. Son valores típicos (o máximos, cuando la ficha solo da el máximo): si tienes la ficha de tu equipo, escribe su valor.</p>
      ${lista ? `<ul class="lin-lista-fuentes">${lista}</ul>` : '<p class="nota">Elige «Calculadas» en un lado para ver aquí las fuentes de sus elementos.</p>'}
      <p class="nota">Guía rectangular: ${esc(FUENTE_WR.formula)} ${esc(FUENTE_WR.dimensiones)} Contrastada con ${esc(FUENTE_WR.contraste)}</p>
      <p class="nota">Orientación: ${esc(FUENTE_F758.ref)}. ${esc(FUENTE_F758.nota)} <a href="${FUENTE_F758.url}" target="_blank" rel="noopener">UIT-R F.758</a></p>`;
  }

  // ---------- Eventos ----------
  const leer = (v) => h.leerNumero(String(v));
  function cambiar(s, fn, rehacer = false) {
    fn(linea(s));
    h.recalcular();
    if (rehacer) { pintarLado(s); pintarFuentes(); } else actualizarSalidas();
  }

  panel.addEventListener('change', (ev) => {
    const t = ev.target;
    const cont = t.closest('.lin-lado');
    if (!cont) return;
    const s = cont.dataset.lado;
    if (t.name === `lin-modo-${s}`) {
      const calc = t.value === 'calculada';
      cambiar(s, (ln) => {
        ln.modo = calc ? 'calculada' : 'manual';
        if (calc && !ln.elementos.length) ln.elementos = L.configuracionInicial(h.fMHz());
      }, true);
      if (calc) h.contar('perdidas-linea-aplicadas', 'Pérdidas de línea calculadas');
      return;
    }
    if (t.dataset.acc === 'anadir') {
      const v = t.value;
      t.value = '';
      if (!v) return;
      const fMHz = h.fMHz();
      let el;
      if (v.startsWith('acc:')) el = { tipo: 'accesorio', id: v.slice(4), n: 1, valor: null };
      else if (v === 'coaxial') el = { tipo: 'coaxial', modelo: (L.coaxialParaBajada(fMHz) || L.coaxial('LMR-400')).id, longitud: 10 };
      else if (v === 'eliptica') el = { tipo: 'eliptica', modelo: (L.elipticaDeBanda(fMHz / 1000) || ELIPTICAS[0]).id, longitud: 10 };
      else if (v === 'rectangular') el = { tipo: 'rectangular', modelo: (L.rectangularDeBanda(fMHz / 1000) || RECTANGULARES[5]).id, material: 'cobre', longitud: 2 };
      else el = { tipo: 'propia', nombre: '', forma: 'k', k1: NaN, k2: NaN, puntos: [], longitud: 10 };
      cambiar(s, (ln) => ln.elementos.push(el), true);
      return;
    }
    const li = t.closest('.lin-elem');
    if (li && t.tagName === 'SELECT') {
      const i = +li.dataset.i, campo = t.dataset.campo;
      cambiar(s, (ln) => {
        const el = ln.elementos[i];
        el[campo] = t.value;
        if (campo === 'forma') { el.k1 = NaN; el.k2 = NaN; el.puntos = []; }
      }, true);
    }
  });

  panel.addEventListener('input', (ev) => {
    const t = ev.target;
    const li = t.closest('.lin-elem');
    if (!li || t.tagName === 'SELECT') return;
    const s = li.dataset.lado, i = +li.dataset.i, campo = t.dataset.campo;
    const el = linea(s).elementos[i];
    if (campo === 'nombre') { el.nombre = t.value.slice(0, 60); h.recalcular(); pintarFuentes(); return; }
    if (campo === 'puntos') {
      el.puntos = t.value.split(/\n/).map((r) => r.split(/[;\t]/).map((x) => leer(x))).filter((p) => p.length >= 2 && p.every(Number.isFinite)).map((p) => [p[0], p[1]]);
      cambiar(s, () => {});
      return;
    }
    const v = t.value.trim() === '' ? null : leer(t.value);
    const malo = v != null && !(Number.isFinite(v) && v >= 0);
    t.classList.toggle('invalido', malo);
    if (malo) return;
    cambiar(s, () => {
      if (campo === 'valor') el.valor = v;
      else if (campo === 'n') el.n = Math.round(v ?? 0);
      else if (campo === 'k1' || campo === 'k2') el[campo] = v ?? NaN;
      else el[campo] = v ?? 0;
    });
  });

  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-acc]');
    if (!b) return;
    const cont = b.closest('.lin-lado');
    const s = cont.dataset.lado;
    if (b.dataset.acc === 'quitar') {
      const i = +b.closest('.lin-elem').dataset.i;
      cambiar(s, (ln) => ln.elementos.splice(i, 1), true);
    } else if (b.dataset.acc === 'config') {
      cambiar(s, (ln) => { ln.elementos = L.configuracion(b.dataset.conf, h.fMHz()); }, true);
    } else if (b.dataset.acc === 'copiar') {
      const otro = s === 'a' ? 'b' : 'a';
      const copia = JSON.parse(JSON.stringify(linea(s)));
      lado(otro).linea = L.normalizarLinea(copia);
      h.recalcular();
      pintar();
    }
  });

  return {
    pintar,
    // Tras cada recálculo (frecuencia, datos…): valores, avisos y orientación
    alRecalcular() { actualizarSalidas(); pintarOrientacion(); },
    resultado: (s) => ultimo[s],
  };
}
