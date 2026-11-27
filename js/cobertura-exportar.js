/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// cobertura-exportar.js — Exportación del mapa de cobertura (sin DOM)
//   · KMZ (Google Earth): un .kml no puede llevar la imagen dentro, así que
//     se empaqueta en un ZIP (.kmz) con doc.kml, la imagen de la cobertura
//     (GroundOverlay en latitud/longitud, como la propia malla) y la leyenda
//     (ScreenOverlay). ZIP «almacenado» (sin compresión) con CRC-32.
//   · CSV: una fila por píxel dentro del radio, con el mismo formato que los
//     demás CSV de la app (UTF-8 con BOM, «;», coma decimal).
// La imagen PNG se dibuja en cobertura-ui.js (necesita un canvas).
// =====================================================================
import { num, aCSV } from './informe.js';
import { aUTM, husoUTM, epsgETRS89 } from './utm.js';
import { rumbo, destino } from './radio.js';
import { NOMBRE, VERSION, AUTOR, LICENCIA, REGISTRO } from './version.js';
import { CLIMAS, SUELOS } from './itm.js';
import { BANDAS, bandaDe, PIXEL, TEXTO_ESTADO } from './cobertura.js';

export { aCSV };
const FIRMA = `${NOMBRE} ${VERSION}`;
const n = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ',').replace('-', '−'));
const xml = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
const MODOS = { 0: '', 1: 'línea de visión', 2: 'difracción', 3: 'dispersión troposférica' };

// ---------- ZIP mínimo (método 0, «store») ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
export function crc32(datos) {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function crearZip(archivos, fecha = new Date()) {
  const enc = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const partes = [], central = [];
  let pos = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre), d = a.datos, crc = crc32(d);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); // UTF-8
    cab.setUint16(8, 0, true); cab.setUint16(10, hora, true); cab.setUint16(12, dia, true);
    cab.setUint32(14, crc, true); cab.setUint32(18, d.length, true); cab.setUint32(22, d.length, true);
    cab.setUint16(26, nombre.length, true); cab.setUint16(28, 0, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, dia, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, d.length, true); cen.setUint32(24, d.length, true);
    cen.setUint16(28, nombre.length, true); cen.setUint32(42, pos, true);
    partes.push(new Uint8Array(cab.buffer), nombre, d);
    central.push(new Uint8Array(cen.buffer), nombre);
    pos += 30 + nombre.length + d.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let k = 0;
  for (const x of todo) { out.set(x, k); k += x.length; }
  return out;
}

