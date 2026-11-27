/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// mapa.js — Mapa táctil ligero (sin librerías externas)
// Teselas en proyección Web Mercator (WMTS GoogleMapsCompatible / XYZ).
// Gestos: arrastrar para desplazar, pellizcar para ampliar, rueda del
// ratón, botones + y −. Tocar el mapa mueve el emplazamiento elegido (A o B)
// y solo ese marcador se puede arrastrar; con «Ninguno» no se mueve nada.
// Versión 1.3: capa del mapa de cobertura (imagen en latitud/longitud que
// se reproyecta a Web Mercator fila a fila), círculo del radio y píxel
// seleccionado.
// =====================================================================
const T = 256;

export function proyectar(lat, lon, z) {
  const s = T * Math.pow(2, z);
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return { x: ((lon + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}
export function desproyectar(x, y, z) {
  const s = T * Math.pow(2, z);
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lon: (x / s) * 360 - 180 };
}

const wmtsIGN = (servicio, capa, formato = 'image/jpeg') => (z, x, y) =>
  `https://www.ign.es/wmts/${servicio}?service=WMTS&request=GetTile&version=1.0.0&layer=${capa}` +
  `&style=default&tilematrixset=GoogleMapsCompatible&tilematrix=${z}&tilerow=${y}&tilecol=${x}&format=${formato}`;

export const CAPAS = [
  { id: 'ign-base', nombre: 'Mapa IGN', url: wmtsIGN('ign-base', 'IGNBaseTodo'), max: 19, atrib: '© Instituto Geográfico Nacional (IGN) · CNIG' },
  { id: 'mtn', nombre: 'Topográfico MTN', url: wmtsIGN('mapa-raster', 'MTN'), max: 17, atrib: 'MTN © Instituto Geográfico Nacional (IGN)' },
  { id: 'pnoa', nombre: 'Ortofoto PNOA', url: wmtsIGN('pnoa-ma', 'OI.OrthoimageCoverage'), max: 19, atrib: 'PNOA © Instituto Geográfico Nacional (IGN)' },
  { id: 'osm', nombre: 'OpenStreetMap', url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, max: 19, atrib: '© colaboradores de OpenStreetMap' },
];

export class Mapa {
  constructor(el, { centro, zoom = 11, alTocar, alArrastrarMarcador, alSoltarMarcador } = {}) {
    this.editable = null;  // id del único marcador que se puede arrastrar (null: ninguno)
    this.encuadrePendiente = null;
    this.el = el;
    this.centro = { ...centro };
    this.zoom = zoom;
    this.min = 5; this.max = 18;
    this.alTocar = alTocar;
    this.alArrastrarMarcador = alArrastrarMarcador;
    this.alSoltarMarcador = alSoltarMarcador;
    this.capa = CAPAS[0];
    this.teselas = new Map();
    this.marcadores = new Map();
    this.linea = null;     // [a, b]
    this.punto = null;     // punto crítico
    this.punteros = new Map();
    this.gesto = null;

    el.classList.add('mapa');
    el.innerHTML = `
      <div class="mapa-teselas"></div>
      <canvas class="mapa-cobertura" aria-hidden="true"></canvas>
      <svg class="mapa-capa-svg" aria-hidden="true"><path class="mapa-radio"/><path class="mapa-pixel"/><line class="mapa-linea"/><circle class="mapa-critico" r="7"/></svg>
      <div class="mapa-marcadores"></div>
      <div class="mapa-botones">
        <button type="button" class="mapa-btn" data-acc="mas" aria-label="Acercar">+</button>
        <button type="button" class="mapa-btn" data-acc="menos" aria-label="Alejar">−</button>
        <button type="button" class="mapa-btn" data-acc="encuadrar" aria-label="Ver el enlace completo" title="Ver el enlace completo">⤢</button>
      </div>
      <label class="mapa-selector"><span class="oculto">Capa del mapa</span>
        <select>${CAPAS.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
      </label>
      <div class="mapa-atrib"></div>`;
    this.capaTeselas = el.querySelector('.mapa-teselas');
    this.lienzo = el.querySelector('.mapa-cobertura');
    this.svgRadio = el.querySelector('.mapa-radio');
    this.svgPixel = el.querySelector('.mapa-pixel');
    this.cobertura = null;   // { imagen, norte, oeste, este, dlat, N, opacidad, visible, circulo }
    this.seleccion = null;   // { norte, sur, oeste, este } del píxel consultado
    this.svg = el.querySelector('svg');
    this.svgLinea = el.querySelector('.mapa-linea');
    this.svgCritico = el.querySelector('.mapa-critico');
    this.capaMarcadores = el.querySelector('.mapa-marcadores');
    this.atrib = el.querySelector('.mapa-atrib');
    el.querySelector('select').addEventListener('change', (e) => this.ponerCapa(e.target.value));
    el.querySelector('.mapa-botones').addEventListener('click', (e) => {
      const acc = e.target.closest('button')?.dataset.acc;
      if (acc === 'mas') this.ampliarEn(this.zoom + 1);
      if (acc === 'menos') this.ampliarEn(this.zoom - 1);
      if (acc === 'encuadrar' && this.linea) this.encuadrar(this.linea, 40);
    });
    el.querySelector('.mapa-botones').addEventListener('pointerdown', (e) => e.stopPropagation());
    el.querySelector('.mapa-selector').addEventListener('pointerdown', (e) => e.stopPropagation());

    el.addEventListener('pointerdown', (e) => this.#abajo(e));
    el.addEventListener('pointermove', (e) => this.#mover(e));
    el.addEventListener('pointerup', (e) => this.#arriba(e));
    el.addEventListener('pointercancel', (e) => this.#arriba(e, true));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.ampliarEn(this.zoom - Math.sign(e.deltaY) * 0.5, { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });
    // Evita el zoom de página por gestos en Safari
    el.addEventListener('gesturestart', (e) => e.preventDefault());
    new ResizeObserver(() => {
      // Un encuadre pedido con el mapa oculto (otra pestaña) se aplica al mostrarlo
      if (this.encuadrePendiente && el.clientWidth > 0) { const [p, m] = this.encuadrePendiente; this.encuadrePendiente = null; this.encuadrar(p, m); }
      else this.dibujar();
    }).observe(el);
    this.ponerCapa(this.capa.id);
  }

  ponerCapa(id) {
    this.capa = CAPAS.find((c) => c.id === id) || CAPAS[0];
    this.el.querySelector('select').value = this.capa.id;
    this.atrib.textContent = this.capa.atrib;
    for (const img of this.teselas.values()) img.remove();
    this.teselas.clear();
    this.dibujar();
  }

  // Coordenadas de pantalla (px dentro del mapa) ↔ geográficas
  aPantalla(p) {
    const c = proyectar(this.centro.lat, this.centro.lon, this.zoom);
    const q = proyectar(p.lat, p.lon, this.zoom);
    return { x: q.x - c.x + this.el.clientWidth / 2, y: q.y - c.y + this.el.clientHeight / 2 };
  }
  aGeo(x, y) {
    const c = proyectar(this.centro.lat, this.centro.lon, this.zoom);
    return desproyectar(c.x + x - this.el.clientWidth / 2, c.y + y - this.el.clientHeight / 2, this.zoom);
  }

  ampliarEn(z, foco) {
    z = Math.max(this.min, Math.min(this.max, z));
    const f = foco || { x: this.el.clientWidth / 2, y: this.el.clientHeight / 2 };
    const geo = this.aGeo(f.x, f.y);
    this.zoom = z;
    // mantener el punto del foco bajo el dedo
    const q = proyectar(geo.lat, geo.lon, z);
    this.centro = desproyectar(q.x - f.x + this.el.clientWidth / 2, q.y - f.y + this.el.clientHeight / 2, z);
    this.dibujar();
  }

  encuadrar(puntos, margen = 30) {
    if (!this.el.clientWidth) { this.encuadrePendiente = [puntos, margen]; return; }
    this.encuadrePendiente = null;
    const W = this.el.clientWidth, H = this.el.clientHeight || 300;
    let z = this.max;
    for (; z > this.min; z -= 0.25) {
      const ps = puntos.map((p) => proyectar(p.lat, p.lon, z));
      const ancho = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
      const alto = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
      if (ancho <= W - 2 * margen && alto <= H - 2 * margen - 40) break;
    }
    const ps = puntos.map((p) => proyectar(p.lat, p.lon, z));
    const cx = (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2;
    const cy = (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2;
    this.zoom = Math.min(z, 16);
    const zz = this.zoom;
    this.centro = desproyectar((cx * Math.pow(2, zz)) / Math.pow(2, z), (cy * Math.pow(2, zz)) / Math.pow(2, z), zz);
    this.dibujar();
  }

  // Marca qué marcador se puede arrastrar (A, B o null)
  ponerEditable(id) {
    this.editable = id;
    for (const [k, m] of this.marcadores) {
      m.el.classList.toggle('editable', k === id);
      m.el.classList.toggle('fijo', k !== id);
    }
  }

  ponerMarcador(id, pos, etiqueta) {
    let m = this.marcadores.get(id);
    if (!m) {
      const el = document.createElement('div');
      el.className = `mapa-marcador marcador-${id.toLowerCase()}`;
      el.dataset.id = id;
      el.innerHTML = `<span><b>${etiqueta}</b></span>`;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `Emplazamiento ${etiqueta}`);
      this.capaMarcadores.appendChild(el);
      m = { el, pos };
      this.marcadores.set(id, m);
      this.ponerEditable(this.editable);
    }
    m.pos = { ...pos };
    this.dibujar();
  }

  // Capa de cobertura: imagen N × N en latitud/longitud (fila 0 al norte)
  ponerCobertura(capa) { this.cobertura = capa; this.dibujar(); }
  ponerSeleccion(caja) { this.seleccion = caja; this.dibujar(); }

  ponerLinea(a, b) { this.linea = a && b ? [a, b] : null; this.dibujar(); }
  ponerPuntoCritico(p, clase) {
    this.punto = p ? { ...p, clase } : null;
    this.dibujar();
  }

  dibujar() {
    if (this.pendiente) return;
    this.pendiente = requestAnimationFrame(() => { this.pendiente = 0; this.#pintar(); });
  }

  #pintar() {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return;
    const zt = Math.max(0, Math.min(this.capa.max, Math.round(this.zoom)));
    const escala = Math.pow(2, this.zoom - zt);
    const c = proyectar(this.centro.lat, this.centro.lon, zt);
    const x0 = c.x - W / 2 / escala, y0 = c.y - H / 2 / escala;
    const n = Math.pow(2, zt);
    const usadas = new Set();
    const tam = T * escala;
    for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + H / escala) / T); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + W / escala) / T); tx++) {
        const txw = ((tx % n) + n) % n;
        const clave = `${zt}/${tx}/${ty}`;
        usadas.add(clave);
        let img = this.teselas.get(clave);
        if (!img) {
          img = new Image();
          img.className = 'tesela';
          img.alt = '';
          img.draggable = false;
          img.decoding = 'async';
          img.onload = () => img.classList.add('cargada');
          img.onerror = () => img.classList.add('error');
          img.src = this.capa.url(zt, txw, ty);
          this.teselas.set(clave, img);
          this.capaTeselas.appendChild(img);
        }
        const left = (tx * T - x0) * escala, top = (ty * T - y0) * escala;
        img.style.transform = `translate(${left}px,${top}px)`;
        img.style.width = img.style.height = `${tam + 0.5}px`;
      }
    }
    for (const [k, img] of this.teselas) if (!usadas.has(k)) { img.remove(); this.teselas.delete(k); }

    for (const m of this.marcadores.values()) {
      const p = this.aPantalla(m.pos);
      m.el.style.transform = `translate(${p.x}px,${p.y}px)`;
    }
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.#pintarCobertura(W, H);
    if (this.linea) {
      const a = this.aPantalla(this.linea[0]), b = this.aPantalla(this.linea[1]);
      Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }).forEach(([k, v]) => this.svgLinea.setAttribute(k, v));
      this.svgLinea.style.display = '';
    } else this.svgLinea.style.display = 'none';
    if (this.punto) {
      const p = this.aPantalla(this.punto);
      this.svgCritico.setAttribute('cx', p.x); this.svgCritico.setAttribute('cy', p.y);
      this.svgCritico.setAttribute('class', `mapa-critico ${this.punto.clase || ''}`);
      this.svgCritico.style.display = '';
    } else this.svgCritico.style.display = 'none';
  }

  #pintarCobertura(W, H) {
    const cap = this.cobertura, cv = this.lienzo;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ver = cap && cap.visible;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    cv.style.opacity = ver ? String(cap.opacidad) : '0';
    if (ver) {
      // Fila a fila con bordes enteros (sin huecos ni solapes). Si las filas
      // miden menos de 2 px en pantalla se dibuja la imagen de una vez: la
      // diferencia entre latitud lineal y Mercator es entonces menor de 1 px.
      ctx.imageSmoothingEnabled = false;
      const xo = Math.round(this.aPantalla({ lat: cap.norte, lon: cap.oeste }).x), xe = Math.round(this.aPantalla({ lat: cap.norte, lon: cap.este }).x);
      const y = (lat) => this.aPantalla({ lat, lon: cap.oeste }).y;
      const yN = y(cap.norte), yS = y(cap.norte - cap.N * cap.dlat);
      if ((yS - yN) / cap.N < 2) ctx.drawImage(cap.imagen, 0, 0, cap.N, cap.N, xo, Math.round(yN), xe - xo, Math.round(yS) - Math.round(yN));
      else {
        let yArriba = Math.round(yN);
        for (let r = 0; r < cap.N; r++) {
          const yAbajo = Math.round(y(cap.norte - (r + 1) * cap.dlat));
          if (yAbajo > yArriba && yAbajo >= 0 && yArriba <= H) ctx.drawImage(cap.imagen, 0, r, cap.N, 1, xo, yArriba, xe - xo, yAbajo - yArriba);
          yArriba = yAbajo;
        }
      }
    }
    const camino = (pts) => pts.map((p, i) => { const q = this.aPantalla(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join('') + 'Z';
    if (ver && cap.circulo) { this.svgRadio.setAttribute('d', camino(cap.circulo)); this.svgRadio.style.display = ''; }
    else this.svgRadio.style.display = 'none';
    const s = this.seleccion;
    if (s) {
      this.svgPixel.setAttribute('d', camino([{ lat: s.norte, lon: s.oeste }, { lat: s.norte, lon: s.este }, { lat: s.sur, lon: s.este }, { lat: s.sur, lon: s.oeste }]));
      this.svgPixel.style.display = '';
    } else this.svgPixel.style.display = 'none';
  }

  // ---------- Gestos ----------
  #local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  #abajo(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.#local(e);
    this.punteros.set(e.pointerId, p);
    const marcador = e.target.closest?.('.mapa-marcador');
    // Solo se arrastra el marcador elegido; sobre los demás el gesto desplaza el mapa
    const arrastrable = marcador && marcador.dataset.id === this.editable;
    if (this.punteros.size === 1) {
      this.gesto = { tipo: arrastrable ? 'marcador' : 'mover', id: marcador?.dataset.id, inicio: p, ultimo: p, t: Date.now(), movido: false };
    } else if (this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()];
      this.gesto = { tipo: 'pellizco', dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom, movido: true };
    }
    e.preventDefault();
  }

  #mover(e) {
    if (!this.punteros.has(e.pointerId) || !this.gesto) return;
    const p = this.#local(e);
    this.punteros.set(e.pointerId, p);
    const g = this.gesto;
    if (g.tipo === 'pellizco' && this.punteros.size >= 2) {
      const [a, b] = [...this.punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0) this.ampliarEn(g.zoom + Math.log2(d / g.dist), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return;
    }
    if (Math.hypot(p.x - g.inicio.x, p.y - g.inicio.y) > 6) g.movido = true;
    if (!g.movido) return;
    if (g.tipo === 'mover') {
      const c = proyectar(this.centro.lat, this.centro.lon, this.zoom);
      this.centro = desproyectar(c.x - (p.x - g.ultimo.x), c.y - (p.y - g.ultimo.y), this.zoom);
      g.ultimo = p;
      this.dibujar();
    } else if (g.tipo === 'marcador') {
      const geo = this.aGeo(p.x, p.y);
      this.marcadores.get(g.id).pos = geo;
      this.alArrastrarMarcador?.(g.id, geo);
      this.dibujar();
    }
  }

  #arriba(e, cancelado = false) {
    if (!this.punteros.has(e.pointerId)) return;
    this.punteros.delete(e.pointerId);
    const g = this.gesto;
    if (!g) return;
    if (this.punteros.size > 0) { // de pellizco a un dedo: seguir desplazando sin saltos
      const p = [...this.punteros.values()][0];
      this.gesto = { tipo: 'mover', inicio: p, ultimo: p, t: Date.now(), movido: true };
      return;
    }
    this.gesto = null;
    if (cancelado) return;
    const p = this.#local(e);
    if (g.tipo === 'marcador' && g.movido) this.alSoltarMarcador?.(g.id, this.aGeo(p.x, p.y));
    else if (!g.movido && Date.now() - g.t < 600) this.alTocar?.(this.aGeo(p.x, p.y), g.id);
  }
}
