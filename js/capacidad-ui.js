/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// capacidad-ui.js — Tarjeta «Capacidad según la modulación» (versión 1.5)
// El cálculo lo hace capacidad.js; app.js le pasa el resultado en cada recálculo.
// =====================================================================

import { CLASES, CS_HABITUALES, NORMA } from './etsi.js';
import { claveDe } from './capacidad.js';

export function iniciarCapacidad(h) {
  const { f, esc, contar } = h;
  const $ = (s) => document.querySelector(s);
  const caja = $('#cap');
  let contado = false;

  $('#cap-cs').innerHTML = CS_HABITUALES.map((c) => `<option value="${c}">${String(c).replace('.', ',')}</option>`).join('');
  $('#cap-filas').innerHTML = CLASES.map((c) => {
    const k = claveDe(c);
    return `<tr data-k="${k}">
      <td><input type="checkbox" class="cap-sel" aria-label="Usar ${c.nombre}"></td>
      <th scope="row">${c.nombre}<small>${c.clase ? `clase ${c.clase}` : 'sin clase en la norma'}</small></th>
      <td class="num cap-rb"></td><td class="num cap-ric"></td>
      <td><input type="text" inputmode="decimal" enterkeyhint="done" class="cap-umbral" aria-label="Umbral de ${c.nombre} (dBm)"></td>
      <td class="num cap-margen"></td><td class="num cap-disp"></td>
      <td><button type="button" class="boton secundario cap-usar" title="Poner este umbral como sensibilidad del receptor">Usar</button></td></tr>`;
  }).join('');

  const campo = (sel, clave, min, max) => $(sel).addEventListener('change', (ev) => {
    const v = h.leerNumero(ev.target.value);
    if (Number.isFinite(v) && v >= min && v <= max) h.estado().cap[clave] = v;
    h.recalcular();
  });
  campo('#cap-alfa', 'alfa', 0, 1);
  campo('#cap-r', 'r', 0.1, 1);
  campo('#cap-objetivo', 'objetivo', 90, 99.99999);
  $('#cap-cs').addEventListener('change', (ev) => { h.estado().cap.cs = Number(ev.target.value); h.recalcular(); });
  caja.addEventListener('toggle', () => { if (caja.open) { h.necesitaDatos(); h.recalcular(); } });
  $('#cap-filas').addEventListener('change', (ev) => {
    const tr = ev.target.closest('tr[data-k]');
    if (!tr) return;
    const c = h.estado().cap, k = tr.dataset.k;
    if (ev.target.classList.contains('cap-sel')) {
      c.sel = ev.target.checked ? [...new Set([...c.sel, k])] : c.sel.filter((x) => x !== k);
    } else if (ev.target.classList.contains('cap-umbral')) {
      const v = h.leerNumero(ev.target.value);
      if (ev.target.value.trim() === '' || !Number.isFinite(v) || v < -160 || v > 0) delete c.umbrales[k];
      else c.umbrales[k] = v;
    }
    h.recalcular();
  });
  let ultimo = null;
  $('#cap-filas').addEventListener('click', (ev) => {
    const b = ev.target.closest('.cap-usar');
    if (!b) return;
    const fila = ultimo?.filas.find((x) => x.clave === b.closest('tr').dataset.k);
    if (fila?.umbral == null) return;
    h.estado().sens = fila.umbral;
    h.escribirFormulario();
    h.recalcular();
    contar('sensibilidad-etsi-aplicada', 'Sensibilidad de una modulación aplicada');
    h.toast(`Sensibilidad del receptor: ${f(fila.umbral, 1)} dBm (${fila.nombre}).`);
  });

  function pintar(r) {
    ultimo = r;
    const c = h.estado().cap;
    $('#cap-cs').value = String(c.cs);
    if ($('#cap-cs').value !== String(c.cs)) {   // CS guardado que no está en la lista
      $('#cap-cs').insertAdjacentHTML('beforeend', `<option value="${c.cs}">${String(c.cs).replace('.', ',')}</option>`);
      $('#cap-cs').value = String(c.cs);
    }
    for (const [sel, v] of [['#cap-alfa', c.alfa], ['#cap-r', c.r], ['#cap-objetivo', c.objetivo]]) if (document.activeElement !== $(sel)) $(sel).value = String(v).replace('.', ',');
    if (!r) return;
    $('#cap-banda').innerHTML = r.banda
      ? `Banda de la norma: <b>${r.banda.banda} GHz</b> (anexo ${r.banda.anexo} de la ${NORMA}).`
      : `La frecuencia del enlace no está en las bandas de los anexos C a F de la ${NORMA} (3,4–43,5 GHz): escribe los umbrales de la ficha de tu equipo. La RIC mínima sale de la densidad del cuadro 1.`;
    for (const x of r.filas) {
      const tr = document.querySelector(`#cap-filas tr[data-k="${x.clave}"]`);
      tr.querySelector('.cap-sel').checked = x.sel;
      tr.classList.toggle('apagada', !x.sel);
      tr.querySelector('.cap-rb').textContent = f(x.Rb, 1);
      tr.querySelector('.cap-ric').innerHTML = x.ricMin == null ? '—' : `${f(x.ricMin, 0)}${x.etsi?.derivado ? '<sup title="Derivada del canal más próximo (nota del § 4.1.6)">*</sup>' : ''}${x.cumpleRIC === false ? ' <span class="aviso-texto" title="Rb no llega a la RIC mínima">⚠</span>' : ''}`;
      const inp = tr.querySelector('.cap-umbral');
      if (document.activeElement !== inp) inp.value = x.umbralPropio ? String(x.umbral).replace('.', ',') : '';
      inp.placeholder = x.etsi ? `${f(x.etsi.rsl, 1)}${x.etsi.derivado ? '*' : ''}` : '—';
      tr.querySelector('.cap-margen').textContent = x.margen == null ? '—' : `${f(x.margen, 1)} dB`;
      tr.querySelector('.cap-disp').textContent = x.disp == null ? '—' : x.margen <= 0 ? 'sin margen' : `${f(x.disp, x.disp > 99.999 ? 5 : 4)} %`;
      tr.querySelector('.cap-usar').disabled = x.umbral == null;
    }
    const res = $('#cap-resumen');
    if (r.pendiente) { res.innerHTML = `<p class="nota">${esc(r.pendiente)}</p>`; return; }
    if (r.media == null) {
      res.innerHTML = r.usadas.length ? '<p class="nota">La disponibilidad de cada modulación aparece cuando el perfil del terreno está listo y el punto medio está en la zona de los mapas (o hay datos climáticos propios en «Disponibilidad del enlace»).</p>'
        : '<p class="aviso-texto">⚠ Marca al menos una modulación con umbral.</p>';
      return;
    }
    const g = r.garantizada;
    const obj = String(r.objetivo).replace('.', ',');
    res.innerHTML = `<dl class="cifras">
      <div class="grande"><dt>Capacidad garantizada al ${obj} %</dt><dd>${g ? `${f(g.Rb, 0)} Mbit/s · ${g.nombre}` : '0 Mbit/s'}</dd></div>
      <div class="grande"><dt>Capacidad media del año</dt><dd>${f(r.media, 0)} Mbit/s</dd></div>
      <div><dt>Modulaciones usadas</dt><dd>${r.usadas.length === 1 ? `${r.usadas[0].nombre} (fija)` : `${r.usadas.length} (adaptativa)`}</dd></div>
    </dl>
    ${g ? '' : `<p class="aviso-texto">⚠ Ninguna modulación marcada alcanza el ${obj} % de disponibilidad: hace falta más margen (antenas, potencia o un canal más estrecho).</p>`}`;
    if (!contado) { contado = true; contar('capacidad-calculada', 'Capacidad según la modulación calculada'); }
  }

  return { abierta: () => caja.open, pintar };
}
