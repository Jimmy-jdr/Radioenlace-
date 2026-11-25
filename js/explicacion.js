// =====================================================================
// explicacion.js — Cálculos paso a paso (fórmula, sustitución, unidades)
// =====================================================================
import { C, R_TIERRA_KM, longitudOnda } from './radio.js';

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
    titulo: 'Distancia entre A y B (d)',
    formula: 'd = 2·R·arcsen√( sen²(Δφ/2) + cos φ<sub>A</sub>·cos φ<sub>B</sub>·sen²(Δλ/2) )',
    sustitucion: `R = ${f(R_TIERRA_KM, 0)} km; φ<sub>A</sub> = ${f(a.lat, 5)}°, φ<sub>B</sub> = ${f(b.lat, 5)}°; Δφ = ${f(dphi, 5)}°, Δλ = ${f(dlam, 5)}°`,
    resultado: `d = ${f(dKm, 3)} km`,
    nota: 'Fórmula del semiverseno (haversine) sobre una Tierra esférica. Es la distancia en línea recta sobre la superficie.',
  });

  if (e.pUnidad === 'W') {
    pasos.push({
      grupo: 'Datos de partida',
      titulo: 'Potencia del transmisor en dBm (P<sub>tx</sub>)',
      formula: 'P<sub>tx</sub>(dBm) = 10·log<sub>10</sub>( P<sub>tx</sub>(W) / 1 mW )',
      sustitucion: `P<sub>tx</sub> = 10·log<sub>10</sub>( ${f(e.pValor, 3).replace(/,?0+$/, '')} W / 0,001 W ) = 10·log<sub>10</sub>(${f(e.pValor * 1000, 0)})`,
      resultado: `P<sub>tx</sub> = ${f(e.ptxDbm, 2)} dBm`,
      nota: 'El dBm expresa la potencia en decibelios respecto a 1 mW. Por ejemplo, 1 W = 30 dBm y 20 W ≈ 43 dBm.',
    });
  } else {
    pasos.push({
      grupo: 'Datos de partida',
      titulo: 'Potencia del transmisor (P<sub>tx</sub>)',
      formula: 'P<sub>tx</sub>(W) = 10<sup>P<sub>tx</sub>(dBm)/10</sup> · 1 mW',
      sustitucion: `P<sub>tx</sub> = 10<sup>${f(e.ptxDbm, 2)}/10</sup> · 0,001 W`,
      resultado: `${f(e.ptxDbm, 2)} dBm = ${f(Math.pow(10, e.ptxDbm / 10) / 1000, 3)} W`,
      nota: 'La potencia ya está en dBm, que es la unidad del presupuesto de enlace.',
    });
  }

  pasos.push({
    grupo: 'Datos de partida',
    titulo: 'Longitud de onda (λ)',
    formula: 'λ = c / f',
    sustitucion: `λ = ${cientifica(C, f)} m/s / ${cientifica(e.fMHz * 1e6, f)} Hz`,
    resultado: `λ = ${f(lam, 4)} m (${f(lam * 100, 2)} cm)`,
    nota: `f = ${f(e.fValor, 3).replace(/,?0+$/, '')} ${e.fUnidad} = ${f(e.fMHz, 1)} MHz.`,
  });

  const pm = modelo.explicar({ dKm, fMHz: e.fMHz }, resModelo, f);
  if (pm) pasos.push({ grupo: 'Presupuesto del enlace', ...pm });

  pasos.push({
    grupo: 'Presupuesto del enlace',
    titulo: 'PIRE (potencia isótropa radiada equivalente)',
    formula: 'PIRE = P<sub>tx</sub> − L<sub>A</sub> + G<sub>A</sub>',
    sustitucion: `PIRE = ${f(e.ptxDbm, 2)} dBm − ${f(e.ltx, 2)} dB + ${f(e.gtx, 2)} dBi`,
    resultado: `PIRE = ${f(pres.pire, 2)} dBm`,
    nota: 'L<sub>A</sub> son las pérdidas del lado A (cables, conectores…) y G<sub>A</sub> la ganancia de su antena.',
  });
  pasos.push({
    grupo: 'Presupuesto del enlace',
    titulo: 'Potencia recibida (P<sub>rx</sub>)',
    formula: 'P<sub>rx</sub> = PIRE − L<sub>el</sub> + G<sub>B</sub> − L<sub>B</sub>',
    sustitucion: `P<sub>rx</sub> = ${f(pres.pire, 2)} dBm − ${f(resModelo.perdida, 2)} dB + ${f(e.grx, 2)} dBi − ${f(e.lrx, 2)} dB`,
    resultado: `P<sub>rx</sub> = ${f(pres.prx, 2)} dBm`,
    nota: 'Es el balance completo: P<sub>rx</sub> = P<sub>tx</sub> + G<sub>A</sub> + G<sub>B</sub> − L<sub>A</sub> − L<sub>B</sub> − L<sub>el</sub>.',
  });
  pasos.push({
    grupo: 'Presupuesto del enlace',
    titulo: 'Margen respecto a la sensibilidad (M)',
    formula: 'M = P<sub>rx</sub> − S<sub>rx</sub>',
    sustitucion: `M = ${f(pres.prx, 2)} dBm − (${f(e.sens, 2)} dBm)`,
    resultado: `M = ${f(pres.margen, 2)} dB`,
    nota: 'Si M ≥ 0 dB el receptor recibe más señal de la mínima que necesita. En la práctica se exige un margen de desvanecimiento adicional, que depende de la disponibilidad deseada.',
  });

  pasos.push({
    grupo: 'Despeje del trayecto',
    titulo: 'Radio de la 1.ª zona de Fresnel en el punto medio (r<sub>1</sub>)',
    formula: 'r<sub>1</sub> = √( λ·d<sub>1</sub>·d<sub>2</sub> / (d<sub>1</sub> + d<sub>2</sub>) ) ≈ 17,32·√( d<sub>1</sub>·d<sub>2</sub> / (f·d) )',
    sustitucion: `r<sub>1</sub> = √( ${f(lam, 4)} m · ${f(an.D / 2, 1)} m · ${f(an.D / 2, 1)} m / ${f(an.D, 1)} m )`,
    resultado: `r<sub>1</sub> = ${f(an.r1Medio, 2)} m`,
    nota: 'En la forma aproximada d<sub>1</sub>, d<sub>2</sub> y d van en km, f en GHz y r<sub>1</sub> sale en metros. En el punto medio d<sub>1</sub> = d<sub>2</sub> = d/2.',
  });
  pasos.push({
    grupo: 'Despeje del trayecto',
    titulo: 'Curvatura terrestre en el punto medio (flecha h)',
    formula: 'h = d<sub>1</sub>·d<sub>2</sub> / (2·k·R)',
    sustitucion: isFinite(e.k)
      ? `h = ${f(an.D / 2000, 3)} km · ${f(an.D / 2000, 3)} km / (2 · ${f(e.k, 3)} · ${f(R_TIERRA_KM, 0)} km) · 1000 m/km`
      : 'k = ∞ → la Tierra se considera plana para la propagación',
    resultado: `h = ${f(an.flechaMedio, 2)} m`,
    nota: 'k es el factor de radio terrestre equivalente: con k = 4/3 (atmósfera estándar) el rayo se curva ligeramente hacia la Tierra. En el gráfico, la flecha se suma al relieve en cada punto.',
  });

  const p = an.peor;
  if (p) {
    pasos.push({
      grupo: 'Despeje del trayecto',
      titulo: 'Despeje en el punto más comprometido',
      formula: 'y<sub>LOS</sub> = y<sub>A</sub> + (y<sub>B</sub> − y<sub>A</sub>)·d<sub>1</sub>/d ;  c = y<sub>LOS</sub> − (z + h) ;  despeje = c / r<sub>1</sub>',
      sustitucion:
        `d<sub>1</sub> = ${f(p.d / 1000, 3)} km; y<sub>A</sub> = ${f(an.zA, 1)} + ${f(e.hA, 1)} = ${f(an.yA, 1)} m; y<sub>B</sub> = ${f(an.zB, 1)} + ${f(e.hB, 1)} = ${f(an.yB, 1)} m<br>` +
        `y<sub>LOS</sub> = ${f(p.los, 2)} m; z = ${f(p.z, 2)} m; h = ${f(p.flecha, 2)} m → c = ${f(p.los, 2)} − ${f(p.zEf, 2)} = ${f(p.despeje, 2)} m<br>` +
        `r<sub>1</sub> = ${f(p.r1, 2)} m → despeje = ${f(p.despeje, 2)} / ${f(p.r1, 2)}`,
      resultado: `${f(p.relacion * 100, 1)} % de r<sub>1</sub> (criterio: ≥ 60 %)`,
      nota: 'y<sub>A</sub> e y<sub>B</sub> son las cotas de las antenas sobre el nivel del mar (cota del terreno + altura del mástil). El punto más comprometido es el de menor relación c/r<sub>1</sub> a lo largo del trayecto. Si es negativa, el relieve corta la línea de visión.',
    });
  }
  return pasos;
}
