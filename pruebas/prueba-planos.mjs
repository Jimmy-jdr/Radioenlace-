// Pruebas de la exportación de planos (PDF, DXF, KML).
// Ejecutar con:  node pruebas/prueba-planos.mjs [carpeta de salida]
import { writeFileSync, mkdirSync } from 'node:fs';
import * as R from '../js/radio.js';
import { obtenerModelo } from '../js/modelos.js';
import { construirPasos } from '../js/explicacion.js';
import { generarPDF, generarDXFPerfil, generarDXFPlanta, generarKML, nombrePlano } from '../js/planos.js';
import { filasInforme, aCSV } from '../js/informe.js';
import { evaluarEnlace } from '../js/veredicto.js';

const salida = process.argv[2] || '/tmp/planos';
mkdirSync(salida, { recursive: true });
let fallos = 0;
const cierto = (t, c) => { if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${t}`); };
const f = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));

// Perfil sintético: llano a 450 m con una loma gaussiana de altura «loma» a 40 % del trayecto
function contexto({ nombre, a, b, loma, fMHz, ptxW, g, h, sens, fuente, modeloId = 'espacio-libre' }) {
  const n = 301;
  const pts = R.puntosTrayecto(a, b, n);
  const D = R.distanciaKm(a, b) * 1000;
  const perfil = {
    puntos: pts.map((p, i) => ({ ...p, z: 450 + loma * Math.exp(-(((i / (n - 1)) - 0.4) ** 2) / 0.004), origen: 'mdt25' })),
    fuente: fuente || { id: 'mdt25', nombre: 'IGN MDT25 (Modelo Digital del Terreno, paso 25 m)', resolucion: '25 m (0,00025°), precisión altimétrica ≈ 1–2 m' },
    paso: D / (n - 1), avisos: [], faltan: 0, porFuente: { mdt25: n },
  };
  const e = { fValor: fMHz, fUnidad: 'MHz', fMHz, pValor: ptxW, pUnidad: 'W', ptxDbm: R.potenciaDbm(ptxW, 'W'), gtx: g, grx: g, ltx: 1, lrx: 1, sens, hA: h, hB: h, k: 4 / 3 };
  const dKm = R.distanciaKm(a, b);
  const modelo = obtenerModelo(modeloId);
  const resModelo = modelo.calcular({ dKm, fMHz, perfil: perfil.puntos, hA: h, hB: h, itm: { clima: 5, n0: 301, suelo: 'medio', pol: 'V', tiempo: 90 } });
  const pres = R.presupuesto({ ptxDbm: e.ptxDbm, gtx: g, grx: g, ltx: 1, lrx: 1, perdidaTrayecto: resModelo.perdida, sensibilidad: sens });
  const an = R.analizarPerfil({ perfil: perfil.puntos, hA: h, hB: h, fMHz, k: e.k });
  const dif = resModelo.incluyeTerreno ? null : R.difraccionObstaculoPrincipal(an, fMHz);
  const c = { e, a: { ...a, nombre: nombre[0] }, b: { ...b, nombre: nombre[1] }, dKm, modelo, resModelo, pres, an, perfil, dif };
  c.pasos = construirPasos(c, f);
  return c;
}

const casos = {
  obstruido: contexto({ nombre: ['Talavera centro', 'Cerro de las Cruces'], a: { lat: 39.96, lon: -4.832 }, b: { lat: 40.1541, lon: -4.7434 }, loma: 140, fMHz: 5800, ptxW: 0.5, g: 30, h: 15, sens: -80 }),
  despejado: contexto({ nombre: ['Emisor', 'Receptor'], a: { lat: 39.96, lon: -4.83 }, b: R.destino({ lat: 39.96, lon: -4.83 }, 90, 10), loma: 0, fMHz: 5000, ptxW: 20, g: 30, h: 30, sens: -90 }),
  itm: contexto({ nombre: ['Talavera centro', 'Cerro de las Cruces'], a: { lat: 39.96, lon: -4.832 }, b: { lat: 40.1541, lon: -4.7434 }, loma: 140, fMHz: 5800, ptxW: 0.5, g: 30, h: 15, sens: -80, modeloId: 'longley-rice' }),
};
const latin1 = (u8) => Array.from(u8, (b) => String.fromCharCode(b)).join('');

for (const [id, c] of Object.entries(casos)) {
  console.log(`\n— Caso ${id}: estado ${c.an.estado}, ${c.dif ? `ν = ${c.dif.nu.toFixed(3)}, J = ${c.dif.J.toFixed(2)} dB` : `Longley–Rice ${c.resModelo.perdida.toFixed(2)} dB (${c.resModelo.detalle.modoTexto})`}`);
  const ev = evaluarEnlace(c.pres, c.an, c.dif, undefined, c.resModelo);
  console.log(`  Evaluación: ${ev.nivel} · ${ev.titulo} · ${ev.texto}`);
  if (id === 'obstruido') {
    cierto('obstruido → estado «obstruido» y J > 6 dB', c.an.estado === 'obstruido' && c.dif.J > 6);
    cierto('obstruido → la evaluación no es «bien»', ev.nivel !== 'bien');
    cierto('pasos ν, J y margen corregido presentes', ['nu', 'difraccion', 'margendif'].every((k) => c.pasos.some((p) => p.id === k)));
    cierto('ν = −√2·c/r1', Math.abs(c.dif.nu + Math.SQRT2 * c.an.peor.relacion) < 1e-9);
  } else if (id === 'despejado') {
    cierto('despejado → J = 0 dB y evaluación «bien»', c.dif.J === 0 && ev.nivel === 'bien');
  } else {
    cierto('Longley–Rice → sin difracción P.526 sumada', c.dif === null && ev.J === 0 && ev.margenCorregido === c.pres.margen);
    cierto('Longley–Rice → pérdida mayor que en espacio libre y modo determinado', c.resModelo.perdida > R.perdidasEspacioLibre(c.dKm, c.e.fMHz) && [1, 2, 3].includes(c.resModelo.detalle.inter.mode));
    cierto('Longley–Rice → pasos del ITM presentes', ['itm-datos', 'itm-refractividad', 'itm-deltah', 'itm-horizontes', 'itm-aref', 'itm-afs', 'itm-variabilidad', 'perdida'].every((k) => c.pasos.some((p) => p.id === k)));
  }
  const csv = aCSV(filasInforme({ ...c, fecha: new Date(2026, 10, 26) }));
  cierto('CSV con evaluación global y nombre nuevo', csv.includes('Evaluación global') && csv.includes('Radioenlace PtP 1.2.0') && !csv.includes('PxP'));
  cierto('CSV con un único código de Safe Creative (el último)', csv.includes('2611267771473') && !csv.includes('2611257759054'));
  if (c.dif) cierto('CSV con difracción', csv.includes('Parámetro de difracción'));
  else cierto('CSV con los pasos de Longley–Rice', csv.includes('Irregularidad del terreno') && csv.includes('Atenuación de referencia') && !csv.includes('Parámetro de difracción'));
  writeFileSync(`${salida}/${id}_informe.csv`, csv);
  const pdfTxt = latin1(generarPDF(c, { formato: 'A4', exag: 10, fecha: new Date(2026, 10, 26) }));
  cierto('PDF: título con guion y sin «->»', pdfTxt.includes(`radioenlace ${c.a.nombre} \\226 ${c.b.nombre}`) && !/radioenlace [^)]*->/.test(pdfTxt));
  cierto('PDF: rótulos «mástil … · cota …» de A y B', ['A', 'B'].every((x) => new RegExp(`\\(${x} \\\\267 m\\\\341stil [\\d,]+ m \\\\267 cota [\\d,]+ m\\)`).test(pdfTxt)));
  cierto('PDF: nombre nuevo y un único registro', pdfTxt.includes('Radioenlace PtP 1.2.0') && pdfTxt.includes('2611267771473') && !pdfTxt.includes('PxP') && !pdfTxt.includes('2611257759054'));
  for (const formato of ['A4', 'A3']) for (const exag of [1, 10]) {
    const pdf = generarPDF(c, { formato, exag, fecha: new Date(2026, 10, 26) });
    writeFileSync(`${salida}/${id}_${formato}_x${exag}.pdf`, pdf);
  }
  const dxfP = generarDXFPerfil(c, 10), dxfU = generarDXFPlanta(c);
  writeFileSync(`${salida}/${id}_perfil.dxf`, dxfP);
  writeFileSync(`${salida}/${id}_planta.dxf`, dxfU);
  const kml = generarKML(c);
  writeFileSync(`${salida}/${id}.kml`, kml);
  cierto('DXF y KML con el nombre nuevo y el registro', [dxfP, dxfU, kml].every((t) => t.includes('Radioenlace PtP 1.2.0') && t.includes('2611267771473') && !t.includes('PxP')));
  cierto('DXF solo con ASCII', /^[\x0a\x20-\x7e]*$/.test(dxfP) && /^[\x0a\x20-\x7e]*$/.test(dxfU));
  cierto('DXF termina en EOF', dxfP.endsWith('EOF\n') && dxfU.endsWith('EOF\n'));
  // Pares código/valor: número de líneas par
  cierto('DXF con pares código/valor completos', dxfP.split('\n').length % 2 === 1 && dxfU.split('\n').length % 2 === 1);
}
console.log('\nNombre de ejemplo:', nombrePlano('plano', 'pdf', casos.obstruido.a, casos.obstruido.b, new Date(2026, 10, 26)));
console.log(fallos ? `\n${fallos} prueba(s) fallida(s)` : '\nTodas las pruebas de planos superadas');
process.exit(fallos ? 1 : 0);
