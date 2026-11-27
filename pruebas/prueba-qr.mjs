// Pruebas del generador de códigos QR (versión 1.4): node pruebas/prueba-qr.mjs
// Valores de la norma ISO/IEC 18004:2015. La lectura con un descodificador
// independiente (OpenCV) está en verificacion/qr/comparar_qr.py.
import { codificarQR, capacidadBytes, posicionesAlineamiento, qrSVG } from '../js/qr.js';

let fallos = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (!c) fallos++; console.log(`${c ? 'OK   ' : 'FALLO'} ${n}${extra ? ` (${extra})` : ''}`); };

// Capacidad en modo byte (tabla 7)
const T7 = { 1: [17, 14, 11, 7], 6: [134, 106, 74, 58], 9: [230, 180, 130, 98], 10: [271, 213, 151, 119], 17: [644, 504, 364, 280], 27: [1465, 1125, 805, 625], 40: [2953, 2331, 1663, 1273] };
ok('Capacidad en modo byte = tabla 7 (versiones 1, 6, 9, 10, 17, 27 y 40)', Object.entries(T7).every(([v, c]) => ['L', 'M', 'Q', 'H'].every((n, i) => capacidadBytes(+v, n) === c[i])));
// Patrones de alineamiento (anexo E)
ok('Posiciones de alineamiento (anexo E): v2, v7, v32, v40',
  posicionesAlineamiento(2).join() === '6,18' && posicionesAlineamiento(7).join() === '6,22,38' &&
  posicionesAlineamiento(32).join() === '6,34,60,86,112,138' && posicionesAlineamiento(40).join() === '6,30,58,86,114,142,170');

// Información de formato (anexo C): lectura de los 15 bits junto al localizador superior izquierdo
const formato = (q) => {
  const pos = [...[0, 1, 2, 3, 4, 5].map((i) => [8, i]), [8, 7], [8, 8], [7, 8], ...[9, 10, 11, 12, 13, 14].map((i) => [14 - i, 8])];
  return pos.reduce((b, [x, y], i) => b | ((q.modulos[y][x] ? 1 : 0) << i), 0);
};
ok('Formato M, máscara 0 = 101010000010010 (anexo C)', formato(codificarQR('A', { nivel: 'M', mascara: 0 })) === 0b101010000010010);
ok('Formato L, máscara 0 = 111011111000100 (anexo C)', formato(codificarQR('A', { nivel: 'L', mascara: 0 })) === 0b111011111000100);
ok('Formato H, máscara 7 = 000100000111011 (anexo C)', formato(codificarQR('A', { nivel: 'H', mascara: 7 })) === 0b000100000111011);
// Información de versión (anexo D): versión 7 = 000111110010010100
{
  const q = codificarQR('x', { versionMin: 7 });
  let b = 0;
  for (let i = 0; i < 18; i++) b |= (q.modulos[Math.floor(i / 3)][q.tam - 11 + (i % 3)] ? 1 : 0) << i;
  ok('Versión 7: bits de versión = 0x07C94 (anexo D)', q.version === 7 && b === 0x07c94, b.toString(16));
}
// Estructura
{
  const q = codificarQR('https://jimmy-jdr.github.io/Radioenlace-/', { nivel: 'M' });
  const m = q.modulos, n = q.tam;
  const localizador = (x0, y0) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); if (m[y0 + y][x0 + x] !== (d !== 2)) return false; } return true; };
  ok('Dirección de la app: versión 3-M (29 × 29)', q.version === 3 && n === 29, `v${q.version}`);
  ok('Tres localizadores 7 × 7', localizador(0, 0) && localizador(n - 7, 0) && localizador(0, n - 7));
  ok('Patrones de temporización alternos', Array.from({ length: n - 16 }, (_, i) => i + 8).every((i) => m[6][i] === (i % 2 === 0) && m[i][6] === (i % 2 === 0)));
  ok('Módulo oscuro fijo (4·v + 9, 8)', m[n - 8][8] === true);
  const svg = qrSVG(q);
  ok('SVG con zona de silencio de 4 módulos', svg.startsWith('<svg') && svg.includes(`viewBox="0 0 ${n + 8} ${n + 8}"`));
  ok('Texto UTF-8 en bytes (ñ = 2 bytes)', codificarQR('ñ').bytes === 2);
  let error = '';
  try { codificarQR('x'.repeat(2954), { nivel: 'L' }); } catch (e) { error = e.message; }
  ok('Texto demasiado largo → error claro', /demasiado largo/.test(error));
  const enlaces = { '?g= (ejercicio)': 90, '?z= (enlace habitual)': 490, '?e= (sin compresión)': 762 };
  for (const [t, largo] of Object.entries(enlaces)) console.log(`      ${t}: ${largo} caracteres → versión ${codificarQR('h'.repeat(largo), { nivel: 'M' }).version}-M`);
}

console.log(`\n${fallos ? `${fallos} FALLOS de ${total}` : `Todas las pruebas del código QR superadas (${total})`}`);
process.exit(fallos ? 1 : 0);
