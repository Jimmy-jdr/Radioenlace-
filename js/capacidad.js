/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// capacidad.js — Capacidad según la modulación (versión 1.5)
// Velocidad binaria bruta de un canal de separación CS con M estados:
//     Rb = CS/(1 + α) · log2 M · r          (Mbit/s, con CS en MHz)
// (velocidad de símbolos CS/(1+α) por el filtro de coseno alzado; r = tasa
// del código corrector). Umbrales y RIC mínima: ETSI EN 302 217-2 (etsi.js).
// Modulación adaptativa: disponibilidad de cada modulación con la P.530
// (disponibilidad.js); la capacidad garantizada es la de la modulación más alta
// que cumple el objetivo y la media anual pondera cada modulación por el tiempo
// en que es la más alta que funciona. Sin DOM.
// =====================================================================

import { CLASES, valoresETSI, ricPorDensidad, bandaETSI } from './etsi.js';

export const CAP_DEFECTO = { cs: 28, alfa: 0.25, r: 0.9, objetivo: 99.99, sel: CLASES.filter((c) => c.clase).map((c) => c.clase), umbrales: {} };

export const claveDe = (c) => c.clase ?? String(c.M);   // '4096' para 4096QAM (sin clase ETSI)

export function normalizarCapacidad(o) {
  const s = o && typeof o === 'object' ? o : {};
  const num = (v, def, min, max) => { const x = Number(v); return Number.isFinite(x) && x >= min && x <= max ? x : def; };
  const claves = CLASES.map(claveDe);
  const umbrales = {};
  for (const [k, v] of Object.entries(s.umbrales || {})) if (claves.includes(k) && Number.isFinite(Number(v)) && v !== '' && v != null) umbrales[k] = Number(v);
  return {
    cs: num(s.cs, CAP_DEFECTO.cs, 0.025, 5000),
    alfa: num(s.alfa, CAP_DEFECTO.alfa, 0, 1),
    r: num(s.r, CAP_DEFECTO.r, 0.1, 1),
    objetivo: num(s.objetivo, CAP_DEFECTO.objetivo, 90, 99.99999),
    sel: Array.isArray(s.sel) ? s.sel.filter((k) => claves.includes(k)) : [...CAP_DEFECTO.sel],
    umbrales,
  };
}

// Rb = CS/(1+α)·log2 M·r
export const velocidadBinaria = (cs, M, alfa, r) => (cs / (1 + alfa)) * Math.log2(M) * r;

/**
 * Tabla de modulaciones.
 * @param o.fGHz, o.cap (opciones normalizadas)
 * @param o.F        margen con la sensibilidad del presupuesto (dB) o null
 * @param o.sens     sensibilidad del presupuesto (dBm)
 * @param o.dispCon  función F → resultado de calcularDisponibilidad (o null si no se puede)
 */
export function calcularCapacidad({ fGHz, cap, F = null, sens = null, dispCon = null }) {
  const banda = bandaETSI(fGHz);
  const filas = CLASES.map((c) => {
    const k = claveDe(c);
    const etsi = c.clase ? valoresETSI(fGHz, c.clase, cap.cs) : null;
    const propio = cap.umbrales[k];
    const umbral = propio ?? etsi?.rsl ?? null;
    const Rb = velocidadBinaria(cap.cs, c.M, cap.alfa, cap.r);
    const ricMin = etsi?.ric ?? (c.clase ? ricPorDensidad(c.clase, cap.cs) : null);
    const fila = { clave: k, ...c, sel: cap.sel.includes(k), Rb, etsi, ricMin, umbral, umbralPropio: propio != null, cumpleRIC: ricMin == null ? null : Rb >= ricMin - 1e-9 };
    if (umbral != null && F != null && sens != null) {
      fila.margen = F + sens - umbral;
      const d = dispCon ? dispCon(fila.margen) : null;
      if (d && !d.error) { fila.indisp = d.indisp; fila.disp = d.disp; fila.minAno = d.minAno; }
    }
    return fila;
  });
  const usadas = filas.filter((x) => x.sel && x.umbral != null).sort((a, b) => a.M - b.M);
  const res = { filas, usadas, banda, cs: cap.cs, alfa: cap.alfa, r: cap.r, objetivo: cap.objetivo };
  if (usadas.length && usadas.every((x) => x.disp != null)) {
    // Garantizada: la modulación más alta cuya disponibilidad alcanza el objetivo
    const ok = usadas.filter((x) => x.disp >= cap.objetivo - 1e-12);
    res.garantizada = ok.length ? ok[ok.length - 1] : null;
    // Media anual: cada modulación funciona mientras su margen no se supera; la más alta
    // que funciona es la que se usa. U crece con el orden (umbral más alto, margen menor).
    let media = 0;
    for (let i = 0; i < usadas.length; i++) {
      const U = usadas[i].indisp / 100, Usig = i + 1 < usadas.length ? usadas[i + 1].indisp / 100 : 1;
      media += usadas[i].Rb * Math.max(0, Usig - U);
    }
    res.media = media;
    res.fueraServicio = usadas[0].indisp;    // ni la modulación más robusta funciona
  }
  return res;
}

