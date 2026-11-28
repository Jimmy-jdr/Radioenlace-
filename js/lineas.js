/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// lineas.js — Pérdidas de la línea de transmisión y de los accesorios de
// cada lado del enlace (versión 1.5). Sin DOM: se usa en la página y en
// las pruebas de Node.
//
// · Coaxiales: fórmula del fabricante α = k1·√f + k2·f (Times, dB/100 ft,
//   f en MHz) o tabla publicada con interpolación log–log entre sus puntos.
// · Guía rectangular WR: atenuación del modo TE10 por las pérdidas en las
//   paredes (Pozar, ec. 3.96), con avisos de corte y de banda.
// · Guía elíptica: tabla del fabricante, interpolación lineal en frecuencia.
// · Accesorios: valor de catálogo (editable) por unidad.
// Solo se interpola o extrapola dentro de la banda de uso de cada ficha:
// fuera de ella el tramo no se puede calcular (no se inventan datos).
// =====================================================================
import { COAXIALES, ELIPTICAS, RECTANGULARES, MATERIALES, ACCESORIOS, F758 } from './catalogo-lineas.js';

export const PIE = 0.3048;                       // m (exacto)
export const C0 = 299792458;                     // m/s
export const MU0 = 4e-7 * Math.PI;               // H/m (diferencia con el valor CODATA 2018 < 2·10⁻¹⁰)
export const ETA0 = MU0 * C0;                    // Ω (376,73)
export const NP_DB = 20 / Math.LN10;             // 1 Np = 8,686 dB

export const coaxial = (id) => COAXIALES.find((c) => c.id === id);
export const eliptica = (id) => ELIPTICAS.find((g) => g.id === id);
export const rectangular = (id) => RECTANGULARES.find((g) => g.id === id);
export const material = (id) => MATERIALES.find((m) => m.id === id) || MATERIALES[0];
export const accesorio = (id) => ACCESORIOS.find((a) => a.id === id);

