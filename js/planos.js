/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// planos.js — Exportación de planos: PDF (lámina con cajetín), DXF (CAD)
// y KML (Google Earth). Sin librerías externas: los tres formatos se
// escriben directamente, así la app sigue funcionando sin conexión.
//   · PDF: perfil longitudinal a escala real (A4 o A3 apaisado) con la
//     exageración vertical elegida, resultados, croquis de planta y cajetín.
//   · DXF R12 (AC1009): el formato CAD más compatible (AutoCAD, LibreCAD,
//     QCAD, FreeCAD, QGIS). Perfil en metros por capas, y planta en
//     coordenadas UTM ETRS89 reales (se superpone a la cartografía del IGN).
//   · KML: emplazamientos, línea del enlace y punto crítico.
// =====================================================================
import { aUTM, epsgETRS89 } from './utm.js';
import { NOMBRE, VERSION, AUTOR, LICENCIA, REGISTRO as CODIGO } from './version.js';
import { evaluarEnlace } from './veredicto.js';

const REGISTRO = `Safe Creative ${CODIGO}`;
const FIRMA = `${NOMBRE} ${VERSION}`;
const ESTADOS = {
  despejado: 'Trayecto despejado (≥ 60 % de r1)',
  fresnel: 'Fresnel invadido (< 60 % de r1)',
  obstruido: 'Sin visión directa (el relieve corta la LOS)',
};

// Números con coma decimal y signo menos ASCII (válido en todos los formatos)
const n = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
const miles = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function marcas(min, max, cuantas) {
  const paso0 = (max - min) / Math.max(1, cuantas);
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0 - 1e-12) || paso0;
  const out = [];
  for (let v = Math.ceil(min / paso - 1e-9) * paso; v <= max + 1e-9; v += paso) out.push(+v.toFixed(6));
  return { valores: out, paso };
}

// Resumen común a los tres formatos
export function resumenPlano(c) {
  const an = c.an, p = an?.peor, dif = c.dif, res = c.resModelo;
  const itm = res.incluyeTerreno;
  return [
    ['Distancia A–B', `${n(c.dKm, 3)} km`],
    ['Frecuencia', `${n(c.e.fMHz, 1)} MHz`],
    ['Potencia transmitida', `${n(c.e.ptxDbm, 2)} dBm`],
    ['PIRE', `${n(c.pres.pire, 2)} dBm`],
    ...(itm
      ? [['Modelo', `Longley–Rice (ITM), ${n(res.parametros.tiempo, Number.isInteger(res.parametros.tiempo) ? 0 : 1)} % del tiempo`],
        ['Pérdidas Longley–Rice', `${n(res.perdida, 2)} dB`],
        ['Modo de propagación', res.detalle.modoTexto]]
      : [['Pérdidas espacio libre', `${n(res.perdida, 2)} dB`]]),
    ['Potencia recibida', `${n(c.pres.prx, 2)} dBm`],
    [itm ? 'Margen' : 'Margen (espacio libre)', `${n(c.pres.margen, 2)} dB`],
    ...(dif ? [['Difracción filo cuchillo', `${n(dif.J, 2)} dB (ν = ${n(dif.nu, 2)})`], ['Margen con difracción', `${n(c.pres.margen - dif.J, 2)} dB`]] : []),
    ...(an ? [['r1 en el punto medio', `${n(an.r1Medio, 2)} m`]] : []),
    ...(p ? [['Punto crítico (desde A)', `${n(p.d / 1000, 3)} km`], ['Despeje c / r1', `${n(p.despeje, 2)} m / ${n(p.relacion * 100, 1)} %`]] : []),
    ...(an ? [['Trayecto', ESTADOS[an.estado]]] : []),
    ['Evaluación', evaluarEnlace(c.pres, an, dif, undefined, res).titulo],
  ];
}

const limpiarNombre = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'X';
export function nombrePlano(tipo, ext, a, b, fecha = new Date()) {
  const d = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `radioenlace_${tipo}_${limpiarNombre(a.nombre)}-${limpiarNombre(b.nombre)}_${d}.${ext}`;
}

// =====================================================================
// KML
// =====================================================================
const xml = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);

