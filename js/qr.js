/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// qr.js — Generador de códigos QR (sin dependencias, versión 1.4)
//
// Implementación propia de la norma ISO/IEC 18004:2015 (QR Code model 2)
// para lo que necesita la app: modo byte (texto UTF-8), versiones 1 a 40,
// niveles de corrección L, M, Q y H, códigos Reed–Solomon sobre GF(2⁸)
// (polinomio x⁸ + x⁴ + x³ + x² + 1), las 8 máscaras con las 4 reglas de
// penalización, información de formato BCH(15,5) y de versión BCH(18,6).
// Se comprueba descodificando con un lector independiente (OpenCV) en
// verificacion/qr/ y en pruebas/prueba-qr.mjs.
// =====================================================================

// Nivel de corrección: bits de formato (tabla 12 de la norma) y % recuperable
export const NIVELES_QR = {
  L: { bits: 1, i: 0, texto: 'L · 7 %' },
  M: { bits: 0, i: 1, texto: 'M · 15 %' },
  Q: { bits: 3, i: 2, texto: 'Q · 25 %' },
  H: { bits: 2, i: 3, texto: 'H · 30 %' },
};

// Codewords de corrección por bloque y número de bloques (tabla 9 de la norma),
// por nivel [L, M, Q, H] y versión (índice 0 sin uso)
const ECC_POR_BLOQUE = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOQUES = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

// Módulos disponibles para datos y corrección (sin patrones ni formato/versión)
export function modulosDatos(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const na = Math.floor(v / 7) + 2;
    n -= (25 * na - 10) * na - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}
// Codewords de datos (sin corrección) de una versión y nivel
export function codewordsDatos(v, nivel) {
  const i = NIVELES_QR[nivel].i;
  return Math.floor(modulosDatos(v) / 8) - ECC_POR_BLOQUE[i][v] * BLOQUES[i][v];
}
// Bytes que caben en modo byte
export function capacidadBytes(v, nivel) {
  const bitsCuenta = v <= 9 ? 8 : 16;
  return Math.floor((codewordsDatos(v, nivel) * 8 - 4 - bitsCuenta) / 8);
}

// Posiciones de los centros de los patrones de alineamiento (anexo E)
export function posicionesAlineamiento(v) {
  if (v === 1) return [];
  const na = Math.floor(v / 7) + 2;
  const paso = Math.floor((v * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
  const r = [6];
  for (let p = v * 4 + 10; r.length < na; p -= paso) r.splice(1, 0, p);
  return r;
}

// ---------- Reed–Solomon en GF(2⁸), polinomio primitivo 0x11D ----------
function mulGF(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
// Polinomio generador de grado n: ∏ (x − αⁱ), i = 0…n−1 (coeficientes sin el término de mayor grado)
function divisorRS(n) {
  const r = new Array(n).fill(0);
  r[n - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      r[j] = mulGF(r[j], raiz);
      if (j + 1 < n) r[j] ^= r[j + 1];
    }
    raiz = mulGF(raiz, 0x02);
  }
  return r;
}
function restoRS(datos, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of datos) {
    const fac = b ^ r.shift();
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= mulGF(c, fac); });
  }
  return r;
}

// ---------- Máscaras (tabla 10) ----------
const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Penalización de una matriz (§ 7.8.3): reglas N1 = 3, N2 = 3, N3 = 40, N4 = 10
export function penalizacion(m) {
  const n = m.length;
  let p = 0;
  const filaCol = (k, esFila) => (i) => (esFila ? m[k][i] : m[i][k]);
  for (let k = 0; k < n; k++) {
    for (const esFila of [true, false]) {
      const g = filaCol(k, esFila);
      // Regla 1: 5 o más módulos seguidos del mismo color: 3 + (largo − 5)
      let largo = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && g(i) === g(i - 1)) largo++;
        else { if (largo >= 5) p += 3 + (largo - 5); largo = 1; }
      }
      // Regla 3: 1:1:3:1:1 (oscuro-claro-oscuro×3-claro-oscuro) con 4 claros a un lado
      for (let i = 0; i + 10 < n; i++) {
        const s = [];
        for (let j = 0; j < 11; j++) s.push(g(i + j) ? 1 : 0);
        const t = s.join('');
        if (t === '10111010000' || t === '00001011101') p += 40;
      }
    }
  }
  // Regla 2: bloques 2 × 2 del mismo color
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  // Regla 4: proporción de oscuros; 10 puntos por cada 5 % de desviación del 50 %
  let oscuros = 0;
  for (const fila of m) for (const c of fila) if (c) oscuros++;
  p += 10 * Math.floor(Math.abs((oscuros * 100) / (n * n) - 50) / 5);
  return p;
}