// ---------- Cálculos paso a paso ----------
export function pasosCapacidad(r, f) {
  if (!r?.filas) return [];
  const G = 'Capacidad (ETSI EN 302 217-2)';
  const top = r.garantizada || r.usadas[r.usadas.length - 1] || r.filas.find((x) => x.sel) || r.filas[6];
  const pasos = [{
    grupo: G, id: 'cap-rb', titulo: `Velocidad binaria con ${top.nombre}`,
    corta: 'R<sub>b</sub> = CS/(1 + α)·log<sub>2</sub>M·r',
    formula: 'R<sub>b</sub> = CS/(1 + α) · log<sub>2</sub>M · r  (velocidad de símbolos por bits por símbolo por tasa del código)',
    sustitucion: `R<sub>b</sub> = ${f(r.cs, 2)}/(1 + ${f(r.alfa, 2)}) · log<sub>2</sub>${top.M} · ${f(r.r, 3)}`,
    resultado: `R<sub>b</sub> = ${f(top.Rb, 1)} Mbit/s`,
    nota: `${top.ricMin != null ? `RIC mínima de la norma para la clase ${top.clase} y ${f(r.cs, 2)} MHz: ${f(top.ricMin, 0)} Mbit/s${top.etsi?.derivado ? ` (derivada de ${f(top.etsi.csRef, 2)} MHz, nota del § 4.1.6)` : ''}. ` : ''}α es el factor de caída del filtro y r la tasa del código corrector: 0,25 y 0,9 son valores típicos (comprobados con fichas comerciales); cada fabricante da los suyos.`,
  }];
  if (top.margen != null) pasos.push({
    grupo: G, id: 'cap-margen', titulo: `Margen con el umbral de ${top.nombre}`,
    corta: 'F<sub>M</sub> = F + S<sub>rx</sub> − U<sub>M</sub>',
    formula: 'F<sub>M</sub> = F + S<sub>rx</sub> − U<sub>M</sub> (el margen se mide ahora frente al umbral de esa modulación)',
    sustitucion: `F<sub>M</sub> = ${f(top.margen + top.umbral, 2)} − (${f(top.umbral, 1)})`,
    resultado: `F<sub>M</sub> = ${f(top.margen, 2)} dB`,
    nota: `Umbral para BER ≤ 10⁻⁶: ${top.umbralPropio ? 'valor propio' : `${top.etsi ? `cuadro ${top.etsi.tabla} de la norma (límite que el equipo debe garantizar)` : '—'}`}.`,
  });
  if (r.media != null) pasos.push({
    grupo: G, id: 'cap-adaptativa', titulo: 'Modulación adaptativa: capacidad garantizada y media',
    corta: 'C<sub>media</sub> = Σ R<sub>b,i</sub>·(U<sub>i+1</sub> − U<sub>i</sub>)',
    formula: 'Garantizada: la modulación más alta con disponibilidad ≥ objetivo. Media: C = Σ R<sub>b,i</sub>·(U<sub>i+1</sub> − U<sub>i</sub>), con U la indisponibilidad de cada modulación (U<sub>N+1</sub> = 1)',
    sustitucion: r.usadas.map((x) => `${x.nombre}: ${f(x.Rb, 0)} Mbit/s, U = ${f(x.indisp, 5)} %`).join('; '),
    resultado: `${r.garantizada ? `${f(r.garantizada.Rb, 0)} Mbit/s al ${f(r.objetivo, 3)} %` : `ninguna llega al ${f(r.objetivo, 3)} %`}; media ${f(r.media, 0)} Mbit/s`,
    nota: 'Supone que el equipo cambia de modulación al instante y que cada modulación se corta cuando el desvanecimiento supera su margen (P.530 para cada una).',
  });
  return pasos;
}

export function filasCapacidad(r) {
  if (!r?.filas) return [];
  const A = 'Capacidad (ETSI EN 302 217-2)';
  const out = [[A, 'Separación de canal (CS)', '', '', r.cs, 'MHz'], [A, 'Factor de caída (α)', '', '', r.alfa, ''], [A, 'Tasa del código (r)', '', '', r.r, ''],
    [A, 'Banda de la norma', '', '', r.banda ? `Anexo ${r.banda.anexo}, ${r.banda.banda} GHz` : 'Fuera de las bandas incluidas', '', false]];
  for (const x of r.filas) {
    if (!x.sel) continue;
    out.push([A, `${x.nombre}: velocidad binaria`, 'Rb = CS/(1+α)·log2M·r', '', x.Rb, 'Mbit/s']);
    if (x.ricMin != null) out.push([A, `${x.nombre}: RIC mínima (clase ${x.clase})`, x.etsi?.derivado ? 'derivada (§ 4.1.6)' : x.etsi ? `cuadro ${x.etsi.tabla}` : 'cuadro 1', '', x.ricMin, 'Mbit/s']);
    if (x.umbral != null) out.push([A, `${x.nombre}: umbral (BER ≤ 10⁻⁶)`, x.umbralPropio ? 'valor propio' : `cuadro ${x.etsi?.tabla}`, '', x.umbral, 'dBm']);
    if (x.margen != null) out.push([A, `${x.nombre}: margen`, 'F + Srx − U', '', x.margen, 'dB']);
    if (x.disp != null) out.push([A, `${x.nombre}: disponibilidad`, 'P.530-19', '', x.disp, '%']);
  }
  if (r.media != null) {
    out.push([A, `Capacidad garantizada al ${r.objetivo} %`, '', '', r.garantizada ? r.garantizada.Rb : 0, 'Mbit/s']);
    out.push([A, 'Capacidad media del año', 'Σ Rb,i·(Ui+1 − Ui)', '', r.media, 'Mbit/s']);
  }
  return out;
}