// Interpolación por tramos entre puntos ordenados [x, y]; log–log o lineal.
// Fuera del rango de los puntos se prolonga el tramo extremo (el que llama
// comprueba antes que la frecuencia está dentro de la banda de uso).
export function interpola(puntos, x, loglog = true) {
  const n = puntos.length;
  let i = 1;
  while (i < n - 1 && x > puntos[i][0]) i++;
  const [x0, y0] = puntos[i - 1], [x1, y1] = puntos[i];
  if (x === x0) return y0;
  if (x === x1) return y1;
  if (loglog) {
    const t = Math.log(x / x0) / Math.log(x1 / x0);
    return Math.exp(Math.log(y0) + t * Math.log(y1 / y0));
  }
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

const fmtGHz = (fMHz) => `${String(+(fMHz / 1000).toFixed(3)).replace('.', ',')} GHz`;
const fmtMHz = (fMHz) => (fMHz >= 1000 ? fmtGHz(fMHz) : `${String(+fMHz.toFixed(1)).replace('.', ',')} MHz`);

// ---------------------------------------------------------------------
// Coaxiales: atenuación en dB/100 m a f (MHz)
// ---------------------------------------------------------------------
export function atenuacionCoaxial(c, fMHz) {
  const r = { dB100m: null, avisos: [], error: '' };
  if (!c) { r.error = 'Modelo de cable desconocido'; return r; }
  const [f0, f1] = c.banda;
  if (fMHz > f1 + 1e-9) { r.error = `${c.modelo}: por encima de su frecuencia máxima de uso (${fmtMHz(f1)}); no es adecuado a ${fmtMHz(fMHz)}`; return r; }
  if (fMHz < f0 - 1e-9) { r.error = `${c.modelo}: la ficha no da datos por debajo de ${fmtMHz(f0)}`; return r; }
  if (c.metodo === 'k') {
    r.dB100m = (c.k1 * Math.sqrt(fMHz) + c.k2 * fMHz) / PIE;   // dB/100 ft → dB/100 m
    return r;
  }
  const pts = c.metodo === 'tabla-ft' ? c.puntos.map(([f, a]) => [f, a / PIE]) : c.puntos.map(([f, a]) => [f, a]);
  r.dB100m = interpola(pts, fMHz, true);
  const ultimo = pts[pts.length - 1][0];
  if (fMHz > ultimo) r.avisos.push(`${c.modelo}: la tabla llega a ${fmtMHz(ultimo)}; se prolonga en escala log–log hasta el límite de la banda (${fmtMHz(f1)})`);
  return r;
}

// ---------------------------------------------------------------------
// Guía elíptica: atenuación en dB/100 m a f (GHz)
// ---------------------------------------------------------------------
export function atenuacionEliptica(g, fGHz) {
  const r = { dB100m: null, avisos: [], error: '' };
  if (!g) { r.error = 'Modelo de guía desconocido'; return r; }
  if (fGHz <= g.corte) { r.error = `${g.modelo}: por debajo del corte del modo eTE11 (${String(g.corte).replace('.', ',')} GHz), la guía no propaga`; return r; }
  if (fGHz < g.banda[0] - 1e-9 || fGHz > g.banda[1] + 1e-9) {
    r.error = `${g.modelo}: fuera de su banda de uso (${String(g.banda[0]).replace('.', ',')}–${String(g.banda[1]).replace('.', ',')} GHz)`;
    return r;
  }
  r.dB100m = interpola(g.puntos.map(([f, a]) => [f, a]), fGHz, false);
  const p0 = g.puntos[0][0], p1 = g.puntos[g.puntos.length - 1][0];
  if (fGHz < p0 || fGHz > p1) r.avisos.push(`${g.modelo}: la tabla va de ${String(p0).replace('.', ',')} a ${String(p1).replace('.', ',')} GHz; se prolonga linealmente dentro de la banda de uso`);
  return r;
}

// ---------------------------------------------------------------------
// Guía rectangular, modo TE10: atenuación por conductor (dB/m)
//   αc = Rs·(2bπ² + a³k²) / (a³·b·β·k·η)   [Np/m]   (Pozar, ec. 3.96)
//   Rs = √(ωμ0/2σ),  k = ω/c,  β = √(k² − (π/a)²)
// ---------------------------------------------------------------------
export function te10(aM, bM, fHz, sigma) {
  const fc = C0 / (2 * aM);
  const k = (2 * Math.PI * fHz) / C0;
  const beta = Math.sqrt(k * k - (Math.PI / aM) ** 2);
  const Rs = Math.sqrt((Math.PI * fHz * MU0) / sigma);
  const alfa = (Rs * (2 * bM * Math.PI ** 2 + aM ** 3 * k * k)) / (aM ** 3 * bM * beta * k * ETA0);
  return { fc, Rs, beta, alfaNp: alfa, dBm: alfa * NP_DB };
}

export function atenuacionRectangular(g, idMaterial, fGHz, sigmaPropia) {
  const r = { dB100m: null, avisos: [], error: '', fc: null };
  if (!g) { r.error = 'Guía desconocida'; return r; }
  const a = g.a * 0.0254, b = g.b * 0.0254, f = fGHz * 1e9;
  const fc = C0 / (2 * a);
  const fTE20 = C0 / a, fTE01 = C0 / (2 * b), fSup = Math.min(fTE20, fTE01);
  r.fc = fc / 1e9;
  const g3 = (x) => String(+(x / 1e9).toFixed(3)).replace('.', ',');
  if (f <= fc) { r.error = `${g.id}: por debajo de la frecuencia de corte del TE10 (${g3(fc)} GHz), la guía no propaga`; return r; }
  if (f >= fSup) { r.error = `${g.id}: por encima del corte del siguiente modo (${fTE20 <= fTE01 ? 'TE20' : 'TE01'}, ${g3(fSup)} GHz); la guía deja de ser monomodo`; return r; }
  const sigma = sigmaPropia > 0 ? sigmaPropia : material(idMaterial).sigma;
  r.dB100m = te10(a, b, f, sigma).dBm * 100;
  if (fGHz < g.banda[0] || fGHz > g.banda[1]) {
    r.avisos.push(`${g.id}: fuera de su banda recomendada (${String(g.banda[0]).replace('.', ',')}–${String(g.banda[1]).replace('.', ',')} GHz)${fGHz < g.banda[0] ? ': cerca del corte la atenuación crece mucho' : ''}`);
  }
  return r;
}

// ---------------------------------------------------------------------
// Elementos de una línea
//   { tipo: 'coaxial', modelo, longitud }
//   { tipo: 'eliptica', modelo, longitud }
//   { tipo: 'rectangular', modelo, material, longitud }
//   { tipo: 'propia', nombre, forma: 'k'|'puntos', k1, k2, puntos: [[fMHz, dB/100 m], …], longitud }
//   { tipo: 'accesorio', id, n, valor }   (valor null = el del catálogo)
// ---------------------------------------------------------------------
export function perdidaElemento(el, fMHz) {
  const r = { dB: null, dB100m: null, avisos: [], error: '' };
  const L = +el.longitud;
  const tramo = (x) => {
    Object.assign(r, x);
    if (x.error) return r;
    if (!(L >= 0)) { r.error = 'Longitud no válida'; return r; }
    r.dB = (x.dB100m * L) / 100;
    return r;
  };
  switch (el.tipo) {
    case 'coaxial': return tramo(atenuacionCoaxial(coaxial(el.modelo), fMHz));
    case 'eliptica': return tramo(atenuacionEliptica(eliptica(el.modelo), fMHz / 1000));
    case 'rectangular': return tramo(atenuacionRectangular(rectangular(el.modelo), el.material, fMHz / 1000));
    case 'propia': {
      if (el.forma === 'k') {
        if (!(Number.isFinite(+el.k1) && Number.isFinite(+el.k2))) { r.error = 'Faltan k1 y k2'; return r; }
        return tramo({ dB100m: +el.k1 * Math.sqrt(fMHz) + +el.k2 * fMHz, avisos: [], error: '' });
      }
      const pts = (el.puntos || []).filter((p) => p[0] > 0 && p[1] > 0).sort((x, y) => x[0] - y[0]);
      if (pts.length < 2) { r.error = 'Hacen falta al menos dos puntos (frecuencia y atenuación)'; return r; }
      if (fMHz < pts[0][0] || fMHz > pts[pts.length - 1][0]) { r.error = `Fuera del rango de los datos (${fmtMHz(pts[0][0])} a ${fmtMHz(pts[pts.length - 1][0])})`; return r; }
      return tramo({ dB100m: interpola(pts, fMHz, true), avisos: [], error: '' });
    }
    case 'accesorio': {
      const a = accesorio(el.id);
      if (!a) { r.error = 'Accesorio desconocido'; return r; }
      const n = Math.max(0, Math.round(+el.n || 0));
      const propio = el.valor != null && el.valor !== '' && Number.isFinite(+el.valor);
      const unidad = propio ? +el.valor : a.coef != null ? a.coef * Math.sqrt(fMHz / 1000) : a.valor;
      r.unidad = unidad;
      r.dB = n * unidad;
      if (a.fmax && fMHz / 1000 > a.fmax) r.avisos.push(`${a.nombre}: la ficha de referencia llega a ${String(a.fmax).replace('.', ',')} GHz`);
      return r;
    }
    default: r.error = 'Elemento desconocido'; return r;
  }
}

export function perdidasLinea(linea, fMHz) {
  const elementos = (linea?.elementos || []).map((el) => ({ el, ...perdidaElemento(el, fMHz) }));
  const valido = elementos.every((x) => !x.error && Number.isFinite(x.dB));
  const total = valido ? elementos.reduce((s, x) => s + x.dB, 0) : null;
  return { total, valido, elementos };
}

// Texto breve de un elemento (informe, pasos y fuentes)
const nm = (x, d = 2) => String(+(+x).toFixed(d)).replace('.', ',');
export function descripcionElemento(el) {
  switch (el.tipo) {
    case 'coaxial': { const c = coaxial(el.modelo); return `Coaxial ${c ? `${c.fabricante.split(' (')[0]} ${c.modelo}` : el.modelo}, ${nm(el.longitud, 1)} m`; }
    case 'eliptica': return `Guía elíptica ANDREW ${el.modelo}, ${nm(el.longitud, 1)} m`;
    case 'rectangular': return `Guía rectangular ${el.modelo} (${material(el.material).nombre.split(' (')[0].toLowerCase()}), ${nm(el.longitud, 1)} m`;
    case 'propia': return `${el.nombre || 'Línea con datos propios'}, ${nm(el.longitud, 1)} m`;
    case 'accesorio': { const a = accesorio(el.id); return `${a ? a.nombre : el.id} × ${el.n}${el.valor != null ? ` (${nm(el.valor, 3)} dB/unidad, valor propio)` : ''}`; }
    default: return '';
  }
}
// Fuente del dato de un elemento: { texto, url }
export function fuenteElemento(el) {
  switch (el.tipo) {
    case 'coaxial': { const c = coaxial(el.modelo); return c ? { texto: `${c.fabricante}, ficha ${c.modelo}. ${c.nota}`, url: c.url } : null; }
    case 'eliptica': { const g = eliptica(el.modelo); return g ? { texto: `${g.fabricante}, ficha ${g.modelo} (banda ${nm(g.banda[0], 3)}–${nm(g.banda[1], 3)} GHz, corte eTE11 ${nm(g.corte, 3)} GHz). ${g.nota}`, url: g.url } : null; }
    case 'rectangular': return { texto: `${el.modelo}: atenuación TE10 calculada con la conductividad de ${material(el.material).nombre}. ${material(el.material).fuente}`, url: '' };
    case 'accesorio': { const a = accesorio(el.id); return a ? { texto: `${a.nombre}: ${a.detalle}`, url: a.url } : null; }
    default: return null;
  }
}

// ---------------------------------------------------------------------
// Estado guardado: { modo: 'manual' | 'calculada', elementos: […] }
// Los datos guardados antes de la 1.5 no tienen línea: modo manual, y las
// pérdidas que ya tenía cada lado se conservan como valor manual.
// ---------------------------------------------------------------------
const TIPOS = ['coaxial', 'eliptica', 'rectangular', 'propia', 'accesorio'];
const num = (v, d = 0) => (v == null || v === '' || !Number.isFinite(+v) ? d : +v);
export function normalizarElemento(x) {
  if (!x || !TIPOS.includes(x.tipo)) return null;
  switch (x.tipo) {
    case 'coaxial': return coaxial(x.modelo) ? { tipo: 'coaxial', modelo: x.modelo, longitud: Math.max(0, num(x.longitud)) } : null;
    case 'eliptica': return eliptica(x.modelo) ? { tipo: 'eliptica', modelo: x.modelo, longitud: Math.max(0, num(x.longitud)) } : null;
    case 'rectangular': return rectangular(x.modelo)
      ? { tipo: 'rectangular', modelo: x.modelo, material: material(x.material).id, longitud: Math.max(0, num(x.longitud)) } : null;
    case 'propia': return {
      tipo: 'propia', nombre: String(x.nombre ?? '').slice(0, 60), forma: x.forma === 'puntos' ? 'puntos' : 'k',
      k1: num(x.k1, NaN), k2: num(x.k2, NaN), longitud: Math.max(0, num(x.longitud)),
      puntos: Array.isArray(x.puntos) ? x.puntos.slice(0, 20).map((p) => [num(p?.[0], NaN), num(p?.[1], NaN)]) : [],
    };
    case 'accesorio': return accesorio(x.id)
      ? { tipo: 'accesorio', id: x.id, n: Math.max(0, Math.round(num(x.n, 1))), valor: x.valor == null || x.valor === '' || !Number.isFinite(+x.valor) ? null : +x.valor } : null;
    default: return null;
  }
}
export function normalizarLinea(x) {
  if (!x || typeof x !== 'object') return { modo: 'manual', elementos: [] };
  return {
    modo: x.modo === 'calculada' ? 'calculada' : 'manual',
    elementos: (Array.isArray(x.elementos) ? x.elementos : []).slice(0, 30).map(normalizarElemento).filter(Boolean),
  };
}
export const lineaDe = (lado) => lado?.linea || { modo: 'manual', elementos: [] };

// ---------------------------------------------------------------------
// Configuraciones de partida (editables) y orientación
// ---------------------------------------------------------------------
export const elipticaDeBanda = (fGHz) => ELIPTICAS.find((g) => fGHz >= g.banda[0] && fGHz <= g.banda[1]) || null;
export const rectangularDeBanda = (fGHz) => RECTANGULARES.find((g) => fGHz >= g.banda[0] && fGHz <= g.banda[1]) || null;
export const f758DeBanda = (fGHz) => F758.filter((x) => fGHz >= x.f[0] && fGHz <= x.f[1]);
// Coaxial corrugado más fino cuya banda cubre f (de mayor a menor diámetro útil)
export function coaxialParaBajada(fMHz) {
  for (const id of ['AVA7-50', 'AVA6-50', 'AVA5-50', 'LDF4-50A', 'LDF2-50', 'LDF1-50', 'FSJ1-50A']) {
    const c = coaxial(id);
    if (fMHz <= c.banda[1]) return c;
  }
  return null;
}

export const CONFIGURACIONES = {
  exterior: { titulo: 'Radio junto a la antena', texto: 'Equipo totalmente exterior o ODU montada en la antena: sin línea de transmisión (la UIT-R F.758 toma 0 dB). Añade solo lo que haya entre la radio y la antena (acoplador 1+1, latiguillo…).' },
  interior: { titulo: 'Radio en interior, bajada larga', texto: 'Por encima de unos 3 GHz la bajada se hace con guía elíptica (menos pérdida que el coaxial); por debajo, con coaxial corrugado grueso. 50 m es la longitud media que usa la UIT-R F.758 para el valor alto de pérdidas.' },
  coaxial: { titulo: 'Frecuencias bajas (coaxial)', texto: 'En VHF, UHF y hasta unos 3 GHz, coaxial corrugado o flexible de baja pérdida, con sus conectores y un protector de descargas en la entrada del edificio.' },
};

export function configuracion(tipo, fMHz) {
  const fGHz = fMHz / 1000;
  const acc = (id, n = 1) => ({ tipo: 'accesorio', id, n, valor: null });
  if (tipo === 'exterior') return [];
  if (tipo === 'interior') {
    const ew = elipticaDeBanda(fGHz);
    if (ew && fGHz >= 3) return [{ tipo: 'eliptica', modelo: ew.id, longitud: 50 }, acc('conector-ew', 2), acc('flexible', 1), acc('ventana', 1)];
    const c = coaxialParaBajada(fMHz);
    if (c) return [{ tipo: 'coaxial', modelo: c.id, longitud: 50 }, acc('conector', 2), acc('protector', 1)];
    const wr = rectangularDeBanda(fGHz);
    return wr ? [{ tipo: 'rectangular', modelo: wr.id, material: 'cobre', longitud: 10 }, acc('codo', 2), acc('flexible', 1)] : [];
  }
  // coaxial
  const c = coaxialParaBajada(fMHz) || coaxial('LDF4-50A');
  return [{ tipo: 'coaxial', modelo: c.id, longitud: 30 }, acc('conector', 2), acc('protector', 1)];
}
// Configuración inicial al pasar a «calculadas»
export const configuracionInicial = (fMHz) => configuracion(fMHz >= 3000 ? 'interior' : 'coaxial', fMHz);

// ---------------------------------------------------------------------
// Paso explicado de Cálculos (explicacion.js) e informe CSV
// ---------------------------------------------------------------------
export function pasoLinea(lado, letra, fMHz, f) {
  const ln = lado?.linea;
  if (ln?.modo !== 'calculada') return null;
  const r = perdidasLinea(ln, fMHz);
  const partes = r.elementos.map((x) => {
    const el = x.el;
    if (x.error) return `${descripcionElemento(el)}: no se puede calcular`;
    if (x.dB100m != null) return `${f(x.dB100m, 3)} dB/100 m · ${f(el.longitud, 1)} m / 100 = ${f(x.dB, 3)} dB`;
    return `${el.n} × ${f(x.unidad, 3)} dB = ${f(x.dB, 3)} dB`;
  });
  return {
    id: `linea-${letra.toLowerCase()}`,
    titulo: `Pérdidas del lado ${letra} (L<sub>${letra}</sub>): línea y accesorios`,
    corta: `L<sub>${letra}</sub> = Σ α<sub>i</sub>·ℓ<sub>i</sub> + Σ n<sub>j</sub>·L<sub>j</sub>`,
    formula: `L<sub>${letra}</sub> = Σ α<sub>i</sub>(f)·ℓ<sub>i</sub> + Σ n<sub>j</sub>·L<sub>j</sub>`,
    sustitucion: partes.length ? partes.join(' + ') : 'Sin elementos (radio junto a la antena)',
    resultado: r.valido ? `L<sub>${letra}</sub> = ${f(r.total, 2)} dB` : `No se puede calcular a esta frecuencia: se usa L<sub>${letra}</sub> = ${f(lado.l, 2)} dB`,
    nota: `${r.elementos.map((x) => descripcionElemento(x.el)).join('; ') || 'Sin elementos'}. α<sub>i</sub>: atenuación de cada tramo a la frecuencia del enlace (fórmula k<sub>1</sub>·√f + k<sub>2</sub>·f del fabricante, tabla de su ficha interpolada o, en guía rectangular, atenuación del modo TE<sub>10</sub>); L<sub>j</sub>: pérdida de cada accesorio según su ficha (los conectores coaxiales, 0,05·√f(GHz) dB). Fuentes en «Datos → Pérdidas de cada lado».`,
  };
}

export function filasLinea(lado, letra, fMHz) {
  const ln = lado?.linea;
  if (ln?.modo !== 'calculada') return [];
  const r = perdidasLinea(ln, fMHz);
  const filas = r.elementos.map((x) => ({
    magnitud: `Lado ${letra} · ${descripcionElemento(x.el)}`,
    formula: x.dB100m != null ? 'L = α · ℓ / 100' : x.el.tipo === 'accesorio' ? 'L = n · L_unidad' : '',
    sustitucion: x.error ? x.error : x.dB100m != null ? `α = ${x.dB100m.toFixed(4).replace('.', ',')} dB/100 m; ℓ = ${String(x.el.longitud).replace('.', ',')} m` : `n = ${x.el.n}; L_unidad = ${(x.unidad ?? 0).toFixed(4).replace('.', ',')} dB`,
    valor: x.error ? null : x.dB,
    fuente: fuenteElemento(x.el),
  }));
  filas.push({ magnitud: `Lado ${letra} · total de la línea y accesorios (L_${letra})`, formula: 'Σ', sustitucion: r.valido ? '' : 'No se puede calcular a esta frecuencia: se usa el último valor', valor: r.valido ? r.total : lado.l });
  return filas;
}
