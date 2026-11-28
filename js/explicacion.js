/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// explicacion.js — Cálculos paso a paso (fórmula, sustitución, unidades)
// =====================================================================
import { C, R_TIERRA_KM, longitudOnda } from './radio.js';
import { pasoLinea } from './lineas.js';

// Notación científica legible: 5,8·10⁹
function cientifica(x, f) {
  const e = Math.floor(Math.log10(Math.abs(x)));
  return `${f(x / Math.pow(10, e), 3).replace(/,?0+$/, '')}·10<sup>${e}</sup>`;
}

export function construirPasos(ctx, f) {
  const { e, a, b, dKm, modelo, resModelo, pres, an } = ctx;
  const pasos = [];
  const lam = longitudOnda(e.fMHz);

  const dphi = b.lat - a.lat, dlam = b.lon - a.lon;
  pasos.push({
    grupo: 'Datos de partida',
    id: 'distancia',
    titulo: 'Distancia entre A y B (d)',
    corta: 'd: fórmula del semiverseno (Tierra esférica)',
    formula: 'd = 2·R·arcsen√( sen²(Δφ/2) + cos φ<sub>A</sub>·cos φ<sub>B</sub>·sen²(Δλ/2) )',
    sustitucion: `R = ${f(R_TIERRA_KM, 0)} km; φ<sub>A</sub> = ${f(a.lat, 5)}°, φ<sub>B</sub> = ${f(b.lat, 5)}°; Δφ = ${f(dphi, 5)}°, Δλ = ${f(dlam, 5)}°`,
    resultado: `d = ${f(dKm, 3)} km`,
    nota: 'Fórmula del semiverseno (haversine) sobre una Tierra esférica de radio R = 6371 km: es la distancia sobre la superficie, siguiendo el círculo máximo. Frente al elipsoide real (GRS80) el error es inferior al 0,4 %, lo que supone menos de 0,03 dB en las pérdidas.',
  });

  if (e.pUnidad === 'W') {
    pasos.push({
      grupo: 'Datos de partida',
      id: 'potencia',
      titulo: 'Potencia del transmisor en dBm (P<sub>tx</sub>)',
      corta: 'P<sub>tx</sub>(dBm) = 10·log(P / 1 mW)',
      formula: 'P<sub>tx</sub>(dBm) = 10·log<sub>10</sub>( P<sub>tx</sub>(W) / 1 mW )',
      sustitucion: `P<sub>tx</sub> = 10·log<sub>10</sub>( ${f(e.pValor, 3).replace(/,?0+$/, '')} W / 0,001 W ) = 10·log<sub>10</sub>(${f(e.pValor * 1000, 0)})`,
      resultado: `P<sub>tx</sub> = ${f(e.ptxDbm, 2)} dBm`,
      nota: 'El dBm expresa la potencia en decibelios respecto a 1 mW. Por ejemplo, 1 W = 30 dBm y 20 W ≈ 43 dBm.',
    });
  } else {
    pasos.push({
      grupo: 'Datos de partida',
      id: 'potencia',
      titulo: 'Potencia del transmisor (P<sub>tx</sub>)',
      corta: 'P(W) = 10<sup>P(dBm)/10</sup> mW',
      formula: 'P<sub>tx</sub>(W) = 10<sup>P<sub>tx</sub>(dBm)/10</sup> · 1 mW',
      sustitucion: `P<sub>tx</sub> = 10<sup>${f(e.ptxDbm, 2)}/10</sup> · 0,001 W`,
      resultado: `${f(e.ptxDbm, 2)} dBm = ${f(Math.pow(10, e.ptxDbm / 10) / 1000, 3)} W`,
      nota: 'La potencia ya está en dBm, que es la unidad del presupuesto de enlace.',
    });
  }

  pasos.push({
    grupo: 'Datos de partida',
    id: 'lambda',
    titulo: 'Longitud de onda (λ)',
    corta: 'λ = c / f',
    formula: 'λ = c / f',
    sustitucion: `λ = ${cientifica(C, f)} m/s / ${cientifica(e.fMHz * 1e6, f)} Hz`,
    resultado: `λ = ${f(lam, 4)} m (${f(lam * 100, 2)} cm)`,
    nota: `f = ${f(e.fValor, 3).replace(/,?0+$/, '')} ${e.fUnidad} = ${f(e.fMHz, 1)} MHz.`,
  });

  const pm = modelo.explicar({ dKm, fMHz: e.fMHz, hA: e.hA, hB: e.hB }, resModelo, f);
  for (const p of [].concat(pm || [])) pasos.push({ grupo: 'Presupuesto del enlace', id: 'perdida', ...p });
  const Lp = resModelo.simbolo || 'L<sub>el</sub>';

  // Versión 1.5: pérdidas calculadas a partir de la línea y los accesorios
  for (const [lado, letra] of [[a, 'A'], [b, 'B']]) {
    const p = pasoLinea(lado, letra, e.fMHz, f);
    if (p) pasos.push({ grupo: 'Presupuesto del enlace', ...p });
  }

  // Versión 1.5: atenuación por gases atmosféricos (UIT-R P.530-19 § 2.1 y P.676-13)
  const g = ctx.gases;
  if (g) {
    pasos.push({
      grupo: 'Presupuesto del enlace',
      id: 'gases',
      titulo: 'Atenuación por gases atmosféricos (A<sub>a</sub>)',
      corta: 'A<sub>a</sub> = (γ<sub>o</sub> + γ<sub>w</sub>)·d',
      datos: `Altitud media de las antenas: ${f(g.altKm * 1000, 0)} m. Presión total ${f(g.P, 1)} hPa (P.835-7), T = ${f(g.T, 2)} K, ρ = ${f(g.rho, 2)} g/m³ (${g.origen}); e = ρ·T/216,7 = ${f(g.e, 2)} hPa; p = ${f(g.pSeco, 1)} hPa de aire seco`,
      formula: 'γ = 0,182·f·(N″<sub>oxígeno</sub>(f) + N″<sub>vapor</sub>(f))  (P.676-13, ec. 1);  A<sub>a</sub> = γ·d  (P.530-19, ec. 1)',
      sustitucion: `γ<sub>o</sub> = ${f(g.go, 5)} dB/km; γ<sub>w</sub> = ${f(g.gw, 5)} dB/km; d = ${f(dKm, 3)} km`,
      resultado: `A<sub>a</sub> = ${f(g.A, 3)} dB`,
      nota: 'Suma raya a raya de las 44 líneas del oxígeno y las 35 del vapor de agua (anexo 1 de la P.676-13). La P.530 recomienda incluirla por encima de unos 10 GHz; por debajo suele ser de décimas de dB.',
    });
  }
  const sumaGases = g ? ' − A<sub>a</sub>' : '';

  pasos.push({
    grupo: 'Presupuesto del enlace',
    id: 'pire',
    titulo: 'PIRE (potencia isótropa radiada equivalente)',
    corta: 'PIRE = P<sub>tx</sub> − L<sub>A</sub> + G<sub>A</sub>',
    formula: 'PIRE = P<sub>tx</sub> − L<sub>A</sub> + G<sub>A</sub>',
    sustitucion: `PIRE = ${f(e.ptxDbm, 2)} dBm − ${f(e.ltx, 2)} dB + ${f(e.gtx, 2)} dBi`,
    resultado: `PIRE = ${f(pres.pire, 2)} dBm`,
    nota: 'L<sub>A</sub> son las pérdidas del lado A (cables, conectores…) y G<sub>A</sub> la ganancia de su antena.',
  });
  pasos.push({
    grupo: 'Presupuesto del enlace',
    id: 'prx',
    titulo: 'Potencia recibida (P<sub>rx</sub>)',
    corta: `P<sub>rx</sub> = PIRE − ${Lp}${sumaGases} + G<sub>B</sub> − L<sub>B</sub>`,
    formula: `P<sub>rx</sub> = PIRE − ${Lp}${sumaGases} + G<sub>B</sub> − L<sub>B</sub>`,
    sustitucion: `P<sub>rx</sub> = ${f(pres.pire, 2)} dBm − ${f(resModelo.perdida, 2)} dB${g ? ` − ${f(g.A, 3)} dB` : ''} + ${f(e.grx, 2)} dBi − ${f(e.lrx, 2)} dB`,
    resultado: `P<sub>rx</sub> = ${f(pres.prx, 2)} dBm`,
    nota: `Es el balance completo: P<sub>rx</sub> = P<sub>tx</sub> + G<sub>A</sub> + G<sub>B</sub> − L<sub>A</sub> − L<sub>B</sub> − ${Lp}.` +
      (resModelo.incluyeTerreno ? ` Aquí ${Lp} es la pérdida de Longley–Rice, que ya incluye el relieve.` : ''),
  });
  pasos.push({
    grupo: 'Presupuesto del enlace',
    id: 'margen',
    titulo: 'Margen respecto a la sensibilidad (M)',
    corta: 'M = P<sub>rx</sub> − S<sub>rx</sub>',
    formula: 'M = P<sub>rx</sub> − S<sub>rx</sub>',
    sustitucion: `M = ${f(pres.prx, 2)} dBm − (${f(e.sens, 2)} dBm)`,
    resultado: `M = ${f(pres.margen, 2)} dB`,
    nota: 'Si M ≥ 0 dB el receptor recibe más señal de la mínima que necesita. En la práctica se exige un margen de desvanecimiento adicional, que depende de la disponibilidad deseada.',
  });

  if (!an) return pasos; // sin perfil todavía: solo el presupuesto
  pasos.push({
    grupo: 'Despeje del trayecto',
    id: 'r1medio',
    titulo: 'Radio de la 1.ª zona de Fresnel en el punto medio (r<sub>1</sub>)',
    corta: 'r<sub>1</sub> = √(λ·d<sub>1</sub>·d<sub>2</sub> / d)',
    datos: `d = ${f(an.D / 1000, 3)} km; d<sub>1</sub> = d<sub>2</sub> = ${f(an.D / 2000, 3)} km`,
    formula: 'r<sub>1</sub> = √( λ·d<sub>1</sub>·d<sub>2</sub> / (d<sub>1</sub> + d<sub>2</sub>) ) ≈ 17,31·√( d<sub>1</sub>·d<sub>2</sub> / (f·d) )',
    sustitucion: `r<sub>1</sub> = √( ${f(lam, 4)} m · ${f(an.D / 2, 1)} m · ${f(an.D / 2, 1)} m / ${f(an.D, 1)} m )`,
    resultado: `r<sub>1</sub> = ${f(an.r1Medio, 2)} m`,
    nota: 'En la forma aproximada d<sub>1</sub>, d<sub>2</sub> y d van en km, f en GHz y r<sub>1</sub> sale en metros; la constante es √(c·10<sup>−6</sup>) = 17,31 (la UIT-R P.530 la redondea a 17,3). La app calcula con la forma exacta. En el punto medio d<sub>1</sub> = d<sub>2</sub> = d/2.',
  });
  pasos.push({
    grupo: 'Despeje del trayecto',
    id: 'flecha',
    titulo: 'Curvatura terrestre en el punto medio (flecha h)',
    corta: 'h = d<sub>1</sub>·d<sub>2</sub> / (2·k·R)',
    formula: 'h = d<sub>1</sub>·d<sub>2</sub> / (2·k·R)',
    sustitucion: isFinite(e.k)
      ? `h = ${f(an.D / 2000, 3)} km · ${f(an.D / 2000, 3)} km / (2 · ${f(e.k, 3)} · ${f(R_TIERRA_KM, 0)} km) · 1000 m/km`
      : 'k = ∞ → la Tierra se considera plana para la propagación',
    resultado: `h = ${f(an.flechaMedio, 2)} m`,
    nota: 'k es el factor de radio terrestre equivalente (radio efectivo = k·R, con R = 6371 km según la UIT-R P.452). Con k = 4/3, valor mediano en atmósfera estándar (UIT-R P.530), el rayo se curva ligeramente hacia la Tierra. En el gráfico, la flecha se suma al relieve en cada punto. Con d en km y h en m equivale a h = d<sub>1</sub>·d<sub>2</sub> / (12,74·k).',
  });

  const p = an.peor;
  if (p) {
    pasos.push({
      grupo: 'Despeje del trayecto',
      id: 'peor',
      titulo: 'Despeje en el punto más comprometido',
      corta: 'c / r<sub>1</sub> ≥ 0,6',
      datos: `d<sub>1</sub> = ${f(p.d / 1000, 3)} km desde A; cota del terreno z = ${f(p.z, 2)} m; d = ${f(an.D / 1000, 3)} km`,
      formula: 'y<sub>LOS</sub> = y<sub>A</sub> + (y<sub>B</sub> − y<sub>A</sub>)·d<sub>1</sub>/d ;  c = y<sub>LOS</sub> − (z + h) ;  despeje = c / r<sub>1</sub>',
      sustitucion:
        `d<sub>1</sub> = ${f(p.d / 1000, 3)} km; y<sub>A</sub> = ${f(an.zA, 1)} + ${f(e.hA, 1)} = ${f(an.yA, 1)} m; y<sub>B</sub> = ${f(an.zB, 1)} + ${f(e.hB, 1)} = ${f(an.yB, 1)} m<br>` +
        `y<sub>LOS</sub> = ${f(p.los, 2)} m; z = ${f(p.z, 2)} m; h = ${f(p.flecha, 2)} m → c = ${f(p.los, 2)} − ${f(p.zEf, 2)} = ${f(p.despeje, 2)} m<br>` +
        `r<sub>1</sub> = ${f(p.r1, 2)} m → despeje = ${f(p.despeje, 2)} / ${f(p.r1, 2)}`,
      resultado: `${f(p.relacion * 100, 1)} % de r<sub>1</sub> (criterio: ≥ 60 %)`,
      nota: 'y<sub>A</sub> e y<sub>B</sub> son las cotas de las antenas sobre el nivel del mar (cota del terreno + altura del mástil). El punto más comprometido es el de menor relación c/r<sub>1</sub> a lo largo del trayecto; si es negativa, el relieve corta la línea de visión. El criterio del 60 % es el límite a partir del cual la UIT-R P.526 considera despreciable la difracción (pérdida ≈ 0 dB). Para diseñar enlaces reales, la UIT-R P.530 aplica criterios más exigentes: 100 % de r<sub>1</sub> con k = 4/3 y un despeje mínimo con el k más desfavorable.',
    });
  }

  // Altura mínima de las antenas (versión 1.4)
  const alt = ctx.alt;
  if (alt?.b && alt.a && alt.igual) {
    const pb = alt.b.punto, t = pb.d / an.D;
    const txt = (x) => (x <= 0 ? 'cualquier altura (≥ 0 m)' : `${f(x, 2)} m`);
    pasos.push({
      grupo: 'Altura mínima de las antenas',
      id: 'altmin',
      titulo: 'Altura mínima de la antena B para despejar el 60 % de r<sub>1</sub>',
      corta: 'y<sub>B</sub> ≥ (z + h + 0,6·r<sub>1</sub> − y<sub>A</sub>·(1 − t)) / t',
      datos: `Antena A a ${f(e.hA, 1)} m (y<sub>A</sub> = ${f(an.yA, 2)} m). Punto que limita: d<sub>1</sub> = ${f(pb.d / 1000, 3)} km, t = d<sub>1</sub>/d = ${f(t, 4)}`,
      formula: 'y<sub>A</sub>·(1 − t) + y<sub>B</sub>·t ≥ z + h + 0,6·r<sub>1</sub> en cada punto  →  y<sub>B,mín</sub> = máx [ (z + h + 0,6·r<sub>1</sub> − y<sub>A</sub>·(1 − t)) / t ] ;  h<sub>B,mín</sub> = y<sub>B,mín</sub> − z<sub>B</sub>',
      sustitucion: `z + h + 0,6·r<sub>1</sub> = ${f(pb.z, 2)} + ${f(pb.flecha, 2)} + 0,6 · ${f(pb.r1, 2)} = ${f(alt.b.q, 2)} m<br>` +
        `y<sub>B,mín</sub> = (${f(alt.b.q, 2)} − ${f(an.yA, 2)} · ${f(1 - t, 4)}) / ${f(t, 4)} = ${f(alt.b.y, 2)} m ;  h<sub>B,mín</sub> = ${f(alt.b.y, 2)} − ${f(an.zB, 2)}`,
      resultado: `h<sub>B,mín</sub> = ${txt(alt.b.h)}`,
      nota: `La flecha h y r<sub>1</sub> no dependen de las alturas de las antenas, así que la condición es lineal y la altura mínima es exacta (no hay que tantear). Se aplica en todos los puntos del perfil y manda el más exigente. Con B a su altura actual, A necesitaría ${txt(alt.a.h)}; con la misma altura en los dos extremos, ${txt(alt.igual.h)}. Criterio del 60 %: UIT-R P.530, § 2.2.2.`,
    });
  }

  const dif = ctx.dif;
  if (p && dif) {
    const d1 = dif.d1, d2 = dif.d2;
    pasos.push({
      grupo: 'Difracción en el obstáculo principal',
      id: 'nu',
      titulo: 'Parámetro de difracción (ν)',
      corta: 'ν = h·√(2·(d<sub>1</sub>+d<sub>2</sub>) / (λ·d<sub>1</sub>·d<sub>2</sub>))',
      datos: `Obstáculo en el punto más comprometido: d<sub>1</sub> = ${f(d1 / 1000, 3)} km, d<sub>2</sub> = ${f(d2 / 1000, 3)} km; h = −c = ${f(dif.h, 2)} m`,
      formula: 'ν = h·√( 2·(d<sub>1</sub> + d<sub>2</sub>) / (λ·d<sub>1</sub>·d<sub>2</sub>) )',
      sustitucion: `ν = ${f(dif.h, 2)} m · √( 2 · (${f(d1, 1)} m + ${f(d2, 1)} m) / (${f(lam, 4)} m · ${f(d1, 1)} m · ${f(d2, 1)} m) )`,
      resultado: `ν = ${f(dif.nu, 3)}`,
      nota: 'h es la altura de la cima del obstáculo (relieve + curvatura) sobre la línea de visión: positiva si la corta y negativa si queda por debajo, es decir, h = −c. Es la ecuación (26) de la UIT-R P.526. Como r<sub>1</sub>² = λ·d<sub>1</sub>·d<sub>2</sub>/(d<sub>1</sub>+d<sub>2</sub>), también vale ν = −√2·c/r<sub>1</sub>: con el 60 % de despeje, ν ≈ −0,85.',
    });
    pasos.push({
      grupo: 'Difracción en el obstáculo principal',
      id: 'difraccion',
      titulo: 'Pérdida por difracción en filo de cuchillo (J)',
      corta: 'J(ν) = 6,9 + 20·log(√((ν−0,1)²+1) + ν − 0,1)',
      formula: 'J(ν) = 6,9 + 20·log<sub>10</sub>( √((ν − 0,1)² + 1) + ν − 0,1 )   si ν > −0,78;   J = 0 dB en otro caso',
      sustitucion: dif.nu > -0.78
        ? `J = 6,9 + 20·log<sub>10</sub>( √((${f(dif.nu, 3)} − 0,1)² + 1) + ${f(dif.nu, 3)} − 0,1 )`
        : `ν = ${f(dif.nu, 3)} ≤ −0,78 → el obstáculo queda fuera de la zona que produce pérdidas apreciables`,
      resultado: `J = ${f(dif.J, 2)} dB`,
      nota: 'Ecuación (31) de la UIT-R P.526 para un único obstáculo agudo («filo de cuchillo»); difiere menos de 0,15 dB del cálculo exacto con integrales de Fresnel. Es una estimación de primer orden: un obstáculo redondeado o varios obstáculos seguidos producen más pérdida (métodos de Deygout o Bullington, también en la P.526). Con ν = 0 (rasante) J ≈ 6 dB.',
    });
    pasos.push({
      grupo: 'Difracción en el obstáculo principal',
      id: 'margendif',
      titulo: 'Margen corregido con la difracción (M<sub>d</sub>)',
      corta: 'M<sub>d</sub> = M − J',
      formula: 'P<sub>rx,d</sub> = P<sub>rx</sub> − J ;  M<sub>d</sub> = M − J',
      sustitucion: `P<sub>rx,d</sub> = ${f(pres.prx, 2)} dBm − ${f(dif.J, 2)} dB ;  M<sub>d</sub> = ${f(pres.margen, 2)} dB − ${f(dif.J, 2)} dB`,
      resultado: `P<sub>rx,d</sub> = ${f(pres.prx - dif.J, 2)} dBm ;  M<sub>d</sub> = ${f(pres.margen - dif.J, 2)} dB`,
      nota: 'La difracción se suma a las pérdidas en espacio libre: L<sub>total</sub> = L<sub>el</sub> + J. Si el trayecto está despejado (≥ 60 % de r<sub>1</sub>), J = 0 y el margen no cambia.',
    });
  }
  return pasos;
}
