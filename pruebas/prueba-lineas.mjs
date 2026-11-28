// Pruebas de las pérdidas de línea y accesorios (versión 1.5).   Uso: node pruebas/prueba-lineas.mjs
import * as L from '../js/lineas.js';
import * as K from '../js/catalogo-lineas.js';

let fallos = 0, n = 0;
const ok = (nombre, cond, extra = '') => { n++; if (!cond) fallos++; console.log(`${cond ? 'OK   ' : 'FALLO'} ${nombre}${extra ? `  [${extra}]` : ''}`); };
const cerca = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

// 1. La app reproduce exactamente cada valor publicado en las tablas
let pts = 0, peor = 0;
for (const c of K.COAXIALES) {
  if (!c.puntos) continue;
  for (const p of c.puntos) {
    const pub = c.metodo === 'tabla-ft' ? p[1] / L.PIE : p[1];
    peor = Math.max(peor, Math.abs(L.atenuacionCoaxial(c, p[0]).dB100m - pub)); pts++;
  }
}
ok(`Coaxiales: ${pts} valores publicados reproducidos`, peor < 1e-12, `máx. ${peor}`);
pts = 0; peor = 0;
for (const g of K.ELIPTICAS) for (const p of g.puntos) { peor = Math.max(peor, Math.abs(L.atenuacionEliptica(g, p[0]).dB100m - p[1])); pts++; }
ok(`Guías elípticas: ${pts} valores publicados reproducidos`, peor < 1e-12, `máx. ${peor}`);

// 2. Las dos columnas de las fichas de ANDREW (dB/100 m y dB/100 ft) son coherentes (copia sin errores)
peor = 0;
for (const c of [...K.COAXIALES.filter((x) => x.metodo === 'tabla'), ...K.ELIPTICAS]) for (const p of c.puntos) peor = Math.max(peor, Math.abs(p[1] * L.PIE - p[2]));
ok('Columnas dB/100 m y dB/100 ft coherentes (redondeo de la ficha)', peor <= 0.0005 * (1 + 1 / L.PIE), peor.toFixed(4));

// 3. Times: fórmula frente a lecturas de la calculadora oficial (1 000 000 ft, dB)
const times = { 'LMR-195': [[100, 36517.46], [4900, 275559.61]], 'LMR-240': [[100, 24780], [4900, 187320]], 'LMR-400': [[100, 12613.89], [4900, 99326.43]], 'LMR-600': [[100, 7893.15], [4900, 66281.25]] };
for (const [id, lect] of Object.entries(times)) {
  for (const [f, v] of lect) ok(`Times ${id} a ${f} MHz = calculadora`, cerca(L.atenuacionCoaxial(L.coaxial(id), f).dB100m * L.PIE * 1e4, v, 0.006));
}
ok('LMR-400: 4,17 dB en 100 ft a 1 GHz', +(L.atenuacionCoaxial(L.coaxial('LMR-400'), 1000).dB100m * L.PIE).toFixed(2) === 4.17);

// 4. Guía rectangular TE10 frente a la tabla de cobre de Gabriel (±5 %; se obtiene < 0,5 %)
const GAB = [['WR-229', 3.3, 3.06], ['WR-187', 5, 3.38], ['WR-159', 6.1, 4.01], ['WR-137', 7.1, 5.36], ['WR-112', 8, 7.81], ['WR-90', 10, 10.82], ['WR-75', 12, 13.08], ['WR-62', 15, 16.82], ['WR-42', 22, 35.65]];
for (const [id, f, ref] of GAB) {
  const v = L.atenuacionRectangular(L.rectangular(id), 'cobre', f).dB100m;
  ok(`${id} a ${f} GHz: ${v.toFixed(2)} dB/100 m (Gabriel ${ref})`, Math.abs(v / ref - 1) < 0.005);
}
// Mi-Wave (dB/ft): WR-28 0,22–0,15 y WR-22 0,31–0,21 de la frecuencia más baja a la más alta
const pieDe = (id, f) => L.atenuacionRectangular(L.rectangular(id), 'cobre', f).dB100m * L.PIE / 100;
ok('WR-28: 0,22 y 0,15 dB/ft (Mi-Wave)', cerca(pieDe('WR-28', 26.5), 0.22, 0.01) && cerca(pieDe('WR-28', 40), 0.15, 0.01));
ok('WR-22 (dimensiones 0,224 × 0,112″): 0,31 y 0,21 dB/ft (Mi-Wave)', (() => { const g = { id: 'WR-22', a: 0.224, b: 0.112, banda: [33, 50] }; const a = (f) => L.atenuacionRectangular(g, 'cobre', f).dB100m * L.PIE / 100; return cerca(a(33), 0.31, 0.01) && cerca(a(50), 0.21, 0.01); })());