export function generarKML(c) {
  const { a, b, an, e } = c;
  const yA = an ? an.yA : null, yB = an ? an.yB : null;
  const desc = resumenPlano(c).map(([k, v]) => `${k}: ${v}`).join('\n');
  const marca = (id, s, h, z, estilo) => `
    <Placemark><name>${id} · ${xml(s.nombre || id)}</name><styleUrl>#${estilo}</styleUrl>
      <description>${xml(`Latitud ${n(s.lat, 6)}°, longitud ${n(s.lon, 6)}° (ETRS89)\nAltura de antena ${n(h, 1)} m${z != null ? `\nCota del terreno ${n(z, 1)} m` : ''}`)}</description>
      <Point><altitudeMode>relativeToGround</altitudeMode><coordinates>${s.lon.toFixed(7)},${s.lat.toFixed(7)},${h.toFixed(1)}</coordinates></Point></Placemark>`;
  const p = an?.peor;
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${xml(`Radioenlace ${a.nombre || 'A'} – ${b.nombre || 'B'}`)}</name>
  <description>${xml(`Generado con ${FIRMA} · ${AUTOR} · ${LICENCIA} · ${REGISTRO}\n\n${desc}`)}</description>
  <Style id="sitioA"><IconStyle><color>ffd65712</color><scale>1.2</scale></IconStyle></Style>
  <Style id="sitioB"><IconStyle><color>ff0f48d9</color><scale>1.2</scale></IconStyle></Style>
  <Style id="critico"><IconStyle><color>ff3a2ac6</color><scale>1.1</scale></IconStyle></Style>
  <Style id="enlace"><LineStyle><color>ffe6ff80</color><width>4</width></LineStyle></Style>
  ${marca('A', a, e.hA, an?.zA, 'sitioA')}
  ${marca('B', b, e.hB, an?.zB, 'sitioB')}
  <Placemark><name>Línea de visión A–B</name><styleUrl>#enlace</styleUrl>
    <description>${xml(desc)}</description>
    <LineString><tessellate>0</tessellate><altitudeMode>${an ? 'absolute' : 'clampToGround'}</altitudeMode>
      <coordinates>${a.lon.toFixed(7)},${a.lat.toFixed(7)},${(yA ?? 0).toFixed(1)} ${b.lon.toFixed(7)},${b.lat.toFixed(7)},${(yB ?? 0).toFixed(1)}</coordinates></LineString></Placemark>
  ${p ? `<Placemark><name>Punto más comprometido</name><styleUrl>#critico</styleUrl>
    <description>${xml(`${n(p.d / 1000, 3)} km desde A\nDespeje ${n(p.despeje, 2)} m (${n(p.relacion * 100, 1)} % de r1)\n${ESTADOS[an.estado]}`)}</description>
    <Point><coordinates>${p.lon.toFixed(7)},${p.lat.toFixed(7)},0</coordinates></Point></Placemark>` : ''}
</Document>
</kml>
`;
}

// =====================================================================
// DXF R12
// =====================================================================
const CAPAS = [
  ['REJILLA', 8, 'CONTINUOUS'], ['TERRENO', 30, 'CONTINUOUS'], ['TERRENO_SIN_CURVATURA', 33, 'DASHED'],
  ['LINEA_VISION', 5, 'CONTINUOUS'], ['FRESNEL', 4, 'CONTINUOUS'], ['LIMITE_60', 4, 'DASHED'],
  ['INVASION_60', 1, 'CONTINUOUS'], ['ANTENAS', 7, 'CONTINUOUS'], ['PUNTO_CRITICO', 1, 'CONTINUOUS'],
  ['TEXTOS', 7, 'CONTINUOUS'], ['ENLACE', 5, 'CONTINUOUS'], ['EMPLAZAMIENTOS', 7, 'CONTINUOUS'], ['CUADRICULA_UTM', 8, 'CONTINUOUS'],
];
// Texto DXF: caracteres no ASCII como \U+XXXX (AutoCAD, LibreCAD, QCAD)
const dxfTxt = (t) => String(t).replace(/[^\x20-\x7e]/g, (ch) => `\\U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
const f6 = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);

