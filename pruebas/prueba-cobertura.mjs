// Pruebas de los mapas de cobertura (versión 1.3): node pruebas/prueba-cobertura.mjs
// Red simulada (WCS del IGN y Open-Meteo) para que sea reproducible sin conexión.
// Comprueba que cada píxel da EXACTAMENTE (===) lo mismo que el cálculo punto a
// punto de la app con B en el centro del píxel, por el mismo camino que app.js:
// obtenerPerfil → modelo.calcular → presupuesto → analizarPerfil → difracción → evaluarEnlace.
import * as R from '../js/radio.js';
import { obtenerPerfil, FUENTES, cajaTesela, urlTesela, teselaDe, teselasDePuntos, bloqueDe, urlBloque, puntosPerfil } from '../js/terreno.js';
import { obtenerModelo, ITM_DEFECTO } from '../js/modelos.js';
import { evaluarEnlace } from '../js/veredicto.js';
import * as C from '../js/cobertura.js';
import * as X from '../js/cobertura-exportar.js';

let fallos = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${n}${extra ? ` (${extra})` : ''}`); };

import { instalarRedSimulada, peticiones, fallo } from './red-simulada.mjs';
instalarRedSimulada();

// ---------- 1. Teselas fijas ----------
{
  const f = FUENTES.mdt25;
  const [o, s, e, n] = cajaTesela(f, -96, 800);
  ok('Tesela MDT25: bordes en múltiplos de la celda', [o, s, e, n].every((x) => Math.abs(x / f.celda - Math.round(x / f.celda)) < 1e-6));
  ok('Tesela MDT25: 204 × 204 celdas exactas', Math.round((e - o) / f.celda) === 204 && Math.round((n - s) / f.celda) === 204);
  const url = urlTesela(f, '-96,800');
  ok('Tesela MDT25: URL fija', url.includes('bbox=-4.800500,39.999500,-4.749500,40.050500') && url.includes('width=204&height=204'), url.split('bbox=')[1].split('&')[0]);
  ok('Tesela dueña de un punto', teselaDe(f, 40.01, -4.77).join(',') === '-96,800');
  const b = urlBloque(bloqueDe(40.01, -4.97).join(','));
  ok('Bloque de Copernicus: 100 nodos de 3″', new URL(b).searchParams.get('latitude').split(',').length === 100);
}

// ---------- 2. La cota de un punto no depende del trayecto ----------
{
  const P = { lat: 40.0731, lon: -4.8123 };
  const p1 = await obtenerPerfil({ lat: 40.0, lon: -4.9 }, P);
  const p2 = await obtenerPerfil({ lat: 40.2, lon: -4.6 }, P);
  const z1 = p1.puntos.at(-1).z, z2 = p2.puntos.at(-1).z;
  ok('Misma cota en B por dos trayectos distintos', z1 === z2 && z1 != null, `${z1} m`);
  const p3 = await obtenerPerfil({ lat: 40.0, lon: -4.9 }, { lat: 40.0, lon: -5.02 });
  ok('Fuera del IGN se completa con Copernicus (malla de 3″)', p3.porFuente.copernicus > 0 && !p3.faltan, JSON.stringify(p3.porFuente));
}

// ---------- 3. Píxel = punto a punto ----------
async function puntoAPunto(params, b) {
  const a = params.a;
  const p = await obtenerPerfil(a, b, { modo: params.terreno === 'plano' ? 'plano' : 'ign' });
  const dKm = R.distanciaKm(a, b);
  const modelo = obtenerModelo(params.modelo);
  const e = { fMHz: params.fMHz, hA: params.hA, hB: params.rx.h, k: params.k };
  const res = modelo.calcular({ dKm, fMHz: e.fMHz, perfil: p.puntos, hA: e.hA, hB: e.hB, itm: params.itm });
  const pres = R.presupuesto({ ptxDbm: params.ptxDbm, gtx: params.gtx, grx: params.rx.g, ltx: params.ltx, lrx: params.rx.l, perdidaTrayecto: res.perdida, sensibilidad: params.sens });
  const an = R.analizarPerfil({ perfil: p.puntos, hA: e.hA, hB: e.hB, fMHz: e.fMHz, k: e.k });
  const dif = res.incluyeTerreno ? null : R.difraccionObstaculoPrincipal(an, e.fMHz);
  const ev = evaluarEnlace(pres, an, dif, undefined, res);
  return { prx: pres.prx - ev.J, margen: ev.margenCorregido, perdida: res.perdida + ev.J, res, faltan: p.faltan, z: p.puntos.at(-1).z };
}

const BASE = {
  a: { lat: 40.054321, lon: -4.912345 }, terreno: 'ign', fMHz: 5800, ptxDbm: R.wADbm(0.5), gtx: 30, ltx: 1.5, hA: 20,
  sens: -80, k: 4 / 3, rx: { h: 10, g: 30, l: 1.5 }, modelo: 'longley-rice', itm: { ...ITM_DEFECTO }, radioKm: 5, N: 40,
};
const casos = [
  ['ITM, 5,8 GHz, mitad fuera del IGN', BASE],
  ['ITM al 99 %, 2,4 GHz, receptor propio 1,5 m / 0 dBi', { ...BASE, fMHz: 2400, itm: { ...ITM_DEFECTO, tiempo: 99, clima: 6 }, rx: { h: 1.5, g: 0, l: 0 } }],
  ['Espacio libre + P.526, k = 4/3', { ...BASE, modelo: 'espacio-libre' }],
  ['Espacio libre + P.526, k = 2/3', { ...BASE, modelo: 'espacio-libre', k: 2 / 3, a: { lat: 40.1, lon: -4.78 } }],
  ['Terreno plano teórico (ITM)', { ...BASE, terreno: 'plano' }],
];
casos.push(['ITM con Copernicus caído (píxeles sin cotas)', { ...BASE, a: { lat: 40.031, lon: -4.92 }, falloOM: true }]);
casos.push(['ITM con la antena A fuera de rango (0,3 m)', { ...BASE, hA: 0.3, radioKm: 5, N: 20 }]);
for (const [nombre, params] of casos) {
  fallo.om = !!params.falloOM;
  const malla = C.definirMalla(params);
  const rel = await C.prepararRelieve(params, malla);
  // Simula el paso al Web Worker (copia estructurada del almacén)
  const alm = C.almacenDeMensaje(structuredClone(C.almacenAMensaje(rel.alm)));
  const res = await C.calcularEnHilo(params, malla, alm);
  const s = C.resumen(res);
  const esperaVacio = params.hA < 0.5;
  ok(`${nombre}: mapa calculado`, esperaVacio ? s.modelo > 0 && s.calculados === 0 : s.calculados > 0 && (!params.falloOM || s.faltan > 0), `${s.calculados} píxeles, ${s.conServicio} con servicio, ${s.conCopernicus} con Copernicus, ${s.faltan + s.modelo + s.cerca} sin cálculo`);
  let comparados = 0, distintos = 0, ejemplo = '';
  const N = malla.N;
  for (let i = 0; i < N * N; i += 7) {
    if (res.estado[i] !== C.PIXEL.OK) continue;
    const r = Math.floor(i / N), c = i % N;
    const p = await puntoAPunto(params, { lat: malla.latC[r], lon: malla.lonC[c] });
    comparados++;
    if (p.prx !== res.prx[i] || p.margen !== res.margen[i] || p.perdida !== res.perdida[i] || p.z !== res.cota[i]) {
      distintos++; if (!ejemplo) ejemplo = `píxel ${r},${c}: ${p.prx} frente a ${res.prx[i]}`;
    }
  }
  ok(`${nombre}: píxeles idénticos al punto a punto (===)`, (esperaVacio || comparados > 20) && distintos === 0, `${comparados} comparados${ejemplo ? `; ${ejemplo}` : ''}`);
  // Los píxeles sin cálculo son exactamente aquellos en los que el punto a punto no puede usar el modelo
  let incoherentes = 0;
  for (let i = 3; i < N * N; i += 37) {
    const e = res.estado[i];
    if (e !== C.PIXEL.FALTAN && e !== C.PIXEL.MODELO) continue;
    const r = Math.floor(i / N), c = i % N;
    const p = await puntoAPunto(params, { lat: malla.latC[r], lon: malla.lonC[c] });
    if (!(p.faltan > 0 || p.res.aviso)) incoherentes++;
  }
  ok(`${nombre}: píxeles sin cálculo coherentes`, incoherentes === 0);
}
fallo.om = false;

// ---------- 4. Malla ----------
{
  const m = C.definirMalla({ ...BASE, radioKm: 10, N: 200 });
  ok('Malla 200 × 200 para 10 km: píxel de 100 m', Math.abs(m.s - 100) < 1e-9);
  const dy = R.distanciaKm({ lat: m.latC[100], lon: m.lonC[100] }, { lat: m.latC[101], lon: m.lonC[100] }) * 1000;
  const dx = R.distanciaKm({ lat: m.latC[100], lon: m.lonC[100] }, { lat: m.latC[100], lon: m.lonC[101] }) * 1000;
  ok('Píxeles cuadrados sobre el terreno', Math.abs(dy - 100) < 0.2 && Math.abs(dx - 100) < 0.2, `${dx.toFixed(2)} × ${dy.toFixed(2)} m`);
  ok('A en una esquina de píxel (ningún centro en A)', C.pixelDe(m, BASE.a.lat + m.dlat * 0.4, BASE.a.lon + m.dlon * 0.4).r === 99);
  ok('Centros redondeados a 6 decimales', [...m.latC, ...m.lonC].every((x) => +x.toFixed(6) === x));
  ok('Bandas de margen', [C.bandaDe(-0.1), C.bandaDe(0), C.bandaDe(9.99), C.bandaDe(10), C.bandaDe(35)].join() === '-1,0,0,1,3');
}

// ---------- 5. Exportaciones ----------
{
  const crc = X.crc32(new TextEncoder().encode('123456789'));
  ok('CRC-32 (valor de comprobación 0xCBF43926)', crc === 0xcbf43926, crc.toString(16));
  const zip = X.crearZip([{ nombre: 'doc.kml', datos: new TextEncoder().encode('<kml/>') }, { nombre: 'a.png', datos: new Uint8Array([1, 2, 3]) }]);
  const dv = new DataView(zip.buffer);
  ok('ZIP: firma local y directorio central', dv.getUint32(0, true) === 0x04034b50 && dv.getUint32(zip.length - 22, true) === 0x06054b50 && dv.getUint16(zip.length - 12, true) === 2);
  const params = BASE, malla = C.definirMalla(params);
  const rel = await C.prepararRelieve(params, malla);
  const res = await C.calcularEnHilo(params, malla, rel.alm);
  const meta = { params, malla, res, fecha: new Date(2026, 10, 27), nombreA: 'Prueba', modeloNombre: 'Longley–Rice', resumen: C.resumen(res), avisos: [] };
  const kml = X.kmlCobertura(meta);
  ok('KML: GroundOverlay con LatLonBox de la malla', kml.includes('<GroundOverlay>') && kml.includes(`<north>${malla.norte.toFixed(7)}</north>`) && kml.includes('<ScreenOverlay>'));
  const filas = X.filasCSV(meta);
  const s = C.resumen(res);
  const datos = filas.filter((f) => f.pixel);
  ok('CSV: una fila por píxel dentro del radio', datos.length === s.calculados + s.faltan + s.modelo + s.cerca, `${datos.length} filas`);
  const f0 = datos.find((f) => f.pixel.estado === C.PIXEL.OK);
  const i0 = f0.pixel.r * malla.N + f0.pixel.c;
  ok('CSV: valores con coma decimal y nivel recibido exacto a 0,01', f0.includes(res.prx[i0].toFixed(2).replace('.', ',').replace('-', '-')));
}

console.log(`\n${fallos ? `${fallos} de ${total} pruebas FALLIDAS` : `Todas las pruebas de cobertura superadas (${total})`}`);
console.log(`Peticiones simuladas: ${peticiones.ign} al IGN, ${peticiones.om} a Open-Meteo`);
process.exit(fallos ? 1 : 0);
