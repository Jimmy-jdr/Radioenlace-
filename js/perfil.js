/* Radioenlace PxP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// perfil.js — Gráfico del perfil del trayecto (SVG)
// Dibuja: relieve (con curvatura k), línea de visión, 1.ª zona de
// Fresnel, límite del 60 %, tramos invadidos, punto más comprometido y
// cotas que faltan. Al tocar o pasar el dedo muestra los valores.
// =====================================================================
const NS = 'http://www.w3.org/2000/svg';

function marcasBonitas(min, max, n) {
  const paso0 = (max - min) / Math.max(1, n);
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) || paso0;
  const out = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(+v.toFixed(6));
  return out;
}

export class GraficoPerfil {
  constructor(contenedor, formato) {
    this.c = contenedor;
    this.f = formato;
    this.c.classList.add('perfil');
    this.c.innerHTML = '<svg role="img" aria-label="Perfil del trayecto"></svg><div class="perfil-lectura" hidden></div><div class="perfil-vacio">Calculando perfil…</div>';
    this.svg = this.c.querySelector('svg');
    this.lectura = this.c.querySelector('.perfil-lectura');
    this.vacio = this.c.querySelector('.perfil-vacio');
    this.an = null;
    new ResizeObserver(() => this.dibujar()).observe(this.c);
    const mover = (e) => this.#leer(e);
    this.svg.addEventListener('pointermove', mover);
    this.svg.addEventListener('pointerdown', mover);
    this.svg.addEventListener('pointerleave', () => this.#ocultarLectura());
  }

  mensaje(texto) { this.vacio.textContent = texto; this.vacio.hidden = !texto; }

  // opciones.ocultar: modo ejercicio (no se señalan el punto crítico ni las invasiones)
  pintar(analisis, opciones = {}) { this.an = analisis; this.ocultar = !!opciones.ocultar; this.mensaje(''); this.dibujar(); }

  dibujar() {
    const an = this.an;
    const W = this.c.clientWidth, H = this.c.clientHeight;
    if (!an || !W || !H) return;
    const estrecho = W < 520;
    const m = { i: estrecho ? 44 : 56, d: 14, s: 26, b: 34 };
    const P = an.puntos;
    const D = an.D;
    let ymin = Infinity, ymax = -Infinity;
    for (const p of P) {
      if (p.zEf != null) { ymin = Math.min(ymin, p.zEf, p.z); ymax = Math.max(ymax, p.zEf); }
      ymin = Math.min(ymin, p.los - p.r1); ymax = Math.max(ymax, p.los + p.r1);
    }
    if (!isFinite(ymin)) { ymin = 0; ymax = 100; }
    const rango = Math.max(ymax - ymin, 10);
    ymin -= rango * 0.06; ymax += rango * 0.1;
    const X = (d) => m.i + (d / D) * (W - m.i - m.d);
    const Y = (z) => H - m.b - ((z - ymin) / (ymax - ymin)) * (H - m.s - m.b);
    this.escala = { X, Y, m, W, H, D };

    const partes = [];
    const ruta = (pts) => pts.map((q, k) => `${k ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('');

    // Rejilla y ejes
    const mx = marcasBonitas(0, D / 1000, estrecho ? 4 : 8);
    const my = marcasBonitas(ymin, ymax, estrecho ? 4 : 6);
    for (const v of my) partes.push(`<line class="malla" x1="${m.i}" x2="${W - m.d}" y1="${Y(v)}" y2="${Y(v)}"/><text class="eje-y" x="${m.i - 6}" y="${Y(v) + 4}">${this.f(v, 0)}</text>`);
    for (const v of mx) partes.push(`<line class="malla" y1="${m.s}" y2="${H - m.b}" x1="${X(v * 1000)}" x2="${X(v * 1000)}"/><text class="eje-x" x="${X(v * 1000)}" y="${H - m.b + 16}">${this.f(v, v % 1 ? 1 : 0)}</text>`);
    partes.push(`<text class="eje-titulo" x="${W - m.d}" y="${H - 4}" text-anchor="end">distancia (km)</text>`);
    partes.push(`<text class="eje-titulo" x="4" y="${m.s - 4}">cota (m)</text>`);

    // Tramos continuos con cota
    const tramos = [];
    let t = [];
    for (const p of P) { if (p.zEf == null) { if (t.length) tramos.push(t); t = []; } else t.push(p); }
    if (t.length) tramos.push(t);

    // Zona de Fresnel
    const sup = P.map((p) => [X(p.d), Y(p.los + p.r1)]);
    const inf = P.map((p) => [X(p.d), Y(p.los - p.r1)]).reverse();
    partes.push(`<path class="fresnel" d="${ruta([...sup, ...inf])}Z"/>`);

    // Relieve (con curvatura) y relieve sin curvatura
    for (const tr of tramos) {
      const arriba = tr.map((p) => [X(p.d), Y(p.zEf)]);
      partes.push(`<path class="terreno" d="${ruta([...arriba, [arriba[arriba.length - 1][0], H - m.b], [arriba[0][0], H - m.b]])}Z"/>`);
      partes.push(`<path class="terreno-borde" d="${ruta(arriba)}"/>`);
      if (an.flechaMedio > 0.05) partes.push(`<path class="terreno-plano" d="${ruta(tr.map((p) => [X(p.d), Y(p.z)]))}"/>`);
    }

    // Tramos donde el relieve invade el 60 %
    let inv = [];
    const cerrarInv = () => {
      if (inv.length > 1) {
        const a = inv.map((p) => [X(p.d), Y(Math.min(p.zEf, p.los + p.r1))]);
        const b = inv.map((p) => [X(p.d), Y(p.los - 0.6 * p.r1)]).reverse();
        partes.push(`<path class="invasion" d="${ruta([...a, ...b])}Z"/>`);
      } else if (inv.length === 1) {
        const p = inv[0];
        partes.push(`<line class="invasion-linea" x1="${X(p.d)}" x2="${X(p.d)}" y1="${Y(Math.min(p.zEf, p.los + p.r1))}" y2="${Y(p.los - 0.6 * p.r1)}"/>`);
      }
      inv = [];
    };
    if (!this.ocultar) {
      for (const p of P) {
        if (p.relacion != null && p.i > 0 && p.i < P.length - 1 && p.relacion < an.despejeMinimo) inv.push(p);
        else cerrarInv();
      }
      cerrarInv();
    }

    // 60 % y línea de visión
    partes.push(`<path class="limite60" d="${ruta(P.map((p) => [X(p.d), Y(p.los - 0.6 * p.r1)]))}"/>`);
    partes.push(`<path class="fresnel-borde" d="${ruta(sup)}"/><path class="fresnel-borde" d="${ruta(inf)}"/>`);
    partes.push(`<line class="los" x1="${X(0)}" y1="${Y(an.yA)}" x2="${X(D)}" y2="${Y(an.yB)}"/>`);

    // Mástiles
    const zA0 = P[0].zEf ?? an.zA, zB0 = P[P.length - 1].zEf ?? an.zB;
    partes.push(`<line class="mastil" x1="${X(0)}" x2="${X(0)}" y1="${Y(zA0)}" y2="${Y(an.yA)}"/><circle class="antena antena-a" cx="${X(0)}" cy="${Y(an.yA)}" r="6"/><text class="etiqueta-antena" x="${X(0) + 9}" y="${Y(an.yA) - 8}">A</text>`);
    partes.push(`<line class="mastil" x1="${X(D)}" x2="${X(D)}" y1="${Y(zB0)}" y2="${Y(an.yB)}"/><circle class="antena antena-b" cx="${X(D)}" cy="${Y(an.yB)}" r="6"/><text class="etiqueta-antena" x="${X(D) - 9}" y="${Y(an.yB) - 8}" text-anchor="end">B</text>`);

    // Cotas que faltan
    for (const p of P) if (p.zEf == null) partes.push(`<line class="falta" x1="${X(p.d)}" x2="${X(p.d)}" y1="${H - m.b - 7}" y2="${H - m.b}"/>`);

    // Punto más comprometido
    const k = this.ocultar ? null : an.peor;
    if (k) {
      const x = X(k.d), clase = an.estado;
      partes.push(`<line class="critico-linea ${clase}" x1="${x}" x2="${x}" y1="${Y(k.zEf)}" y2="${Y(k.los)}"/>`);
      partes.push(`<circle class="critico ${clase}" cx="${x}" cy="${Y(k.zEf)}" r="7"/>`);
      const texto = `Punto crítico · ${this.f(k.d / 1000, 2)} km · despeje ${this.f(k.relacion * 100, 0)} %`;
      const ancho = texto.length * 6.4 + 14;
      const lx = Math.min(Math.max(x - ancho / 2, m.i + 2), W - m.d - ancho - 2);
      const ly = Math.max(m.s + 2, Math.min(Y(k.zEf) + 14, H - m.b - 26));
      partes.push(`<g class="critico-rotulo ${clase}"><rect x="${lx}" y="${ly}" width="${ancho}" height="22" rx="11"/><text x="${lx + ancho / 2}" y="${ly + 15}" text-anchor="middle">${texto}</text></g>`);
    }
    partes.push(`<line class="cursor" y1="${m.s}" y2="${H - m.b}" x1="-10" x2="-10"/>`);

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.innerHTML = partes.join('');
    this.cursor = this.svg.querySelector('.cursor');
  }

  #leer(e) {
    if (!this.an || !this.escala) return;
    const r = this.svg.getBoundingClientRect();
    const { m, W, D } = this.escala;
    const x = e.clientX - r.left;
    const d = Math.max(0, Math.min(D, ((x - m.i) / (W - m.i - m.d)) * D));
    const P = this.an.puntos;
    const p = P[Math.round((d / D) * (P.length - 1))];
    const f = this.f;
    this.cursor?.setAttribute('x1', this.escala.X(p.d));
    this.cursor?.setAttribute('x2', this.escala.X(p.d));
    const filas = [
      ['Distancia desde A', `${f(p.d / 1000, 3)} km`],
      ['Cota del terreno', p.z == null ? 'sin dato' : `${f(p.z, 1)} m`],
      ['Curvatura (flecha)', `${f(p.flecha, 2)} m`],
      ['Línea de visión', `${f(p.los, 1)} m`],
      ['Radio r₁', `${f(p.r1, 2)} m`],
      ['Despeje', p.despeje == null ? '—' : `${f(p.despeje, 1)} m (${f((p.relacion ?? 0) * 100, 0)} % de r₁)`],
    ];
    if (this.ocultar) filas.splice(2);
    this.lectura.innerHTML = filas.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    this.lectura.hidden = false;
    const izq = x > W / 2;
    this.lectura.style.left = izq ? '' : `${Math.min(x + 12, W - 200)}px`;
    this.lectura.style.right = izq ? `${Math.min(W - x + 12, W - 200)}px` : '';
  }

  #ocultarLectura() {
    this.lectura.hidden = true;
    this.cursor?.setAttribute('x1', -10); this.cursor?.setAttribute('x2', -10);
  }
}