// ---------- Datos del cálculo (comunes a KMZ, CSV y PNG) ----------
// meta = { params, malla, res, fecha, nombreA, modeloNombre, resumen, avisos }
export function lineasParametros(meta) {
  const { params: p, malla } = meta;
  const itm = p.modelo === 'longley-rice';
  const l = [
    ['Transmisor (A)', `${meta.nombreA || 'A'} · ${n(p.a.lat, 6)}°, ${n(p.a.lon, 6)}° (ETRS89) · antena a ${n(p.hA, 1)} m`],
    ['Frecuencia', p.fMHz >= 1000 ? `${n(p.fMHz / 1000, 3)} GHz` : `${n(p.fMHz, 1)} MHz`],
    ['Potencia · ganancia · pérdidas en A', `${n(p.ptxDbm, 2)} dBm · ${n(p.gtx, 2)} dBi · ${n(p.ltx, 2)} dB (PIRE ${n(p.ptxDbm - p.ltx + p.gtx, 2)} dBm)`],
    ['Receptor en cada píxel', `antena a ${n(p.rx.h, 1)} m · ${n(p.rx.g, 2)} dBi orientada hacia A · pérdidas ${n(p.rx.l, 2)} dB · sensibilidad ${n(p.sens, 1)} dBm`],
    ['Modelo', itm
      ? `${meta.modeloNombre} · clima ${p.itm.clima} (${CLIMAS[p.itm.clima].toLowerCase()}) · N₀ ${p.itm.n0} · ${SUELOS[p.itm.suelo].nombre.toLowerCase()} · polarización ${p.itm.pol === 'V' ? 'vertical' : 'horizontal'} · ${n(p.itm.tiempo, Number.isInteger(p.itm.tiempo) ? 0 : 1)} % del tiempo`
      : `${meta.modeloNombre} + difracción del obstáculo principal (UIT-R P.526) · k = ${Number.isFinite(p.k) ? n(p.k, 3) : '∞'}`],
    ['Relieve', p.terreno === 'plano' ? 'terreno plano teórico (cota 0 m)' : 'MDT25 del IGN/CNIG por teselas fijas; respaldo Copernicus GLO-90'],
    ['Malla', `radio ${p.radioKm} km · ${malla.N} × ${malla.N} píxeles de ${n(malla.s, 0)} m · un perfil propio desde A hasta el centro de cada píxel`],
  ];
  if (meta.resumen) {
    const s = meta.resumen;
    l.push(['Píxeles', `${s.calculados} calculados (${s.conServicio} con servicio, ${s.sinServicio} por debajo de la sensibilidad) · ${s.faltan + s.modelo + s.cerca} sin cálculo`]);
  }
  return l;
}
export function textoBandas(sens) {
  return [
    ...BANDAS.map((b) => [b.color, `${b.max === Infinity ? `≥ ${b.min}` : `${b.min}–${b.max}`} dB · ${b.max === Infinity ? `≥ ${n(sens + b.min, 0)}` : `${n(sens + b.min, 0)} a ${n(sens + b.max, 0)}`} dBm`]).reverse(),
    [null, `por debajo de la sensibilidad (< ${n(sens, 0)} dBm)`],
  ];
}

