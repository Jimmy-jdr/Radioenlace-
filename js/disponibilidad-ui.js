/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// disponibilidad-ui.js — Tarjeta «Disponibilidad (UIT-R P.530-19)» (versión 1.5)
// Carga a demanda los mapas de la UIT (datos/uit-espana.json), muestra los
// datos climáticos del punto medio (editables) y los resultados. El cálculo
// lo hace disponibilidad.js; app.js le pasa el contexto en cada recálculo.
// =====================================================================

import { cargarDatosUIT } from './datos-uit.js';
import { DISP_PARAMETROS } from './disponibilidad.js';

export function iniciarDisponibilidad(h) {
  const { f, esc, contar } = h;
  const $ = (s) => document.querySelector(s);
  const caja = $('#disp');
  let datos = null, cargando = false, error = '', contado = false;

  const cargar = () => {
    if (datos || cargando) return;
    cargando = true;
    pintarEstado();
    cargarDatosUIT().then((d) => { datos = d; error = ''; })
      .catch((e) => { error = e.message; })
      .finally(() => { cargando = false; h.recalcular(); });
  };

  const pintarEstado = () => {
    const n = $('#disp-estado');
    if (!n) return;
    n.textContent = cargando ? 'Cargando los mapas climáticos de la UIT…' : error;
    n.hidden = !cargando && !error;
  };

  // Campos de datos climáticos propios (vacío = valor del mapa)
  const filasClima = () => DISP_PARAMETROS.map((p) => `
    <tr data-k="${p.k}"><th scope="row">${p.nombre}<small>${p.fuente}</small></th>
      <td class="num"><span class="disp-mapa">—</span>${p.unidad ? ` ${p.unidad}` : ''}</td>
      <td><input type="text" inputmode="decimal" enterkeyhint="done" aria-label="${esc(p.nombre.replace(/<[^>]+>/g, ''))}: valor propio${p.unidad ? ` (${p.unidad})` : ''}" placeholder="del mapa"></td></tr>`).join('');
  $('#disp-clima').innerHTML = filasClima();

  caja.addEventListener('toggle', () => { if (caja.open) { cargar(); h.recalcular(); } });
  $('#disp-pol').addEventListener('change', (ev) => { h.estado().itm.pol = ev.target.value; h.escribirFormulario?.(); h.recalcular(); });
  $('#disp-nieve').addEventListener('change', (ev) => { h.estado().disp.nieve = ev.target.checked; h.recalcular(); });
  $('#disp-gases').addEventListener('change', (ev) => {
    h.estado().gases = ev.target.checked;
    if (ev.target.checked) { cargar(); contar('gases-incluidos', 'Atenuación por gases incluida en el presupuesto'); }
    h.recalcular();
  });
  $('#disp-clima').addEventListener('change', (ev) => {
    const tr = ev.target.closest('tr[data-k]');
    if (!tr) return;
    const v = h.leerNumero(ev.target.value);
    const p = h.estado().disp.propios;
    if (ev.target.value.trim() === '' || !Number.isFinite(v)) { delete p[tr.dataset.k]; ev.target.value = ''; }
    else p[tr.dataset.k] = v;
    h.recalcular();
  });
  $('#disp-restablecer').addEventListener('click', () => { h.estado().disp.propios = {}; h.recalcular(); });

  // Pinta la tarjeta con el resultado de disponibilidad.js (o el motivo por el que no lo hay)
  function pintar(r) {
    const s = h.estado();
    $('#disp-pol').value = s.itm.pol;
    $('#disp-nieve').checked = s.disp.nieve;
    $('#disp-gases').checked = !!s.gases;
    for (const tr of document.querySelectorAll('#disp-clima tr[data-k]')) {
      const k = tr.dataset.k, inp = tr.querySelector('input');
      const v = s.disp.propios[k];
      if (document.activeElement !== inp) inp.value = v == null ? '' : String(v).replace('.', ',');
      const c = r?.clima?.[k];
      const p = DISP_PARAMETROS.find((x) => x.k === k);
      tr.querySelector('.disp-mapa').textContent = c?.mapa == null ? '—' : p.formato(c.mapa, f);
      tr.classList.toggle('propio', v != null);
    }
    pintarEstado();
    const res = $('#disp-res');
    if (!r || r.pendiente) { res.innerHTML = `<p class="nota">${esc(r?.pendiente || 'Esperando el perfil del terreno.')}</p>`; return; }
    if (r.error) { res.innerHTML = `<p class="aviso-texto">${esc(r.error)}</p>`; return; }
    // Disponibilidad con los decimales necesarios para que no se redondee a 100 %
    const pctDisp = (u) => { const dec = u > 0 ? Math.min(8, Math.max(3, Math.ceil(-Math.log10(u)) + 1)) : 3; return `${f(100 - u, dec)} %`; };
    const sci = (x) => (x === 0 ? '0' : x < 1e-3 ? x.toExponential(2).replace('.', ',').replace('e-', '·10⁻').replace(/⁻(\d+)/, (m, e) => '⁻' + [...e].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')) : f(x, 4));
    const mp = r.mp, ll = r.ll;
    const minutos = (m) => (m < 1 ? `${f(m * 60, 0)} s` : m < 120 ? `${f(m, 1)} min` : `${f(m / 60, 1)} h`);
    res.innerHTML = `
      <dl class="cifras">
        <div><dt>Margen frente a desvanecimientos (F)</dt><dd>${f(r.F, 1)} dB</dd></div>
        <div><dt>Multitrayecto: p<sub>w</sub> del peor mes</dt><dd>${mp.aplica ? `${sci(mp.pwMes)} %` : '— (d ≤ 5 km)'}</dd></div>
        <div><dt>Multitrayecto: p del año</dt><dd>${mp.aplica ? `${sci(mp.pAnual)} %` : '0 %'}</dd></div>
        <div><dt>Lluvia: A<sub>0,01</sub></dt><dd>${f(ll.A001total, 1)} dB</dd></div>
        <div><dt>Lluvia: p del año</dt><dd>${ll.fuera === 'bajo' ? '&lt; 0,001 %' : ll.fuera === 'alto' ? `${sci(ll.p)} % (&gt; 1 %)` : `${sci(ll.p)} %`}</dd></div>
        <div class="grande"><dt>Indisponibilidad (año)</dt><dd>${sci(r.indisp)} %</dd></div>
        <div><dt>Tiempo fuera de servicio</dt><dd>${minutos(r.minAno)} al año</dd></div>
        <div class="grande"><dt>Disponibilidad</dt><dd>${pctDisp(r.indisp)}</dd></div>
      </dl>
      ${r.avisos.length ? `<p class="aviso-texto">⚠ ${r.avisos.map(esc).join('<br>⚠ ')}</p>` : ''}
      ${!s.gases && r.fGHz > 10 ? '<p class="aviso-texto">⚠ Por encima de unos 10 GHz la P.530 (§ 2.1) pide incluir la atenuación por gases: marca «Sumar la atenuación por gases».</p>' : ''}
      <p class="nota">Multitrayecto: corte de ${minutos((mp.pwMes / 100) * (365.25 / 12) * 24 * 60)} en el peor mes (P<sub>ns</sub>, ec. 28), que la P.530 asigna sobre todo a la calidad. Lluvia: ${minutos(r.minAnoLluvia)} al año (P<sub>rain</sub>, ec. 100), que se asigna sobre todo a la disponibilidad. ${ll.caso === 3 ? 'Se ha aplicado el método combinado de lluvia y nieve húmeda (§ 2.4.2): la capa de fusión puede cruzar el trayecto.' : ll.caso === 2 ? 'Las dos antenas quedan siempre por encima de la capa de fusión: la precipitación no atenúa (§ 2.4.2, caso 2).' : 'La capa de fusión queda siempre por encima del trayecto: solo lluvia (§ 2.4.1).'}</p>`;
    if (!contado) { contado = true; contar('disponibilidad-calculada', 'Disponibilidad calculada (P.530)'); }
  }

  return {
    abierta: () => caja.open,
    datos: () => datos,
    necesitaDatos: () => { if (!datos) cargar(); },
    pintar,
  };
}
