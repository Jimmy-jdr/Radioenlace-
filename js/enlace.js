/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// enlace.js — Datos dentro del enlace para compartir (versión 1.4)
//   ?e=…  JSON en base64url (todas las versiones; se sigue leyendo)
//   ?z=…  el mismo JSON comprimido con DEFLATE sin cabecera (RFC 1951)
//         y en base64url: un 35–40 % más corto, así el código QR es menos denso.
//         Si el navegador no tiene CompressionStream, se crea un ?e=.
//   ?g=…  ejercicio aleatorio: solo la configuración (ver ejercicios.js)
// =====================================================================
const aB64url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64url = (t) => Uint8Array.from(atob(String(t).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pasar(bytes, flujo) {
  const s = new Blob([bytes]).stream().pipeThrough(flujo);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
export const hayCompresion = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

// Objeto → { clave: 'z' | 'e', valor }
export async function codificarDatos(obj, { comprimir = true } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (comprimir && hayCompresion()) {
    try { return { clave: 'z', valor: aB64url(await pasar(bytes, new CompressionStream('deflate-raw'))) }; } catch { /* sin deflate-raw */ }
  }
  return { clave: 'e', valor: aB64url(bytes) };
}

// Parámetros de la dirección → objeto (o null)
export async function decodificarDatos(params) {
  const z = params.get('z'), e = params.get('e');
  if (z) {
    if (!hayCompresion()) throw new Error('Este navegador no puede abrir enlaces comprimidos: actualízalo.');
    return JSON.parse(new TextDecoder().decode(await pasar(deB64url(z), new DecompressionStream('deflate-raw'))));
  }
  if (e) return JSON.parse(new TextDecoder().decode(deB64url(e)));
  return null;
}
