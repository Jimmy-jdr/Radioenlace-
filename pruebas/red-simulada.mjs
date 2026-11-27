// Red simulada para las pruebas de Node (WCS del IGN y Open-Meteo), reproducible y sin conexión.
// El IGN devuelve 0 al oeste de −4,95° (como fuera de su cobertura) y ahí entra Copernicus.
export function cotaSim(lat, lon) {
  if (lon < -4.95) return 0.0;                     // fuera de la cobertura del IGN
  let z = 370 + 997 * Math.exp(-(((lat - 40.1541) ** 2) + ((lon + 4.7434) * 0.77) ** 2) / 0.0012);
  z += 160 * Math.exp(-(((lat - 40.06) ** 2) + ((lon + 4.79) * 0.77) ** 2) / 0.0002);
  z += 6 * Math.sin(lat * 900) * Math.cos(lon * 700);
  return z;
}
export const copSim = (lat, lon) => 250 + 120 * Math.sin(lat * 300) * Math.cos(lon * 250);
export const peticiones = { ign: 0, om: 0 };
export const fallo = { om: false };
export function instalarRedSimulada() { globalThis.fetch = simular; }
async function simular(url) {
  const u = new URL(url);
  if (u.host === 'servicios.idee.es') {
    peticiones.ign++;
    const q = u.searchParams;
    const [o, s, e, n] = q.get('bbox').split(',').map(Number);
    const w = +q.get('width'), h = +q.get('height');
    const dx = (e - o) / w, dy = (n - s) / h;
    const filas = [];
    for (let r = 0; r < h; r++) {
      const lat = n - (r + 0.5) * dy;
      const v = [];
      for (let c = 0; c < w; c++) v.push(cotaSim(lat, o + (c + 0.5) * dx).toFixed(3));
      filas.push(v.join(' '));
    }
    return new Response(`ncols ${w}\nnrows ${h}\nxllcorner ${o}\nyllcorner ${s}\ncellsize ${dx}\n${filas.join('\n')}\n`);
  }
  if (u.host === 'api.open-meteo.com') {
    peticiones.om++;
    if (fallo.om) return new Response('no', { status: 503 });
    const la = u.searchParams.get('latitude').split(',').map(Number), lo = u.searchParams.get('longitude').split(',').map(Number);
    return new Response(JSON.stringify({ elevation: la.map((x, i) => +copSim(x, lo[i]).toFixed(1)) }));
  }
  throw new Error(`URL no simulada: ${url}`);
}