// ---------- KML del KMZ ----------
export function kmlCobertura(meta, { imagen = 'cobertura.png', leyenda = 'leyenda.png' } = {}) {
  const { params: p, malla } = meta;
  const desc = lineasParametros(meta).map(([k, v]) => `${k}: ${v}`).join('\n');
  const circulo = [];
  for (let g = 0; g <= 360; g += 3) { const q = destino(p.a, g, p.radioKm); circulo.push(`${q.lon.toFixed(7)},${q.lat.toFixed(7)},0`); }
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${xml(`Cobertura desde ${meta.nombreA || 'A'} (${p.radioKm} km)`)}</name>
  <description>${xml(`Generado con ${FIRMA} · ${AUTOR} · ${LICENCIA} · Safe Creative ${REGISTRO}\n${meta.fecha.toLocaleString('es-ES')}\n\n${desc}\n\nColores: margen sobre la sensibilidad. Cada píxel es el resultado punto a punto con el receptor en su centro.`)}</description>
  <Style id="sitioA"><IconStyle><color>ffd65712</color><scale>1.2</scale></IconStyle></Style>
  <Style id="radio"><LineStyle><color>ccffffff</color><width>2</width></LineStyle></Style>
  <GroundOverlay>
    <name>Mapa de cobertura</name>
    <color>bfffffff</color>
    <Icon><href>${imagen}</href></Icon>
    <LatLonBox>
      <north>${malla.norte.toFixed(7)}</north>
      <south>${malla.sur.toFixed(7)}</south>
      <east>${malla.este.toFixed(7)}</east>
      <west>${malla.oeste.toFixed(7)}</west>
    </LatLonBox>
  </GroundOverlay>
  <ScreenOverlay>
    <name>Leyenda</name>
    <Icon><href>${leyenda}</href></Icon>
    <overlayXY x="0" y="0" xunits="fraction" yunits="fraction"/>
    <screenXY x="12" y="40" xunits="pixels" yunits="pixels"/>
    <size x="0" y="0" xunits="pixels" yunits="pixels"/>
  </ScreenOverlay>
  <Placemark><name>${xml(`A · ${meta.nombreA || 'A'}`)}</name><styleUrl>#sitioA</styleUrl>
    <description>${xml(`Latitud ${n(p.a.lat, 6)}°, longitud ${n(p.a.lon, 6)}° (ETRS89)\nAltura de antena ${n(p.hA, 1)} m`)}</description>
    <Point><altitudeMode>relativeToGround</altitudeMode><coordinates>${p.a.lon.toFixed(7)},${p.a.lat.toFixed(7)},${p.hA.toFixed(1)}</coordinates></Point></Placemark>
  <Placemark><name>${xml(`Radio de ${p.radioKm} km`)}</name><styleUrl>#radio</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>${circulo.join(' ')}</coordinates></LineString></Placemark>
</Document>
</kml>
`;
}

// ---------- CSV ----------
export function filasCSV(meta) {
  const { params: p, malla, res } = meta;
  const N = malla.N;
  const huso = husoUTM(p.a.lon);
  const filas = [];
  const cab = (a, b) => { const r = [a, b]; r.numericas = []; filas.push(r); };
  cab('Mapa de cobertura', `${FIRMA} · ${AUTOR} · ${LICENCIA} · Safe Creative ${REGISTRO}`);
  cab('Fecha', meta.fecha.toLocaleString('es-ES'));
  for (const [k, v] of lineasParametros(meta)) cab(k, v);
  for (const a of meta.avisos || []) cab('Aviso', a);
  cab('Coordenadas UTM', `ETRS89, huso ${huso} (EPSG:${epsgETRS89(huso)}) para todos los píxeles`);
  const vacia = []; vacia.numericas = []; filas.push(vacia);
  const t = ['fila', 'columna', 'latitud (°)', 'longitud (°)', 'X UTM (m)', 'Y UTM (m)', 'distancia (km)', 'rumbo desde A (°)',
    'cota (m)', 'pérdida total (dB)', 'difracción J (dB)', 'nivel recibido (dBm)', 'margen (dB)', 'banda de margen', 'modo ITM', 'avisos ITM', 'con cotas de Copernicus', 'estado'];
  t.numericas = [];
  filas.push(t);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c, e = res.estado[i];
      if (e === PIXEL.FUERA) continue;
      const lat = malla.latC[r], lon = malla.lonC[c];
      const u = aUTM(lat, lon, huso);
      const okp = e === PIXEL.OK;
      const b = okp ? bandaDe(res.margen[i]) : null;
      const fila = [r + 1, c + 1, num(lat, 6), num(lon, 6), num(u.x, 2), num(u.y, 2), num(res.dKm[i], 4), num(rumbo(p.a, { lat, lon }), 2),
        okp ? num(res.cota[i], 2) : '', okp ? num(res.perdida[i], 2) : '', okp ? num(res.J[i], 2) : '', okp ? num(res.prx[i], 2) : '', okp ? num(res.margen[i], 2) : '',
        okp ? (b < 0 ? 'por debajo de la sensibilidad' : `${BANDAS[b].min}${BANDAS[b].max === Infinity ? ' o más' : `–${BANDAS[b].max}`} dB`) : '',
        okp && res.modo[i] ? MODOS[res.modo[i]] : '', okp && res.modo[i] ? `0x${res.avisos[i].toString(16).padStart(4, '0')}` : '',
        okp ? (res.cop[i] ? 'sí' : 'no') : '', TEXTO_ESTADO[e]];
      fila.numericas = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      fila.pixel = { r, c, estado: e };
      filas.push(fila);
    }
  }
  return filas;
}

export function nombreCobertura(ext, nombreA, radioKm, fecha = new Date()) {
  const limpio = (nombreA || 'A').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'A';
  const d = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `radioenlace_cobertura_${limpio}_${radioKm}km_${d}.${ext}`;
}