class DXF {
  constructor() { this.e = []; this.min = [Infinity, Infinity]; this.max = [-Infinity, -Infinity]; }
  #ext(x, y) { this.min = [Math.min(this.min[0], x), Math.min(this.min[1], y)]; this.max = [Math.max(this.max[0], x), Math.max(this.max[1], y)]; }
  linea(capa, x1, y1, x2, y2) { this.#ext(x1, y1); this.#ext(x2, y2); this.e.push(`0\nLINE\n8\n${capa}\n10\n${f6(x1)}\n20\n${f6(y1)}\n30\n0\n11\n${f6(x2)}\n21\n${f6(y2)}\n31\n0`); }
  polilinea(capa, pts, cerrada = false) {
    if (pts.length < 2) return;
    pts.forEach(([x, y]) => this.#ext(x, y));
    this.e.push(`0\nPOLYLINE\n8\n${capa}\n66\n1\n10\n0\n20\n0\n30\n0\n70\n${cerrada ? 1 : 0}\n` +
      pts.map(([x, y]) => `0\nVERTEX\n8\n${capa}\n10\n${f6(x)}\n20\n${f6(y)}\n30\n0`).join('\n') + `\n0\nSEQEND\n8\n${capa}`);
  }
  circulo(capa, x, y, r) { this.#ext(x - r, y - r); this.#ext(x + r, y + r); this.e.push(`0\nCIRCLE\n8\n${capa}\n10\n${f6(x)}\n20\n${f6(y)}\n30\n0\n40\n${f6(r)}`); }
  // alin: 0 izquierda, 1 centro, 2 derecha
  texto(capa, x, y, h, t, alin = 0, giro = 0) {
    const w = String(t).length * h * 0.6, x0 = alin === 1 ? x - w / 2 : alin === 2 ? x - w : x;
    this.#ext(x0, y); this.#ext(x0 + w, y + h);
    // Se escribe siempre alineado a la izquierda (posición calculada): algunos visores ignoran el código 72
    this.e.push(`0\nTEXT\n8\n${capa}\n10\n${f6(x0)}\n20\n${f6(y)}\n30\n0\n40\n${f6(h)}\n1\n${dxfTxt(t)}${giro ? `\n50\n${f6(giro)}` : ''}`);
  }
  cadena() {
    const cab = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n9\n$EXTMIN\n10\n${f6(this.min[0])}\n20\n${f6(this.min[1])}\n30\n0\n9\n$EXTMAX\n10\n${f6(this.max[0])}\n20\n${f6(this.max[1])}\n30\n0\n0\nENDSEC`;
    const ltype = `0\nTABLE\n2\nLTYPE\n70\n2\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nLTYPE\n2\nDASHED\n70\n0\n3\n__ __ __ __\n72\n65\n73\n2\n40\n0.75\n49\n0.5\n49\n-0.25\n0\nENDTAB`;
    const capas = `0\nTABLE\n2\nLAYER\n70\n${CAPAS.length + 1}\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n` +
      CAPAS.map(([nom, col, lt]) => `0\nLAYER\n2\n${nom}\n70\n0\n62\n${col}\n6\n${lt}`).join('\n') + '\n0\nENDTAB';
    const estilo = `0\nTABLE\n2\nSTYLE\n70\n1\n0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n0\nENDTAB`;
    return `${cab}\n0\nSECTION\n2\nTABLES\n${ltype}\n${capas}\n${estilo}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${this.e.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
  }
}

// Perfil longitudinal en metros: x = distancia desde A, y = cota × exageración
export function generarDXFPerfil(c, exag = 10) {
  const an = c.an, P = an.puntos, D = an.D;
  const d = new DXF();
  const Y = (z) => z * exag;
  let zmin = Infinity, zmax = -Infinity;
  for (const p of P) { if (p.zEf != null) { zmin = Math.min(zmin, p.z, p.zEf); zmax = Math.max(zmax, p.zEf); } zmin = Math.min(zmin, p.los - p.r1); zmax = Math.max(zmax, p.los + p.r1); }
  const mz = marcas(zmin, zmax, 6), z0 = mz.valores[0] - mz.paso, z1 = mz.valores[mz.valores.length - 1] + mz.paso;
  // Altura de texto (unidades de dibujo): proporcional al trayecto y sin solapar las marcas del eje vertical
  const th = Math.max(Math.min(D / 160, (mz.paso * exag) / 2.5), 1);
  const mx = marcas(0, D / 1000, 10);
  // Rejilla y rótulos de ejes
  for (const v of [z0, ...mz.valores, z1]) { d.linea('REJILLA', 0, Y(v), D, Y(v)); d.texto('TEXTOS', -th * 0.8, Y(v) - th / 2, th, `${miles(v)} m`, 2); }
  for (const k of mx.valores) { d.linea('REJILLA', k * 1000, Y(z0), k * 1000, Y(z1)); d.texto('TEXTOS', k * 1000, Y(z0) - th * 2, th, `${n(k, Number.isInteger(mx.paso) ? 0 : 1)} km`, 1); }
  // Tramos con cota
  const tramos = []; let t = [];
  for (const p of P) { if (p.zEf == null) { if (t.length) tramos.push(t); t = []; } else t.push(p); }
  if (t.length) tramos.push(t);
  for (const tr of tramos) {
    d.polilinea('TERRENO', tr.map((p) => [p.d, Y(p.zEf)]));
    if (an.flechaMedio > 0.01) d.polilinea('TERRENO_SIN_CURVATURA', tr.map((p) => [p.d, Y(p.z)]));
  }
  d.polilinea('FRESNEL', P.map((p) => [p.d, Y(p.los + p.r1)]));
  d.polilinea('FRESNEL', P.map((p) => [p.d, Y(p.los - p.r1)]));
  d.polilinea('LIMITE_60', P.map((p) => [p.d, Y(p.los - 0.6 * p.r1)]));
  d.linea('LINEA_VISION', 0, Y(an.yA), D, Y(an.yB));
  // Invasiones del 60 %
  let inv = [];
  const cerrar = () => { if (inv.length > 1) d.polilinea('INVASION_60', [...inv.map((p) => [p.d, Y(Math.min(p.zEf, p.los + p.r1))]), ...inv.slice().reverse().map((p) => [p.d, Y(p.los - 0.6 * p.r1)])], true); inv = []; };
  for (const p of P) { if (p.relacion != null && p.i > 0 && p.i < P.length - 1 && p.relacion < 0.6) inv.push(p); else cerrar(); }
  cerrar();
  // Mástiles y antenas
  d.linea('ANTENAS', 0, Y(an.zA), 0, Y(an.yA)); d.circulo('ANTENAS', 0, Y(an.yA), th * 0.6); d.texto('TEXTOS', th, Y(an.yA) + th, th * 1.3, `A · ${c.a.nombre || ''} · mástil ${n(c.e.hA, 1)} m · cota ${n(an.zA, 1)} m`);
  d.linea('ANTENAS', D, Y(an.zB), D, Y(an.yB)); d.circulo('ANTENAS', D, Y(an.yB), th * 0.6); d.texto('TEXTOS', D - th, Y(an.yB) + th, th * 1.3, `B · ${c.b.nombre || ''} · mástil ${n(c.e.hB, 1)} m · cota ${n(an.zB, 1)} m`, 2);
  // Punto crítico
  const p = an.peor;
  if (p) {
    d.circulo('PUNTO_CRITICO', p.d, Y(p.zEf), th * 0.7);
    d.linea('PUNTO_CRITICO', p.d, Y(p.zEf), p.d, Y(p.los));
    d.texto('TEXTOS', p.d + th, Y(Math.max(p.zEf, p.los)) + th * 1.5, th, `Punto crítico: ${n(p.d / 1000, 3)} km · c = ${n(p.despeje, 2)} m · c/r1 = ${n(p.relacion * 100, 1)} %`);
  }
  // Título y datos
  let y = Y(z1) + th * 10;
  d.texto('TEXTOS', 0, y, th * 2, `Perfil longitudinal del radioenlace ${c.a.nombre || 'A'} – ${c.b.nombre || 'B'}`);
  y -= th * 2.4;
  d.texto('TEXTOS', 0, y, th, `Unidades: metros. Eje X: distancia desde A. Eje Y: cota × ${exag} (exageración vertical ×${exag}). k = ${n(c.e.k, 3)}. Relieve: ${c.perfil.fuente.nombre}, ${c.perfil.fuente.resolucion}.`);
  y -= th * 1.6;
  d.texto('TEXTOS', 0, y, th, `Generado con ${FIRMA} · ${AUTOR} · ${LICENCIA} · ${REGISTRO}`);
  const res = resumenPlano(c);
  // Resultados bajo el eje de distancias, en dos columnas
  const mitad = Math.ceil(res.length / 2);
  d.texto('TEXTOS', 0, Y(z0) - th * 5, th * 1.3, 'Resultados');
  res.forEach(([k, v], i) => d.texto('TEXTOS', i < mitad ? 0 : D / 2, Y(z0) - th * (7.2 + 1.8 * (i % mitad)), th, `${k}: ${v}`));
  return d.cadena();
}

// Planta georreferenciada en UTM ETRS89
export function generarDXFPlanta(c) {
  const { a, b, an } = c;
  const huso = aUTM(a.lat, a.lon).huso;
  const U = (s) => { const r = aUTM(s.lat, s.lon, huso); return [r.x, r.y]; };
  const [xa, ya] = U(a), [xb, yb] = U(b);
  const D = Math.hypot(xb - xa, yb - ya);
  const th = Math.max(D / 120, 8);
  const d = new DXF();
  // Cuadrícula UTM cada 1, 2, 5 o 10 km
  const paso = [1000, 2000, 5000, 10000, 20000].find((p) => Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) / p <= 8) || 50000;
  const mrg = Math.max(paso * 0.6, D * 0.12);
  const x0 = Math.floor((Math.min(xa, xb) - mrg) / paso) * paso, x1 = Math.ceil((Math.max(xa, xb) + mrg) / paso) * paso;
  const y0 = Math.floor((Math.min(ya, yb) - mrg) / paso) * paso, y1 = Math.ceil((Math.max(ya, yb) + mrg) / paso) * paso;
  for (let x = x0; x <= x1; x += paso) { d.linea('CUADRICULA_UTM', x, y0, x, y1); d.texto('TEXTOS', x, y0 - th * 1.8, th, `X ${miles(x)}`, 1); }
  for (let y = y0; y <= y1; y += paso) { d.linea('CUADRICULA_UTM', x0, y, x1, y); d.texto('TEXTOS', x0 - th, y - th / 2, th, `Y ${miles(y)}`, 2); }
  // Trazado: tramos invadidos resaltados
  const P = an?.puntos || [];
  d.linea('ENLACE', xa, ya, xb, yb);
  let inv = [];
  const cerrar = () => { if (inv.length > 1) d.polilinea('INVASION_60', inv.map(U)); inv = []; };
  for (const p of P) { if (p.relacion != null && p.i > 0 && p.i < P.length - 1 && p.relacion < 0.6) inv.push(p); else cerrar(); }
  cerrar();
  for (const [id, s, x, y] of [['A', a, xa, ya], ['B', b, xb, yb]]) {
    d.circulo('EMPLAZAMIENTOS', x, y, th * 0.8);
    d.texto('TEXTOS', x + th * 1.2, y + th * 0.6, th * 1.4, `${id} · ${s.nombre || id}`);
    d.texto('TEXTOS', x + th * 1.2, y - th * 1.4, th * 0.9, `X ${n(x, 2)} · Y ${n(y, 2)}`);
  }
  if (an?.peor) {
    const [xp, yp] = U(an.peor);
    d.circulo('PUNTO_CRITICO', xp, yp, th * 0.6);
    d.texto('TEXTOS', xp + th, yp - th * 2, th, `Punto crítico (${n(an.peor.d / 1000, 3)} km desde A)`);
  }
  d.texto('TEXTOS', x0, y1 + th * 4, th * 2, `Planta del radioenlace · UTM ETRS89 huso ${huso} (EPSG:${epsgETRS89(huso)})`);
  d.texto('TEXTOS', x0, y1 + th * 1.8, th, `Coordenadas reales en metros: se superpone a la cartografía del IGN. Generado con ${FIRMA} · ${AUTOR} · ${LICENCIA} · ${REGISTRO}`);
  return d.cadena();
}

// =====================================================================
// PDF (1.4, sin compresión, fuentes estándar Helvetica en WinAnsi)
// =====================================================================
const WINANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
const SUSTITUIR = { '−': '-', '₁': '1', '₂': '2', '≥': '>=', '≤': '<=', '→': '->', '√': 'raíz', 'λ': 'lambda', 'ν': 'nu', '×': 'x' };
function pdfCadena(t) {
  let out = '';
  const texto = [...String(t)].map((ch) => SUSTITUIR[ch] ?? ch).join('');
  for (const ch of texto) {
    let code = WINANSI[ch] ?? ch.codePointAt(0);
    if (code > 255) code = 63; // «?»
    if (code === 40 || code === 41 || code === 92) out += '\\' + String.fromCharCode(code);
    else if (code < 32 || code > 126) out += '\\' + code.toString(8).padStart(3, '0');
    else out += String.fromCharCode(code);
  }
  return `(${out})`;
}
// Cadenas del diccionario de información (metadatos): UTF-16BE con BOM, válido para cualquier carácter
function pdfTextoInfo(t) {
  let hex = 'FEFF';
  for (let i = 0; i < t.length; i++) hex += t.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return `<${hex}>`;
}
// Anchura aproximada de Helvetica (para alinear y recortar textos)
const anchoTexto = (t, tam) => String(t).length * tam * 0.52;
// Anchura exacta en puntos con las métricas AFM de Helvetica y Helvetica-Bold (milésimas de em)
const AFM = {
  normal: { min: 'a556b556c500d556e556f278g556h556i222j222k500l222m833n556o556p556q556r333s500t278u556v500w722x500y500z500',
    may: 'A667B667C722D722E667F611G778H722I278J500K667L556M833N722O778P667Q778R722S667T611U722V667W944X667Y667Z611', dos: 278 },
  negrita: { min: 'a556b611c556d611e556f333g611h611i278j278k556l278m889n611o611p611q611r389s556t333u611v556w778x556y556z500',
    may: 'A722B722C722D722E667F611G778H722I278J556K722L611M833N722O778P667Q778R722S667T611U722V667W944X667Y667Z611', dos: 333 },
};
const tablaAFM = {};
for (const [k, v] of Object.entries(AFM)) {
  const t = {};
  for (const m of (v.min + v.may).matchAll(/([A-Za-z])(\d+)/g)) t[m[1]] = +m[2];
  Object.assign(t, { ' ': 278, ',': 278, '.': 278, ':': v.dos, ';': v.dos, '-': 333, '=': 584, '%': 889, '(': 333, ')': 333, '/': 278, '·': 278, '–': 556, '—': 1000, '>': 584, '<': 584 });
  for (let d = 0; d <= 9; d++) t[d] = 556;
  tablaAFM[k] = t;
}
function anchoExacto(t, tam, negrita) {
  const tab = tablaAFM[negrita ? 'negrita' : 'normal'];
  let w = 0;
  for (const ch of String(t)) {
    const base = ch.normalize('NFD')[0];                    // á → a
    w += tab[ch] ?? tab[base] ?? 600;
  }
  return (w / 1000) * tam;
}
// Recorta un texto con «…» para que no pase de maxMm milímetros
function recortar(t, tam, maxMm) {
  t = String(t);
  const maxCar = Math.floor((maxMm * 72) / 25.4 / (tam * 0.52));
  return t.length <= maxCar ? t : `${t.slice(0, Math.max(1, maxCar - 1)).trimEnd()}…`;
}

class Lienzo {
  constructor(anchoMm, altoMm) { this.W = anchoMm; this.H = altoMm; this.k = 72 / 25.4; this.ops = []; }
  #p(x, y) { return `${(x * this.k).toFixed(2)} ${((this.H - y) * this.k).toFixed(2)}`; }
  color(r, g, b, relleno = false) { this.ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} ${relleno ? 'rg' : 'RG'}`); return this; }
  grosor(mm) { this.ops.push(`${(mm * this.k).toFixed(2)} w`); return this; }
  discontinua(on) { this.ops.push(on ? '[3 2] 0 d' : '[] 0 d'); return this; }
  linea(x1, y1, x2, y2) { this.ops.push(`${this.#p(x1, y1)} m ${this.#p(x2, y2)} l S`); return this; }
  ruta(pts, cerrar = false, modo = 'S') {
    if (pts.length < 2) return this;
    this.ops.push(pts.map(([x, y], i) => `${this.#p(x, y)} ${i ? 'l' : 'm'}`).join(' ') + (cerrar ? ' h' : '') + ` ${modo}`);
    return this;
  }
  rect(x, y, w, h, modo = 'S') { this.ops.push(`${(x * this.k).toFixed(2)} ${((this.H - y - h) * this.k).toFixed(2)} ${(w * this.k).toFixed(2)} ${(h * this.k).toFixed(2)} re ${modo}`); return this; }
  circulo(x, y, r, modo = 'S') {
    const c = 0.5523 * r, P = (dx, dy) => this.#p(x + dx, y + dy);
    this.ops.push(`${P(r, 0)} m ${P(r, -c)} ${P(c, -r)} ${P(0, -r)} c ${P(-c, -r)} ${P(-r, -c)} ${P(-r, 0)} c ${P(-r, c)} ${P(-c, r)} ${P(0, r)} c ${P(c, r)} ${P(r, c)} ${P(r, 0)} c ${modo}`);
    return this;
  }
  // tam en puntos; alin: 'i' izquierda, 'c' centro, 'd' derecha
  texto(x, y, t, tam = 8, { negrita = false, alin = 'i', giro = 0 } = {}) {
    const w = anchoTexto(t, tam) / this.k;
    const dx = alin === 'c' ? -w / 2 : alin === 'd' ? -w : 0;
    if (giro) {
      const r = (giro * Math.PI) / 180, cs = Math.cos(r).toFixed(4), sn = Math.sin(r).toFixed(4);
      this.ops.push(`BT /${negrita ? 'F2' : 'F1'} ${tam} Tf ${cs} ${sn} ${-sn} ${cs} ${this.#p(x, y)} Tm ${pdfCadena(t)} Tj ET`);
    } else this.ops.push(`BT /${negrita ? 'F2' : 'F1'} ${tam} Tf ${this.#p(x + dx, y)} Td ${pdfCadena(t)} Tj ET`);
    return this;
  }
  documento(titulo) {
    const obj = [];
    obj.push('<< /Type /Catalog /Pages 2 0 R >>');
    obj.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    const wpt = (this.W * this.k).toFixed(2), hpt = (this.H * this.k).toFixed(2);
    obj.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wpt} ${hpt}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`);
    const flujo = this.ops.join('\n');
    obj.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
    obj.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    obj.push(`<< /Title ${pdfTextoInfo(titulo)} /Author ${pdfTextoInfo(AUTOR)} /Creator ${pdfTextoInfo(FIRMA)} /Subject ${pdfTextoInfo(`${LICENCIA} · ${REGISTRO}`)} >>`);
    let s = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offs = [];
    obj.forEach((o, i) => { offs.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = s.length;
    s += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    s += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R /Info ${obj.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return bytes;
  }
}

// Coloca un rótulo con fondo blanco por encima de su punto de anclaje (ax, ay, en mm)
// sin tocar el relieve ni otros rótulos. Si tiene que alejarse, traza una línea de referencia.
function colocarRotulo(L, { t, tam, ax, ay, alin, col, P, X, Y, area, ocupados }) {
  const [ax0, ay0, ax1, ay1] = area;
  const pad = 0.9, sep = 1.0;
  const alto = (tam / L.k) * 0.95 + 2 * pad;
  const ancho = anchoExacto(t, tam, true) / L.k + 2 * pad;
  let x0 = alin === 'i' ? ax : alin === 'd' ? ax - ancho : ax - ancho / 2;
  x0 = Math.min(Math.max(x0, ax0 + 0.5), ax1 - ancho - 0.5);
  const x1 = x0 + ancho;
  // Punto más alto del relieve (menor y del papel) bajo la caja, incluidos los vecinos de los bordes
  let techo = Infinity;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.zEf == null) continue;
    const x = X(p.d), xa = i > 0 ? X(P[i - 1].d) : x, xs = i < P.length - 1 ? X(P[i + 1].d) : x;
    if (xs >= x0 && xa <= x1) techo = Math.min(techo, Y(p.zEf));
  }
  const solapa = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  let caja = null;
  for (let base = Math.min(ay - sep, techo - sep); base - alto >= ay0 + 0.5; base -= 0.5) {
    const c = [x0, base - alto, x1, base];
    if (!ocupados.some((o) => solapa(o, c))) { caja = c; break; }
  }
  if (!caja) caja = [x0, ay0 + 0.5, x1, ay0 + 0.5 + alto]; // sin hueco: arriba del todo
  ocupados.push([caja[0] - 0.8, caja[1] - 0.8, caja[2] + 0.8, caja[3] + 0.8]);
  // Línea de referencia si el rótulo queda lejos de su punto
  const linea = caja[3] < ay - sep - 1.5 ? [Math.min(Math.max(ax, caja[0] + 1), caja[2] - 1), caja[3], ax, ay] : null;
  return { t, tam, col, caja, linea, pad };
}
// Dibuja primero todas las líneas de referencia y después las cajas, para que ninguna línea cruce un rótulo
function dibujarRotulos(L, rotulos) {
  for (const r of rotulos) if (r.linea) L.color(...r.col).grosor(0.15).linea(...r.linea);
  for (const { t, tam, col, caja, pad } of rotulos) {
    L.color(255, 255, 255, true).color(...col).grosor(0.2).rect(caja[0], caja[1], caja[2] - caja[0], caja[3] - caja[1], 'B');
    L.color(...col, true).texto(caja[0] + pad, caja[3] - pad - (tam / L.k) * 0.22, t, tam, { negrita: true });
  }
}

const ESCALAS = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000, 2000000];
const FORMATOS = { A4: [297, 210], A3: [420, 297] };

export function generarPDF(c, { formato = 'A4', exag = 10, fecha = new Date() } = {}) {
  const [W, H] = FORMATOS[formato] || FORMATOS.A4;
  const L = new Lienzo(W, H);
  const an = c.an, P = an.puntos, D = an.D;
  const s = formato === 'A3' ? 1.3 : 1;          // tamaño relativo de los textos
  const m = 10;                                   // margen del recuadro (mm)
  // Recuadro
  L.color(20, 33, 42).grosor(0.5).rect(m, m, W - 2 * m, H - 2 * m);
  // Título
  L.texto(m + 4, m + 8, recortar(`Perfil longitudinal del radioenlace ${c.a.nombre || 'A'} – ${c.b.nombre || 'B'}`, 13 * s, W - 2 * m - 8), 13 * s, { negrita: true });
  // ---------- Zona del perfil ----------
  const bandaInf = (formato === 'A3' ? 78 : 62);
  const px0 = m + 20, py0 = m + 16, pw = W - 2 * m - 30, ph = H - 2 * m - bandaInf - 30;
  let zmin = Infinity, zmax = -Infinity;
  for (const p of P) { if (p.zEf != null) { zmin = Math.min(zmin, p.z, p.zEf); zmax = Math.max(zmax, p.zEf); } zmin = Math.min(zmin, p.los - p.r1); zmax = Math.max(zmax, p.los + p.r1); }
  const rangoDatos = Math.max(zmax - zmin, 1) * 1.15;
  // Escala horizontal normalizada que permite dibujar el perfil completo a escala real
  const eh = ESCALAS.find((e) => (D * 1000) / e <= pw && (rangoDatos * 1000 * exag) / e <= ph) || ESCALAS[ESCALAS.length - 1];
  const ev = eh / exag;
  // El eje vertical ocupa toda la altura disponible; el relieve queda en el tercio inferior
  // (con poca exageración se limita a 4 veces el desnivel para no dibujar kilómetros de cielo)
  const rangoTotal = Math.min((ph * ev) / 1000, rangoDatos * 4);
  const nMarcas = Math.max(1, Math.min(7, Math.floor((rangoTotal * 1000) / ev / 8))); // marcas separadas ≥ 8 mm
  const mz0 = marcas(0, rangoTotal, nMarcas);
  let zb = Math.floor((zmin - Math.max(0, (rangoTotal - rangoDatos) * 0.25) - rangoDatos * 0.05) / mz0.paso) * mz0.paso;
  if (zmin >= 0) zb = Math.max(zb, 0); // sin cotas negativas si el terreno está sobre el nivel del mar
  const zt = zb + rangoTotal;
  const mz = { valores: marcas(zb, zt, nMarcas).valores, paso: mz0.paso };
  const X = (dd) => px0 + (dd * 1000) / eh;
  const Y = (z) => py0 + ph - ((z - zb) * 1000) / ev;
  const anchoDib = (D * 1000) / eh;
  // Rejilla y ejes
  L.color(205, 212, 210).grosor(0.15);
  const mx = marcas(0, D / 1000, Math.max(4, Math.round(anchoDib / 25)));
  L.linea(px0, Y(zb), px0 + anchoDib, Y(zb));
  for (const v of mz.valores) L.linea(px0, Y(v), px0 + anchoDib, Y(v));
  for (const k of mx.valores) L.linea(X(k * 1000), Y(zb), X(k * 1000), Y(zt));
  L.color(60, 70, 78);
  for (const v of mz.valores) L.texto(px0 - 2, Y(v) + 1, `${miles(v)}`, 7 * s, { alin: 'd' });
  for (const k of mx.valores) L.texto(X(k * 1000), Y(zb) + 4.5, n(k, Number.isInteger(mx.paso) ? 0 : 1), 7 * s, { alin: 'c' });
  L.texto(px0 + anchoDib, Y(zb) + 9, 'distancia desde A (km)', 7 * s, { alin: 'd' });
  L.texto(px0 - 13, Y(zb) - 2, 'cota (m)', 7 * s, { giro: 90 });
  // Fresnel (relleno) y relieve
  const sup = P.map((p) => [X(p.d), Y(p.los + p.r1)]), inf = P.map((p) => [X(p.d), Y(p.los - p.r1)]);
  L.color(214, 233, 255, true).ruta([...sup, ...inf.slice().reverse()], true, 'f');
  const tramos = []; let t = [];
  for (const p of P) { if (p.zEf == null) { if (t.length) tramos.push(t); t = []; } else t.push(p); }
  if (t.length) tramos.push(t);
  for (const tr of tramos) {
    const arriba = tr.map((p) => [X(p.d), Y(p.zEf)]);
    L.color(222, 203, 160, true).ruta([...arriba, [arriba[arriba.length - 1][0], Y(zb)], [arriba[0][0], Y(zb)]], true, 'f');
    L.color(122, 98, 54).grosor(0.3).ruta(arriba);
    if (an.flechaMedio > 0.05) L.color(122, 98, 54).grosor(0.15).discontinua(true).ruta(tr.map((p) => [X(p.d), Y(p.z)])).discontinua(false);
  }
  // Invasiones del 60 %
  let inv = [];
  const cerrar = () => { if (inv.length > 1) L.color(214, 64, 72, true).ruta([...inv.map((p) => [X(p.d), Y(Math.min(p.zEf, p.los + p.r1))]), ...inv.slice().reverse().map((p) => [X(p.d), Y(p.los - 0.6 * p.r1)])], true, 'f'); inv = []; };
  for (const p of P) { if (p.relacion != null && p.i > 0 && p.i < P.length - 1 && p.relacion < 0.6) inv.push(p); else cerrar(); }
  cerrar();
  // Fresnel, 60 % y línea de visión
  L.color(18, 87, 214).grosor(0.2).ruta(sup).ruta(inf);
  L.discontinua(true).grosor(0.3).ruta(P.map((p) => [X(p.d), Y(p.los - 0.6 * p.r1)])).discontinua(false);
  L.grosor(0.5).linea(X(0), Y(an.yA), X(D), Y(an.yB));
  // Mástiles y antenas
  L.color(20, 33, 42).grosor(0.6).linea(X(0), Y(an.zA), X(0), Y(an.yA)).linea(X(D), Y(an.zB), X(D), Y(an.yB));
  L.color(18, 87, 214, true).circulo(X(0), Y(an.yA), 1.2, 'f');
  L.color(217, 72, 15, true).circulo(X(D), Y(an.yB), 1.2, 'f');
  const pc = an.peor;
  const colPc = pc ? { despejado: [17, 121, 90], fresnel: [168, 98, 0], obstruido: [198, 42, 58] }[an.estado] : null;
  if (pc) L.color(...colPc).grosor(0.4).circulo(X(pc.d), Y(pc.zEf), 1.4).discontinua(true).linea(X(pc.d), Y(pc.zEf), X(pc.d), Y(pc.los)).discontinua(false);
  // Escalas
  L.color(20, 33, 42, true).texto(px0, py0 - 2, `Escala horizontal 1:${miles(eh)} · Escala vertical 1:${miles(ev)} · Exageración vertical ×${exag} · k = ${n(c.e.k, 3)}`, 8 * s);
  // Barra de escala horizontal
  const barraM = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000].find((v) => (v * 1000) / eh >= 25) || 50000;
  const bx = px0 + pw - (barraM * 1000) / eh - 2, by = py0 + 4;
  L.color(20, 33, 42).grosor(0.3).rect(bx, by, (barraM * 1000) / eh / 2, 1.2, 'B').rect(bx + (barraM * 1000) / eh / 2, by, (barraM * 1000) / eh / 2, 1.2);
  L.texto(bx, by - 1, '0', 6 * s).texto(bx + (barraM * 1000) / eh, by - 1, barraM >= 1000 ? `${n(barraM / 1000, barraM % 1000 ? 1 : 0)} km` : `${barraM} m`, 6 * s, { alin: 'd' });
  // Rótulos de A, B y punto crítico: fondo blanco, por encima del relieve y sin pisarse
  const ocupados = [[bx - 2, by - 4, bx + (barraM * 1000) / eh + 2, by + 2]];
  const rotulo = (t, tam, ax, ay, alin, col) => colocarRotulo(L, { t, tam, ax, ay, alin, col, P, X, Y, area: [px0, py0, px0 + pw, py0 + ph], ocupados });
  const rotulos = [
    rotulo(`A · mástil ${n(c.e.hA, 1)} m · cota ${n(an.zA, 1)} m`, 8 * s, X(0) + 1.5, Y(an.yA), 'i', [20, 33, 42]),
    rotulo(`B · mástil ${n(c.e.hB, 1)} m · cota ${n(an.zB, 1)} m`, 8 * s, X(D) - 1.5, Y(an.yB), 'd', [20, 33, 42]),
  ];
  if (pc) {
    rotulos.push(rotulo(`Punto crítico: ${n(pc.d / 1000, 3)} km · c = ${n(pc.despeje, 2)} m · c/r1 = ${n(pc.relacion * 100, 1)} %`,
      7.5 * s, X(pc.d), Y(Math.max(pc.zEf, pc.los + pc.r1)), 'c', colPc));
  }
  dibujarRotulos(L, rotulos);

  // ---------- Banda inferior: resultados, planta y cajetín ----------
  const by0 = H - m - bandaInf, bh = bandaInf;
  L.color(20, 33, 42).grosor(0.35).linea(m, by0, W - m, by0);
  const anchoRes = (W - 2 * m) * 0.34, anchoPlanta = (W - 2 * m) * 0.27, anchoCaj = W - 2 * m - anchoRes - anchoPlanta;
  const xr = m, xpl = m + anchoRes, xc = xpl + anchoPlanta;
  L.linea(xpl, by0, xpl, H - m).linea(xc, by0, xc, H - m);
  // Resultados
  const filas = resumenPlano(c);
  const fs = 6.8 * s, lh = Math.min((bh - 9) / filas.length, 5.2 * s);
  L.texto(xr + 3, by0 + 5, 'RESULTADOS', 7.5 * s, { negrita: true });
  filas.forEach(([k, v], i) => {
    const y = by0 + 9 + lh * (i + 0.7);
    L.color(86, 101, 110, true).texto(xr + 3, y, k, fs);
    L.color(20, 33, 42, true).texto(xr + anchoRes - 3, y, recortar(v, fs, anchoRes * 0.6), fs, { negrita: true, alin: 'd' });
  });
  // Croquis de planta (UTM)
  const huso = aUTM(c.a.lat, c.a.lon).huso;
  const ua = aUTM(c.a.lat, c.a.lon, huso), ub = aUTM(c.b.lat, c.b.lon, huso);
  L.color(20, 33, 42, true).texto(xpl + 3, by0 + 5, `PLANTA · UTM ETRS89 huso ${huso} (EPSG:${epsgETRS89(huso)})`, 7.5 * s, { negrita: true });
  const cx0 = xpl + 6, cy0 = by0 + 9, cw = anchoPlanta - 12, ch = bh - 26;
  const ext = Math.max(Math.abs(ub.x - ua.x), Math.abs(ub.y - ua.y)) * 1.3 || 1;
  const esc = Math.min(cw, ch) / ext;
  const mxp = (ua.x + ub.x) / 2, myp = (ua.y + ub.y) / 2;
  const Xp = (x) => cx0 + cw / 2 + (x - mxp) * esc, Yp = (y) => cy0 + ch / 2 - (y - myp) * esc;
  L.color(214, 220, 218).grosor(0.15).rect(cx0, cy0, cw, ch);
  L.color(18, 87, 214).grosor(0.5).linea(Xp(ua.x), Yp(ua.y), Xp(ub.x), Yp(ub.y));
  L.color(18, 87, 214, true).circulo(Xp(ua.x), Yp(ua.y), 1.2, 'f');
  L.color(217, 72, 15, true).circulo(Xp(ub.x), Yp(ub.y), 1.2, 'f');
  L.color(20, 33, 42, true).texto(Xp(ua.x) + 2, Yp(ua.y) + 1, 'A', 7 * s, { negrita: true }).texto(Xp(ub.x) + 2, Yp(ub.y) + 1, 'B', 7 * s, { negrita: true });
  if (pc) { const up = aUTM(pc.lat, pc.lon, huso); L.color(198, 42, 58).grosor(0.3).circulo(Xp(up.x), Yp(up.y), 1.1); }
  // Flecha del norte
  L.color(20, 33, 42).grosor(0.3).linea(cx0 + cw - 4, cy0 + 9, cx0 + cw - 4, cy0 + 3).linea(cx0 + cw - 5.2, cy0 + 4.6, cx0 + cw - 4, cy0 + 3).linea(cx0 + cw - 2.8, cy0 + 4.6, cx0 + cw - 4, cy0 + 3);
  L.color(20, 33, 42, true).texto(cx0 + cw - 4, cy0 + 12.5, 'N', 6.5 * s, { negrita: true, alin: 'c' });
  L.color(86, 101, 110, true).texto(xpl + 3, H - m - 9, `A: X ${n(ua.x, 2)} · Y ${n(ua.y, 2)}`, 6.2 * s);
  L.texto(xpl + 3, H - m - 4, `B: X ${n(ub.x, 2)} · Y ${n(ub.y, 2)}`, 6.2 * s);
  // Cajetín
  const cf = [
    ['Proyecto', 'Radioenlace punto a punto'],
    ['Enlace', `${c.a.nombre || 'A'} – ${c.b.nombre || 'B'}`],
    ['Plano', 'Perfil longitudinal y planta'],
    ['Escalas', `H 1:${miles(eh)} · V 1:${miles(ev)} (×${exag})`],
    ['Formato', `${formato} apaisado · imprimir al 100 %`],
    ['Relieve', `${c.perfil.fuente.nombre.split(' (')[0]} · ${c.perfil.fuente.resolucion.split(/,\s/)[0]}`],
    ['Fecha', fecha.toLocaleDateString('es-ES')],
    ['Realizado por', '______________________________'],
  ];
  L.color(20, 33, 42, true).texto(xc + 3, by0 + 5, 'CAJETÍN', 7.5 * s, { negrita: true });
  const lhc = (bh - 20) / cf.length;
  cf.forEach(([k, v], i) => {
    const y = by0 + 9 + lhc * (i + 0.7);
    L.color(86, 101, 110, true).texto(xc + 3, y, k, fs);
    L.color(20, 33, 42, true).texto(xc + 26 * s, y, recortar(v, fs, anchoCaj - 26 * s - 4), fs, { negrita: i === 1 });
  });
  L.color(20, 33, 42).grosor(0.2).linea(xc, H - m - 10, W - m, H - m - 10);
  L.color(86, 101, 110, true).texto(xc + 3, H - m - 5.5, `${FIRMA} · © 2026 ${AUTOR}`, 5.6 * s);
  L.texto(xc + 3, H - m - 2, `${LICENCIA} · ${REGISTRO}`, 5.6 * s);
  return L.documento(`Perfil del radioenlace ${c.a.nombre || 'A'} – ${c.b.nombre || 'B'}`);
}
