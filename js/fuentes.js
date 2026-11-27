/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// fuentes.js — Referencias de las fórmulas y de los datos
// Se muestran en la app (sección «Fuentes y criterios») y en el informe CSV.
// =====================================================================
export const FUENTES_BIBLIO = [
  {
    ref: 'Recomendación UIT-R P.525-4 (08/2019)',
    titulo: 'Cálculo de la atenuación en el espacio libre',
    uso: 'Pérdidas en espacio libre: L = 20·log(4πd/λ) = 32,4 + 20·log f(MHz) + 20·log d(km).',
    url: 'https://www.itu.int/rec/R-REC-P.525/es',
  },
  {
    ref: 'Recomendación UIT-R P.526-16 (11/2025)',
    titulo: 'Propagación por difracción',
    uso: 'Elipsoides y zonas de Fresnel; la zona de difracción empieza cuando el despeje es el 60 % del radio de la 1.ª zona de Fresnel (criterio del 60 %).',
    url: 'https://www.itu.int/rec/R-REC-P.526/es',
  },
  {
    ref: 'Recomendación UIT-R P.530 (versión vigente)',
    titulo: 'Datos de propagación y métodos de predicción para el diseño de sistemas terrenales con visibilidad directa',
    uso: 'Radio de la 1.ª zona de Fresnel F1 = 17,3·√(d1·d2/(f·d)); factor k con valor mediano ≈ 4/3; criterios de despeje para el diseño de enlaces reales.',
    url: 'https://www.itu.int/rec/R-REC-P.530/es',
  },
  {
    ref: 'Recomendación UIT-R P.452-18 (08/2023)',
    titulo: 'Procedimiento de predicción para evaluar la interferencia entre estaciones en la superficie de la Tierra',
    uso: 'Radio terrestre real de 6371 km y radio efectivo a·k usados en la curvatura (flecha) del perfil.',
    url: 'https://www.itu.int/rec/R-REC-P.452/es',
  },
  {
    ref: 'NTIA/ITS · Irregular Terrain Model (ITM) 1.2.2, implementación de referencia en C++ (versión 1.3)',
    titulo: 'Modelo de propagación Longley–Rice en modo punto a punto',
    uso: 'Pérdida básica de transmisión con el perfil del terreno: horizontes, Δh, línea de visión, difracción, dispersión troposférica y variabilidad. js/itm.js la reproduce función a función y se ha verificado contra ella.',
    url: 'https://github.com/NTIA/itm',
  },
  {
    ref: 'G. A. Hufford, The ITS Irregular Terrain Model, version 1.2.2. The Algorithm (NTIA/ITS)',
    titulo: 'Algoritmo del ITM; A. G. Longley y P. L. Rice, ESSA Tech. Rep. ERL 79-ITS 67 (1968); P. L. Rice et al., NBS Technical Note 101 (1967)',
    uso: 'Ecuaciones citadas en los pasos de Longley–Rice (refractividad, Δh, atenuación de referencia y variabilidad).',
    url: 'https://its.ntia.gov/research-topics/radio-propagation-software/itm/itm.aspx',
  },
  {
    ref: 'IGN/CNIG · Modelos Digitales del Terreno MDT25 y MDT200',
    titulo: 'Servicio WCS INSPIRE de la Infraestructura de Datos Espaciales de España (IDEE)',
    uso: 'Cotas del terreno del perfil (ETRS89, alturas ortométricas).',
    url: 'https://centrodedescargas.cnig.es/',
  },
  {
    ref: 'Geodesia esférica: fórmula del semiverseno (haversine)',
    titulo: 'Distancia sobre una esfera de radio 6371 km',
    uso: 'Distancia entre emplazamientos; error frente al elipsoide GRS80 inferior al 0,4 % (< 0,03 dB en las pérdidas).',
    url: '',
  },
];