// 5. Avisos y límites
ok('WR-90 por debajo del corte (6,557 GHz): no propaga', !!L.atenuacionRectangular(L.rectangular('WR-90'), 'cobre', 6.5).error);
ok('WR-90 por encima de TE20 (13,11 GHz): deja de ser monomodo', !!L.atenuacionRectangular(L.rectangular('WR-90'), 'cobre', 13.2).error);
ok('WR-90 a 7 GHz: calcula y avisa de fuera de banda', (() => { const r = L.atenuacionRectangular(L.rectangular('WR-90'), 'cobre', 7); return r.dB100m > 0 && r.avisos.length === 1; })());
ok('EW77 a 9 GHz: fuera de banda', !!L.atenuacionEliptica(L.eliptica('EW77'), 9).error);
ok('EW77 a 8,45 GHz: prolonga dentro de la banda y avisa', (() => { const r = L.atenuacionEliptica(L.eliptica('EW77'), 8.45); return r.dB100m > 0 && r.avisos.length === 1; })());
ok('LMR-400 a 9 GHz: por encima de su frecuencia máxima', !!L.atenuacionCoaxial(L.coaxial('LMR-400'), 9000).error);
ok('RG-58 a 2,4 GHz: la ficha no da datos', !!L.atenuacionCoaxial(L.coaxial('RG-58'), 2400).error);
ok('LDF2-50 a 12,5 GHz: prolonga dentro de su banda y avisa', (() => { const r = L.atenuacionCoaxial(L.coaxial('LDF2-50'), 12500); return r.dB100m > 49.209 && r.avisos.length === 1; })());

// 6. Accesorios
const acc = (id, n, f, valor = null) => L.perdidaElemento({ tipo: 'accesorio', id, n, valor }, f).dB;
ok('Conector coaxial: 0,05·√f(GHz) (2 conectores a 4 GHz = 0,2 dB)', cerca(acc('conector', 2, 4000), 0.2, 1e-12));
ok('Valor propio de un accesorio sustituye al de catálogo', acc('ventana', 1, 8000, 0.05) === 0.05);
ok('Protector por encima de 7 GHz: aviso', L.perdidaElemento({ tipo: 'accesorio', id: 'protector', n: 1, valor: null }, 8000).avisos.length === 1);

// 7. Línea completa y datos guardados
const ln = { modo: 'calculada', elementos: [{ tipo: 'eliptica', modelo: 'EW77', longitud: 50 }, { tipo: 'accesorio', id: 'conector-ew', n: 2, valor: null }] };
ok('EW77, 50 m a 7,53 GHz + 2 conectores = 2,991 + 0,02 dB', cerca(L.perdidasLinea(ln, 7530).total, 5.982 / 2 + 0.02, 1e-12));
ok('Línea con un elemento fuera de banda: no válida', L.perdidasLinea(ln, 9000).valido === false);
ok('Datos sin línea (1.4): modo manual sin elementos', JSON.stringify(L.normalizarLinea(undefined)) === '{"modo":"manual","elementos":[]}');
const ida = L.normalizarLinea(JSON.parse(JSON.stringify({ modo: 'calculada', elementos: [{ tipo: 'propia', forma: 'k', k1: NaN, k2: 0.001, longitud: 5 }, { tipo: 'coaxial', modelo: 'NO-EXISTE', longitud: 3 }] })));
ok('JSON: k1 vacío sigue vacío y se descartan modelos desconocidos', Number.isNaN(ida.elementos[0].k1) && ida.elementos.length === 1);
for (const f of [150, 900, 2400, 3800, 5800, 7500, 11000, 18500, 22500]) {
  for (const c of ['exterior', 'interior', 'coaxial']) {
    if (c === 'coaxial' && f > 18000) continue;   // ningún coaxial del catálogo llega: se avisa
    const r = L.perdidasLinea({ elementos: L.configuracion(c, f) }, f);
    if (!r.valido) ok(`Configuración «${c}» a ${f} MHz calculable`, false);
  }
}
ok('Las configuraciones de partida se pueden calcular en las bandas habituales', true);
ok('Coaxial a 22,5 GHz: ningún cable del catálogo es adecuado (aviso en rojo)', L.perdidasLinea({ elementos: L.configuracion('coaxial', 22500) }, 22500).valido === false);

console.log(fallos ? `\n${fallos} de ${n} comprobaciones FALLAN` : `\nTodas las pruebas de pérdidas de línea superadas (${n})`);
process.exit(fallos ? 1 : 0);
