/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// fuentes.js — Referencias de las fórmulas y de los datos
// Se muestran en la app (sección «Fuentes y criterios») y en el informe CSV.
// =====================================================================
export const FUENTES_BIBLIO = [
  {
    ref: 'Recomendación UIT-R P.525-5 (11/2024)',
    titulo: 'Cálculo de la atenuación en el espacio libre',
    uso: 'Pérdidas en espacio libre, ec. (5): L = 20·log(4πd/λ); ec. (6): ≈ 32,4 + 20·log f(MHz) + 20·log d(km). La app usa la ec. (5) exacta (constante 32,45).',
    url: 'https://www.itu.int/rec/R-REC-P.525/es',
  },
  {
    ref: 'Recomendación UIT-R P.526-16 (11/2025)',
    titulo: 'Propagación por difracción',
    uso: 'Elipsoides y zonas de Fresnel; la zona de difracción empieza cuando el despeje es el 60 % del radio de la 1.ª zona de Fresnel (criterio del 60 %).',
    url: 'https://www.itu.int/rec/R-REC-P.526/es',
  },
  {
    ref: 'Recomendación UIT-R P.530-19 (09/2025)',
    titulo: 'Datos de propagación y métodos de predicción para el diseño de sistemas terrenales con visibilidad directa',
    uso: 'Radio de la 1.ª zona de Fresnel; § 2.1: gases; § 2.2.2.1: criterio de despeje (1,0·F1 con k = 4/3 y 0,0/0,3/0,6·F1 con ke del 99,9 %, ec. 4); §§ 2.3.1–2.3.4: multitrayecto (ecs. 5–18, LogK.csv y dN75.csv) y paso al año (ec. 24); §§ 2.4.1–2.4.2: lluvia y nieve húmeda (ecs. 32–71); §§ 2.3.6, 2.4.7 y 7: indisponibilidad.',
    url: 'https://www.itu.int/rec/R-REC-P.530/es',
  },
  {
    ref: 'Recomendaciones UIT-R P.838-3 (03/2005) y P.837-8 (09/2025)',
    titulo: 'Modelo de atenuación específica por lluvia; características de la precipitación',
    uso: 'γR = k·R^α con k y α de los cuadros 1 a 4 (P.838-3); R0,01 del mapa de 0,125° y probabilidad anual de lluvia P0 con los mapas mensuales MT y las ecs. (1)–(3) (P.837-8).',
    url: 'https://www.itu.int/rec/R-REC-P.837/es',
  },
  {
    ref: 'Recomendaciones UIT-R P.839-4 (09/2013), P.1510-1 (06/2017) y P.836-6 (12/2017)',
    titulo: 'Altura de la lluvia; temperatura media en superficie; vapor de agua en superficie',
    uso: 'hR = h0 + 0,36 km (P.839-4); temperatura anual y mensual (P.1510-1); ρ al 50 % del año escalada a la altitud con vsch y la topografía TOPO_0DOT5 (P.836-6). Interpolación de la P.1144-13.',
    url: 'https://www.itu.int/rec/R-REC-P.839/es',
  },
  {
    ref: 'ETSI EN 302 217-2 V3.4.1 (2025-07)',
    titulo: 'Fixed Radio Systems; point-to-point equipment and antennas; Part 2: Digital systems operating in frequency bands from 1 GHz to 174,8 GHz',
    uso: 'Clases de eficiencia espectral (cuadro 0), densidad mínima de RIC (cuadro 1), RIC mínima y umbral de recepción para BER ≤ 10⁻⁶ por banda y canal (cuadros C.6, D.5, E.5a, E.5b, F.5a y F.5b) y derivación a otros canales (nota del § 4.1.6). Velocidad binaria: Rb = CS/(1 + α)·log2M·r; α = 0,25 y r = 0,9 por defecto, coherentes con fichas comerciales (p. ej., SAF Integra-X: 162 Mbit/s con 256QAM en 28 MHz).',
    url: 'https://www.etsi.org/deliver/etsi_en/302200_302299/30221702/03.04.01_60/en_30221702v030401p.pdf',
  },
  {
    ref: 'Recomendaciones UIT-R P.676-13 (08/2022), P.835-7 (08/2024) y P.841-7 (08/2022)',
    titulo: 'Atenuación por gases; atmósferas de referencia; conversión de estadísticas anuales al peor mes',
    uso: 'γ = 0,182·f·N″(f), suma raya a raya del oxígeno y del vapor de agua (P.676-13, anexo 1); presión con la altitud (P.835-7); Q(p) con Q1 = 2,85 y β = 0,13 (P.841-7, ec. 4).',
    url: 'https://www.itu.int/rec/R-REC-P.676/es',
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
    ref: 'Copernicus DEM GLO-90 (ESA / Airbus), servido por la API de elevación de Open-Meteo',
    titulo: 'Modelo digital de superficie global con malla de 3″ (≈ 90 m)',
    uso: 'Respaldo de las cotas que el IGN no tiene (mar, fuera de España): nodos de la malla de 3″ por bloques fijos e interpolación bilineal.',
    url: 'https://open-meteo.com/en/docs/elevation-api',
  },
  {
    ref: 'Mapas de cobertura (versión 1.3): perfiles radiales desde A',
    titulo: 'Un perfil propio desde el transmisor hasta el centro de cada píxel, con el mismo cálculo punto a punto',
    uso: 'Cada píxel da exactamente lo mismo que el enlace A–B con B en su centro (mismas teselas fijas del MDT, mismo número de cotas, mismo modelo y mismo presupuesto). Se ha contrastado una muestra de píxeles con la referencia C++ del NTIA.',
    url: '',
  },
  {
    ref: 'Altura mínima de las antenas (versión 1.4)',
    titulo: 'Condición de despeje lineal en la cota de cada antena',
    uso: 'La flecha y r1 no dependen de las alturas: y_A·(1 − t) + y_B·t ≥ z + h + 0,6·r1 en cada punto, de donde se despeja la altura mínima exacta de A, de B o de ambas; manda el punto más exigente.',
    url: '',
  },
  {
    ref: 'Pérdidas de línea y accesorios (versión 1.5): fichas de los fabricantes',
    titulo: 'Times Microwave (LMR), ANDREW/CommScope (HELIAX coaxial y guía elíptica), Belden (RG), Fairview, Pasternack, CITEL y Huawei (accesorios)',
    uso: 'Atenuación de cada cable según la fórmula k1·√f + k2·f del fabricante o su tabla (interpolación log–log, solo dentro de la banda de uso); guía elíptica según su tabla; accesorios con su valor de catálogo. Las pruebas comprueban que la app reproduce cada valor publicado. Detalle y enlaces en «Datos → Pérdidas de cada lado → Fuentes de los datos».',
    url: '',
  },
  {
    ref: 'D. M. Pozar, Microwave Engineering, 4.ª ed., Wiley, 2012, § 3.3 (ec. 3.96)',
    titulo: 'Guía de onda rectangular: modo TE10 y atenuación por conductor',
    uso: 'αc = Rs·(2bπ² + a³k²)/(a³·b·β·k·η), Rs = √(ωμ0/2σ); corte fc = c/2a y del siguiente modo (TE20 = c/a, TE01 = c/2b). Contrastado con la tabla de cobre de Gabriel Electronics (61 valores de WR-229 a WR-42, diferencias < 0,35 %).',
    url: '',
  },
  {
    ref: 'Recomendación UIT-R F.758-8 (02/2025)',
    titulo: 'Parámetros de sistemas del servicio fijo para estudios de compartición',
    uso: 'Orientación sobre las pérdidas de alimentador y multiplexor por banda: 0 dB con equipos totalmente exteriores y, para el valor alto, unos 50 m de guía de onda flexible.',
    url: 'https://www.itu.int/rec/R-REC-F.758/es',
  },
  {
    ref: 'ISO/IEC 18004:2015 · QR Code bar code symbology specification',
    titulo: 'Código QR (modelo 2)',
    uso: 'Código QR generado en la propia app: modo byte (UTF-8), corrección Reed–Solomon nivel M, máscaras y penalizaciones de la norma. Contrastado bit a bit con OpenCV.',
    url: 'https://www.iso.org/standard/62021.html',
  },
  {
    ref: 'Geodesia esférica: fórmula del semiverseno (haversine)',
    titulo: 'Distancia sobre una esfera de radio 6371 km',
    uso: 'Distancia entre emplazamientos; error frente al elipsoide GRS80 inferior al 0,4 % (< 0,03 dB en las pérdidas).',
    url: '',
  },
];