// ---------- Codificación ----------
// Devuelve { version, nivel, mascara, tam, modulos: boolean[tam][tam] }
export function codificarQR(texto, { nivel = 'M', versionMin = 1, mascara = null } = {}) {
  if (!NIVELES_QR[nivel]) throw new Error(`Nivel de corrección no válido: ${nivel}`);
  const bytes = [...new TextEncoder().encode(String(texto))];
  let v = Math.max(1, versionMin);
  while (v <= 40 && capacidadBytes(v, nivel) < bytes.length) v++;
  if (v > 40) throw new Error(`El texto es demasiado largo para un código QR (${bytes.length} bytes).`);
  const iN = NIVELES_QR[nivel].i;

  // 1) Flujo de bits: modo byte (0100), cuenta de caracteres y datos
  const bits = [];
  const poner = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poner(0b0100, 4);
  poner(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) poner(b, 8);
  const capBits = codewordsDatos(v, nivel) * 8;
  poner(0, Math.min(4, capBits - bits.length));          // terminador
  poner(0, (8 - (bits.length % 8)) % 8);                 // hasta completar el byte
  for (let relleno = 0xec; bits.length < capBits; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // 2) Bloques, corrección Reed–Solomon y entrelazado (§ 7.5 y 7.6)
  const nB = BLOQUES[iN][v], eccB = ECC_POR_BLOQUE[iN][v];
  const brutos = Math.floor(modulosDatos(v) / 8);
  const cortos = nB - (brutos % nB), largoCorto = Math.floor(brutos / nB);
  const divisor = divisorRS(eccB);
  const bloques = [];
  for (let i = 0, k = 0; i < nB; i++) {
    const n = largoCorto - eccB + (i < cortos ? 0 : 1);
    const dat = datos.slice(k, k + n);
    k += n;
    const ecc = restoRS(dat, divisor);
    if (i < cortos) dat.push(0);                         // hueco para alinear con los bloques largos
    bloques.push(dat.concat(ecc));
  }
  const flujo = [];
  for (let i = 0; i < bloques[0].length; i++) {
    for (let j = 0; j < nB; j++) if (i !== largoCorto - eccB || j >= cortos) flujo.push(bloques[j][i]);
  }

  // 3) Matriz: patrones fijos
  const tam = v * 4 + 17;
  const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fija = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijar = (x, y, osc) => { m[y][x] = osc; fija[y][x] = true; };
  for (let i = 0; i < tam; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }   // temporización
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {                         // localizadores + separadores
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= tam || y >= tam) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      fijar(x, y, d !== 2 && d !== 4);
    }
  }
  const al = posicionesAlineamiento(v);
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const ponerFormato = (msk) => {
    const d = (NIVELES_QR[nivel].bits << 3) | msk;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = (i) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(i));
    fijar(8, 7, bit(6)); fijar(8, 8, bit(7)); fijar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijar(tam - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijar(8, tam - 15 + i, bit(i));
    fijar(8, tam - 8, true);                             // módulo oscuro fijo
  };
  ponerFormato(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const osc = ((b >>> i) & 1) !== 0, a = tam - 11 + (i % 3), c = Math.floor(i / 3);
      fijar(a, c, osc); fijar(c, a, osc);
    }
  }

  // 4) Colocación de los codewords en zigzag (§ 7.7.3)
  // Los módulos que sobran al final (0, 3, 4 o 7 «remainder bits») quedan a 0 antes de la máscara
  let i = 0;
  const resto = [];
  for (let der = tam - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let vert = 0; vert < tam; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j, arriba = ((der + 1) & 2) === 0, y = arriba ? tam - 1 - vert : vert;
        if (fija[y][x]) continue;
        if (i < flujo.length * 8) { m[y][x] = ((flujo[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
        else resto.push([x, y]);
      }
    }
  }

  // 5) Máscara: la de menor penalización (o la pedida)
  const aplicar = (msk) => {
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fija[y][x] && MASCARAS[msk](x, y)) m[y][x] = !m[y][x];
  };
  let mejor = mascara;
  if (mejor == null) {
    let pMin = Infinity;
    for (let k = 0; k < 8; k++) {
      aplicar(k); ponerFormato(k);
      const pk = penalizacion(m);
      if (pk < pMin) { pMin = pk; mejor = k; }
      aplicar(k);                                         // deshace (XOR)
    }
  }
  aplicar(mejor); ponerFormato(mejor);
  return { version: v, nivel, mascara: mejor, tam, modulos: m, bytes: bytes.length, resto };
}

// ---------- Salida ----------
// SVG con zona de silencio de 4 módulos (§ 6.3.8)
export function qrSVG(qr, { margen = 4, modulo = 8, oscuro = '#000000', claro = '#ffffff' } = {}) {
  const n = qr.tam + 2 * margen, lado = n * modulo;
  let d = '';
  for (let y = 0; y < qr.tam; y++) for (let x = 0; x < qr.tam; x++) if (qr.modulos[y][x]) d += `M${x + margen},${y + margen}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${lado}" height="${lado}" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="${claro}"/><path d="${d}" fill="${oscuro}"/></svg>`;
}
