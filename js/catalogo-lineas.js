/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// catalogo-lineas.js — Datos de catálogo de cables, guías de onda y
// accesorios (versión 1.5). Solo datos, cada uno con su fuente.
//
// Todos los valores se han copiado de la ficha del fabricante indicada
// (consultadas el 27-11-2026). Las pruebas (pruebas/prueba-lineas.mjs y
// verificacion/verificar.py, apartado 10) comprueban que la app reproduce
// cada valor publicado.
//
// Unidades: frecuencias en MHz (coaxiales) o GHz (guías), atenuación en
// dB/100 m y dB/100 ft tal como las publica cada fabricante.
// =====================================================================

export const CONSULTA = '27-11-2026';

// ---------------------------------------------------------------------
// Coaxiales
//   metodo 'k':     α (dB/100 ft) = k1·√f + k2·f, f en MHz (Times Microwave)
//   metodo 'tabla': puntos publicados [f (MHz), dB/100 m, dB/100 ft];
//                   interpolación log–log entre puntos dentro de la banda
//   banda:          [fmín, fmáx] en MHz: rango de uso de la ficha
// ---------------------------------------------------------------------
const ANDREW = 'ANDREW (Amphenol; antes CommScope)';
const URL_ANDREW_COAX = (m) => `https://www.andrew.com/products/fiber-power-rf-connectivity-accessories/rf-connectivity/coaxial-cables/item${m.toLowerCase()}/`;
const NOTA_ANDREW = 'Valores típicos garantizados dentro del 5 % («Attenuation values typical, guaranteed within 5%»), a 20 °C.';
const TIMES = 'Times Microwave Systems';
const URL_TIMES = 'https://timesmicrowave.com/calculator/';
const NOTA_TIMES = 'Coeficientes K1 y K2 (dB/100 ft, f en MHz) de la guía LMR (Rev. 3, 11/2024, «IL = (K1·√f + K2·f)·longitud») confirmados con la calculadora oficial de Times; valores nominales a +25 °C.';
const BELDEN = 'Belden';
const URL_BELDEN = (p) => `https://www.belden.com/products/cable/coax-triax-cable/50-ohm-coax-cable/${p}`;
const NOTA_BELDEN = 'Atenuación nominal publicada (dB/100 ft, redondeada a 0,1 dB); la ficha no da datos por encima de la última frecuencia.';

// Tablas ANDREW: [f (MHz), dB/100 m, dB/100 ft]
const T = (s) => s.split(';').map((r) => r.trim().split(/\s+/).map(Number));

export const COAXIALES = [
  // ---- Flexibles de baja pérdida (Times LMR) ----
  { id: 'LMR-195', clase: 'Flexible de baja pérdida, 5 mm (tipo 195)', fabricante: TIMES, modelo: 'LMR-195', metodo: 'k', k1: 0.36042759, k2: 0.0004747,
    banda: [0, 8000], tamb: 25, url: URL_TIMES, nota: NOTA_TIMES },
  { id: 'LMR-240', clase: 'Flexible de baja pérdida, 6 mm (tipo 240)', fabricante: TIMES, modelo: 'LMR-240', metodo: 'k', k1: 0.2445, k2: 0.00033,
    banda: [0, 6000], tamb: 25, url: URL_TIMES, nota: `${NOTA_TIMES} Frecuencia máxima: 6 GHz según la calculadora (la guía indica 8 GHz); se toma la más baja.` },
  { id: 'LMR-400', clase: 'Flexible de baja pérdida, 10 mm (tipo 400)', fabricante: TIMES, modelo: 'LMR-400', metodo: 'k', k1: 0.1235129, k2: 0.0002626,
    banda: [0, 8000], tamb: 25, url: URL_TIMES, nota: NOTA_TIMES },
  { id: 'LMR-600', clase: 'Flexible de baja pérdida, 15 mm (tipo 600)', fabricante: TIMES, modelo: 'LMR-600', metodo: 'k', k1: 0.0763055, k2: 0.0002626,
    banda: [0, 8000], tamb: 25, url: URL_TIMES, nota: NOTA_TIMES },
  { id: 'LMR-900', clase: 'Flexible de baja pérdida, 22 mm (tipo 900)', fabricante: TIMES, modelo: 'LMR-900', metodo: 'k', k1: 0.05177, k2: 0.00016,
    banda: [0, 6000], tamb: 25, url: URL_TIMES, nota: `${NOTA_TIMES} La columna métrica de la guía (K2 = 0,00059058 dB/100 m) es una errata: la calculadora usa K2 = 0,00016 dB/100 ft.` },
  { id: 'LMR-1200', clase: 'Flexible de baja pérdida, 30 mm (tipo 1200)', fabricante: TIMES, modelo: 'LMR-1200', metodo: 'k', k1: 0.03737, k2: 0.00016,
    banda: [0, 5200], tamb: 25, url: URL_TIMES, nota: `${NOTA_TIMES} Frecuencia máxima: 5,2 GHz según la guía (la calculadora indica 6 GHz); se toma la más baja.` },

  // ---- Coaxiales RG (Belden): [f (MHz), dB/100 ft] ----
  { id: 'RG-174', clase: 'RG-174 (2,8 mm, dieléctrico macizo)', fabricante: BELDEN, modelo: '8216 (RG-174/U)', metodo: 'tabla-ft',
    puntos: [[1, 1.9], [10, 3.3], [50, 5.8], [100, 8.4], [200, 12.5], [400, 19.0], [700, 27.0], [900, 31.0], [1000, 34.0]],
    banda: [1, 1000], tamb: 20, url: URL_BELDEN('8216'), nota: NOTA_BELDEN },
  { id: 'RG-58', clase: 'RG-58 (5 mm, dieléctrico macizo)', fabricante: BELDEN, modelo: '8259 (RG-58/U)', metodo: 'tabla-ft',
    puntos: [[1, 0.4], [10, 1.5], [50, 3.7], [100, 5.4], [200, 8.1], [400, 12.4], [700, 17.7], [900, 21.1], [1000, 22.8]],
    banda: [1, 1000], tamb: 20, url: URL_BELDEN('8259'), nota: NOTA_BELDEN },
  { id: 'RG-213', clase: 'RG-213 (10 mm, dieléctrico macizo)', fabricante: BELDEN, modelo: '8267 (RG-213/U)', metodo: 'tabla-ft',
    puntos: [[1, 0.17], [10, 0.55], [50, 1.3], [100, 1.9], [200, 2.7], [400, 4.1], [700, 6.5], [900, 7.6], [1000, 8.0], [4000, 21.5]],
    banda: [1, 4000], tamb: 20, url: URL_BELDEN('8267'), nota: NOTA_BELDEN },

  // ---- Corrugados HELIAX (ANDREW): [f (MHz), dB/100 m, dB/100 ft] ----
  { id: 'FSJ1-50A', clase: 'Superflexible corrugado 1/4″', fabricante: ANDREW, modelo: 'FSJ1-50A', metodo: 'tabla',
    puntos: T('1 0.577 0.176;1.5 0.707 0.215;2 0.816 0.249;10 1.833 0.559;20 2.6 0.792;30 3.192 0.973;50 4.136 1.261;85 5.419 1.652;88 5.516 1.681;100 5.889 1.795;108 6.125 1.867;150 7.25 2.21;174 7.825 2.385;200 8.408 2.563;204 8.495 2.589;300 10.373 3.162;400 12.051 3.673;450 12.817 3.906;460 12.965 3.952;500 13.545 4.128;512 13.715 4.18;600 14.909 4.544;700 16.175 4.93;800 17.362 5.292;824 17.637 5.376;894 18.42 5.614;960 19.134 5.832;1000 19.556 5.96;1218 21.738 6.626;1250 22.044 6.719;1500 24.326 7.414;1700 26.038 7.936;1794 26.813 8.172;1800 26.862 8.187;2000 28.455 8.673;2100 29.227 8.908;2200 29.984 9.139;2300 30.727 9.365;2500 32.174 9.806;2700 33.576 10.233;3000 35.602 10.851;3400 38.183 11.638;3600 39.428 12.017;3700 40.041 12.204;3800 40.647 12.389;3900 41.247 12.571;4000 41.841 12.753;4100 42.429 12.932;4200 43.012 13.11;4300 43.59 13.286;4400 44.163 13.46;4500 44.73 13.633;4600 45.293 13.805;4700 45.852 13.975;4800 46.405 14.144;4900 46.955 14.311;5000 47.5 14.477;6000 52.747 16.077;8000 62.37 19.01;8800 65.974 20.108;10000 71.173 21.693;12000 79.393 24.198;14000 87.172 26.569;15800 93.872 28.611;16000 94.601 28.833;18000 101.745 31.01'),
    banda: [1, 18000], tamb: 20, url: URL_ANDREW_COAX('FSJ1-50A'), nota: NOTA_ANDREW },
  { id: 'LDF1-50', clase: 'Corrugado de espuma 1/4″', fabricante: ANDREW, modelo: 'LDF1-50', metodo: 'tabla',
    puntos: T('1 0.394 0.12;1.5 0.483 0.147;2 0.558 0.17;10 1.254 0.382;20 1.781 0.543;30 2.188 0.667;50 2.838 0.865;85 3.724 1.135;88 3.791 1.156;100 4.049 1.234;108 4.213 1.284;150 4.993 1.522;174 5.392 1.644;200 5.798 1.767;204 5.858 1.785;300 7.168 2.185;400 8.342 2.543;450 8.88 2.706;460 8.984 2.738;500 9.391 2.862;512 9.511 2.899;600 10.351 3.155;700 11.244 3.427;800 12.084 3.683;824 12.278 3.742;894 12.833 3.911;960 13.339 4.066;1000 13.639 4.157;1218 15.192 4.63;1250 15.41 4.697;1500 17.04 5.194;1700 18.266 5.567;1794 18.823 5.737;1800 18.858 5.748;2000 20.003 6.097;2100 20.559 6.266;2200 21.104 6.432;2300 21.64 6.596;2500 22.686 6.914;2700 23.701 7.224;3000 25.171 7.672;3400 27.048 8.244;3600 27.956 8.521;3700 28.403 8.657;3800 28.846 8.792;3900 29.284 8.925;4000 29.719 9.058;4100 30.149 9.189;4200 30.576 9.319;4300 30.999 9.448;4400 31.419 9.576;4500 31.835 9.703;4600 32.249 9.829;4700 32.659 9.954;4800 33.066 10.078;4900 33.47 10.201;5000 33.871 10.323;6000 37.742 11.503;8000 44.888 13.681;8800 47.579 14.501;10000 51.475 15.689;12000 57.664 17.575;14000 63.552 19.37;15800 68.646 20.922'),
    banda: [1, 15800], tamb: 20, url: URL_ANDREW_COAX('LDF1-50'), nota: NOTA_ANDREW },
  { id: 'FSJ2-50', clase: 'Superflexible corrugado 3/8″', fabricante: ANDREW, modelo: 'FSJ2-50', metodo: 'tabla',
    puntos: T('1 0.383 0.117;1.5 0.469 0.143;2 0.542 0.165;10 1.219 0.372;20 1.732 0.528;30 2.128 0.649;50 2.762 0.842;85 3.626 1.105;88 3.691 1.125;100 3.943 1.202;108 4.103 1.25;150 4.864 1.482;174 5.254 1.601;200 5.65 1.722;204 5.709 1.74;300 6.99 2.13;400 8.139 2.481;450 8.665 2.641;460 8.767 2.672;500 9.166 2.794;512 9.283 2.829;600 10.107 3.081;700 10.983 3.347;800 11.807 3.599;824 11.998 3.657;894 12.542 3.823;960 13.04 3.974;1000 13.334 4.064;1218 14.861 4.529;1250 15.075 4.595;1500 16.68 5.084;1700 17.887 5.452;1794 18.436 5.619;1800 18.47 5.629;2000 19.599 5.974;2100 20.147 6.141;2200 20.685 6.305;2300 21.214 6.466;2500 22.247 6.781;2700 23.249 7.086;3000 24.701 7.529;3400 26.558 8.094;3600 27.456 8.368;3700 27.899 8.503;3800 28.337 8.637;3900 28.771 8.769;4000 29.201 8.9;4100 29.628 9.03;4200 30.051 9.159;4300 30.47 9.287;4400 30.886 9.414;4500 31.298 9.539;4600 31.708 9.664;4700 32.114 9.788;4800 32.518 9.911;4900 32.919 10.033;5000 33.316 10.154;6000 37.158 11.325;8000 44.264 13.491;8800 46.943 14.308;10000 50.826 15.491;12000 57.001 17.373'),
    banda: [1, 13400], tamb: 20, url: URL_ANDREW_COAX('FSJ2-50'), nota: NOTA_ANDREW },
  { id: 'LDF2-50', clase: 'Corrugado de espuma 3/8″', fabricante: ANDREW, modelo: 'LDF2-50', metodo: 'tabla',
    puntos: T('1 0.332 0.101;1.5 0.407 0.124;2 0.471 0.143;10 1.059 0.323;20 1.503 0.458;30 1.847 0.563;50 2.397 0.73;85 3.146 0.959;88 3.203 0.976;100 3.421 1.043;108 3.559 1.085;150 4.219 1.286;174 4.558 1.389;200 4.901 1.494;204 4.952 1.509;300 6.062 1.847;400 7.057 2.151;450 7.513 2.29;460 7.601 2.317;500 7.947 2.422;512 8.048 2.453;600 8.761 2.67;700 9.519 2.901;800 10.232 3.119;824 10.398 3.169;894 10.869 3.313;960 11.299 3.444;1000 11.554 3.521;1218 12.874 3.924;1250 13.059 3.98;1500 14.446 4.403;1700 15.49 4.721;1794 15.964 4.866;1800 15.994 4.875;2000 16.97 5.172;2100 17.443 5.316;2200 17.908 5.458;2300 18.365 5.597;2500 19.257 5.869;2700 20.122 6.133;3000 21.376 6.515;3400 22.978 7.003;3600 23.754 7.24;3700 24.136 7.356;3800 24.514 7.471;3900 24.888 7.586;4000 25.26 7.699;4100 25.627 7.811;4200 25.992 7.922;4300 26.354 8.032;4400 26.713 8.142;4500 27.069 8.25;4600 27.422 8.358;4700 27.773 8.465;4800 28.12 8.571;4900 28.466 8.676;5000 28.809 8.781;6000 32.121 9.79;8000 38.244 11.656;8800 40.551 12.359;10000 43.894 13.378;12000 49.209 14.998'),
    banda: [1, 13000], tamb: 20, url: URL_ANDREW_COAX('LDF2-50'), nota: NOTA_ANDREW },
  { id: 'FSJ4-50B', clase: 'Superflexible corrugado 1/2″', fabricante: ANDREW, modelo: 'FSJ4-50B', metodo: 'tabla',
    puntos: T('1 0.327 0.1;1.5 0.401 0.122;2 0.463 0.141;10 1.044 0.318;20 1.485 0.453;30 1.828 0.557;50 2.377 0.724;85 3.13 0.954;88 3.187 0.971;100 3.406 1.038;108 3.546 1.081;150 4.214 1.285;174 4.558 1.389;200 4.908 1.496;204 4.96 1.512;300 6.095 1.858;400 7.121 2.17;450 7.592 2.314;460 7.684 2.342;500 8.042 2.451;512 8.148 2.483;600 8.891 2.71;700 9.683 2.951;800 10.431 3.179;824 10.605 3.232;894 11.101 3.383;960 11.555 3.522;1000 11.824 3.604;1218 13.226 4.031;1250 13.423 4.091;1500 14.906 4.543;1700 16.027 4.885;1794 16.537 5.04;1800 16.57 5.05;2000 17.624 5.371;2100 18.137 5.528;2200 18.641 5.682;2300 19.138 5.833;2500 20.11 6.129;2700 21.056 6.418;3000 22.432 6.837;3400 24.198 7.375;3600 25.055 7.636;3700 25.478 7.765;3800 25.898 7.893;3900 26.314 8.02;4000 26.727 8.146;4100 27.136 8.271;4200 27.542 8.394;4300 27.946 8.517;4400 28.346 8.639;4500 28.744 8.761;4600 29.139 8.881;4700 29.531 9.001;4800 29.921 9.119;4900 30.308 9.238;5000 30.693 9.355;6000 34.427 10.493;8000 41.403 12.619;8800 44.054 13.427;10000 47.914 14.603'),
    banda: [1, 10200], tamb: 20, url: URL_ANDREW_COAX('FSJ4-50B'), nota: NOTA_ANDREW },
  { id: 'LDF4-50A', clase: 'Corrugado de espuma 1/2″', fabricante: ANDREW, modelo: 'LDF4-50A', metodo: 'tabla',
    puntos: T('1 0.211 0.064;1.5 0.259 0.079;2 0.299 0.091;10 0.672 0.205;20 0.954 0.291;30 1.172 0.357;50 1.521 0.463;85 1.995 0.608;88 2.031 0.619;100 2.169 0.661;108 2.256 0.688;150 2.673 0.815;174 2.887 0.88;200 3.103 0.946;204 3.135 0.956;300 3.835 1.169;400 4.462 1.36;450 4.749 1.447;460 4.804 1.464;500 5.021 1.53;512 5.085 1.55;600 5.533 1.686;700 6.009 1.831;800 6.456 1.968;824 6.56 1.999;894 6.855 2.089;960 7.124 2.171;1000 7.284 2.22;1218 8.11 2.472;1250 8.226 2.507;1500 9.093 2.771;1700 9.744 2.97;1794 10.039 3.06;1800 10.058 3.066;2000 10.666 3.251;2100 10.961 3.341;2200 11.251 3.429;2300 11.535 3.516;2500 12.09 3.685;2700 12.627 3.849;3000 13.407 4.086;3400 14.401 4.389;3600 14.882 4.536;3700 15.118 4.608;3800 15.353 4.679;3900 15.585 4.75;4000 15.815 4.82;4100 16.042 4.889;4200 16.268 4.958;4300 16.492 5.027;4400 16.714 5.094;4500 16.934 5.161;4600 17.153 5.228;4700 17.37 5.294;4800 17.585 5.36;4900 17.798 5.425;5000 18.01 5.489;6000 20.055 6.113;8000 23.826 7.262;8800 25.244 7.694'),
    banda: [1, 8800], tamb: 20, url: URL_ANDREW_COAX('LDF4-50A'), nota: NOTA_ANDREW },
  { id: 'AVA5-50', clase: 'Corrugado 7/8″ (Virtual Air)', fabricante: ANDREW, modelo: 'AVA5-50', metodo: 'tabla',
    puntos: T('1 0.113 0.034;1.5 0.138 0.042;2 0.16 0.049;10 0.359 0.11;20 0.51 0.156;30 0.627 0.191;50 0.814 0.248;85 1.068 0.326;88 1.088 0.332;100 1.162 0.354;108 1.209 0.368;150 1.433 0.437;174 1.548 0.472;200 1.665 0.507;204 1.682 0.513;300 2.059 0.628;400 2.398 0.731;450 2.553 0.778;460 2.583 0.787;500 2.7 0.823;512 2.735 0.834;600 2.977 0.907;700 3.235 0.986;800 3.478 1.06;824 3.534 1.077;894 3.694 1.126;960 3.841 1.171;1000 3.927 1.197;1218 4.377 1.334;1250 4.44 1.353;1500 4.912 1.497;1700 5.268 1.605;1794 5.429 1.655;1800 5.439 1.658;2000 5.771 1.759;2100 5.933 1.808;2200 6.091 1.856;2300 6.247 1.904;2500 6.55 1.996;2700 6.845 2.086;3000 7.272 2.217;3400 7.819 2.383;3600 8.083 2.464;3700 8.213 2.503;3800 8.342 2.542;3900 8.47 2.581;4000 8.596 2.62;4100 8.722 2.658;4200 8.846 2.696;4300 8.969 2.734;4400 9.092 2.771;4500 9.213 2.808;4600 9.333 2.845;4700 9.453 2.881;4800 9.572 2.917;4900 9.689 2.953;5000 9.806 2.989'),
    banda: [1, 5000], tamb: 20, url: URL_ANDREW_COAX('AVA5-50'), nota: NOTA_ANDREW },
  { id: 'AVA6-50', clase: 'Corrugado 1-1/4″ (Virtual Air)', fabricante: ANDREW, modelo: 'AVA6-50', metodo: 'tabla',
    puntos: T('1 0.079 0.024;1.5 0.097 0.03;2 0.113 0.034;10 0.253 0.077;20 0.36 0.11;30 0.443 0.135;50 0.576 0.176;85 0.758 0.231;88 0.772 0.235;100 0.825 0.251;108 0.858 0.262;150 1.019 0.311;174 1.102 0.336;200 1.186 0.361;204 1.198 0.365;300 1.471 0.448;400 1.717 0.523;450 1.829 0.558;460 1.851 0.564;500 1.937 0.59;512 1.962 0.598;600 2.14 0.652;700 2.329 0.71;800 2.507 0.764;824 2.548 0.777;894 2.666 0.813;960 2.774 0.846;1000 2.838 0.865;1218 3.171 0.967;1250 3.218 0.981;1500 3.569 1.088;1700 3.835 1.169;1794 3.955 1.206;1800 3.963 1.208;2000 4.212 1.284;2100 4.333 1.321;2200 4.452 1.357;2300 4.569 1.393;2500 4.798 1.462;2700 5.021 1.53;3000 5.345 1.629;3400 5.76 1.755;3600 5.961 1.817;3700 6.06 1.847;3800 6.16 1.877;4000 6.36 1.94'),
    banda: [1, 4000], tamb: 20, url: URL_ANDREW_COAX('AVA6-50'), nota: NOTA_ANDREW },
  { id: 'AVA7-50', clase: 'Corrugado 1-5/8″ (Virtual Air)', fabricante: ANDREW, modelo: 'AVA7-50', metodo: 'tabla',
    puntos: T('1 0.062 0.019;1.5 0.076 0.023;2 0.088 0.027;10 0.197 0.06;20 0.281 0.086;30 0.346 0.105;50 0.45 0.137;85 0.593 0.181;88 0.603 0.184;100 0.645 0.197;108 0.672 0.205;150 0.798 0.243;174 0.864 0.263;200 0.93 0.284;204 0.94 0.287;300 1.156 0.352;400 1.351 0.412;450 1.441 0.439;460 1.459 0.445;500 1.527 0.465;512 1.547 0.471;600 1.689 0.515;700 1.84 0.561;800 1.982 0.604;824 2.016 0.614;894 2.11 0.643;960 2.197 0.67;1000 2.249 0.685;1218 2.517 0.767;1250 2.554 0.779;1500 2.838 0.865;1700 3.053 0.93;1794 3.151 0.96;1800 3.157 0.962;2000 3.359 1.024;2100 3.457 1.054;2200 3.554 1.083;2300 3.649 1.112;2500 3.836 1.169;2700 4.017 1.224'),
    banda: [1, 2700], tamb: 20, url: URL_ANDREW_COAX('AVA7-50'), nota: NOTA_ANDREW },
];

// ---------------------------------------------------------------------
// Guías de onda elípticas ANDREW (HELIAX® Standard Elliptical Waveguide)
//   puntos: [f (GHz), dB/100 m, dB/100 ft]; banda de uso y corte del modo eTE11 (GHz)
//   Interpolación lineal en frecuencia entre puntos, solo dentro de la banda de uso.
// ---------------------------------------------------------------------
const URL_EW = (m) => `https://www.andrew.com/products/microwave/elliptical-waveguides-connectors-accessories/item${m.toLowerCase()}/`;
const NOTA_EW = 'Valores típicos («Values typical, unless otherwise stated») a 23,9 °C (75 °F).';
export const ELIPTICAS = [
  { id: 'EW37', banda: [3.6, 4.2], corte: 2.79, puntos: T('3.6 3.177 0.968;3.7 3.027 0.923;3.8 2.908 0.886;3.9 2.81 0.857;4 2.729 0.832;4.1 2.661 0.811;4.2 2.603 0.793') },
  { id: 'EW43', banda: [4.4, 5.0], corte: 2.78, puntos: T('4.4 2.983 0.909;4.5 2.948 0.899;4.6 2.917 0.889;4.7 2.889 0.881;4.8 2.864 0.873;4.9 2.842 0.866;5 2.822 0.86') },
  { id: 'EW52', banda: [5.6, 6.425], corte: 3.65, puntos: T('5.6 4.126 1.258;5.8 4.021 1.226;6 3.935 1.199;6.2 3.863 1.177;6.4 3.802 1.159') },
  { id: 'EW63', banda: [5.925, 7.125], corte: 4.001, puntos: T('5.925 4.878 1.487;6.13 4.738 1.444;6.33 4.626 1.41;6.53 4.533 1.382;6.73 4.454 1.358;6.93 4.387 1.337') },
  { id: 'EW77', banda: [7.125, 8.5], corte: 4.72, puntos: T('7.125 6.258 1.907;7.33 6.107 1.861;7.53 5.982 1.823;7.73 5.875 1.791;7.93 5.782 1.762;8.13 5.701 1.738;8.33 5.631 1.716') },
  { id: 'EW90', banda: [10.2, 11.7], corte: 6.5, puntos: T('10.2 10.649 3.246;10.4 10.503 3.201;10.6 10.371 3.161;10.8 10.253 3.125;11 10.146 3.093;11.2 10.049 3.063;11.4 9.961 3.036;11.6 9.88 3.012') },
  { id: 'EW127A', banda: [11.7, 13.25], corte: 7.67, puntos: T('11.7 12.276 3.742;11.95 12.086 3.684;12.2 11.918 3.633;12.45 11.769 3.587;12.7 11.634 3.546;12.95 11.514 3.509;13.2 11.405 3.476') },
  { id: 'EW180', banda: [17.7, 19.7], corte: 11.15, puntos: T('17.7 20.111 6.13;18.1 19.799 6.035;18.5 19.523 5.951;18.9 19.278 5.876;19.3 19.06 5.81;19.7 18.865 5.75'),
    nota: 'La ficha indica la banda 17,7–19,7 GHz (la descripción dice 17,3–19,7 GHz); se usa la banda de la tabla.' },
  { id: 'EW220', banda: [21.2, 23.6], corte: 13.338, puntos: T('21.2 28.042 8.547;21.6 27.799 8.473;22 27.577 8.406;22.4 27.376 8.344;22.8 27.192 8.288;23.2 27.024 8.237;23.6 26.87 8.19') },
].map((g) => ({ fabricante: ANDREW, modelo: g.id, url: URL_EW(g.id), tamb: 23.9, ...g, nota: [NOTA_EW, g.nota].filter(Boolean).join(' ') }));

// ---------------------------------------------------------------------
// Guías rectangulares WR (EIA RS-261 / IEC 60153-2): dimensiones interiores
// en pulgadas y banda recomendada del modo TE10 (GHz).
// La atenuación se calcula (TE10, pérdidas en las paredes) y se ha
// contrastado con la tabla de cobre de Gabriel Electronics (61 valores,
// WR-229 a WR-42: diferencias de +0,07 % a +0,34 %; la tabla declara ±5 %)
// y con la de Mi-Wave (WR-62, WR-28 y WR-22).
// ---------------------------------------------------------------------
export const RECTANGULARES = [
  { id: 'WR-284', iec: 'R32', a: 2.84, b: 1.34, banda: [2.6, 3.95] },
  { id: 'WR-229', iec: 'R40', a: 2.29, b: 1.145, banda: [3.3, 4.9] },
  { id: 'WR-187', iec: 'R48', a: 1.872, b: 0.872, banda: [3.95, 5.85] },
  { id: 'WR-159', iec: 'R58', a: 1.59, b: 0.795, banda: [4.9, 7.05] },
  { id: 'WR-137', iec: 'R70', a: 1.372, b: 0.622, banda: [5.85, 8.2] },
  { id: 'WR-112', iec: 'R84', a: 1.122, b: 0.497, banda: [7.05, 10.0] },
  { id: 'WR-90', iec: 'R100', a: 0.9, b: 0.4, banda: [8.2, 12.4] },
  { id: 'WR-75', iec: 'R120', a: 0.75, b: 0.375, banda: [10.0, 15.0] },
  { id: 'WR-62', iec: 'R140', a: 0.622, b: 0.311, banda: [12.4, 18.0] },
  { id: 'WR-51', iec: 'R180', a: 0.51, b: 0.255, banda: [15.0, 22.0] },
  { id: 'WR-42', iec: 'R220', a: 0.42, b: 0.17, banda: [18.0, 26.5] },
  { id: 'WR-34', iec: 'R260', a: 0.34, b: 0.17, banda: [22.0, 33.0] },
  { id: 'WR-28', iec: 'R320', a: 0.28, b: 0.14, banda: [26.5, 40.0] },
];
export const FUENTE_WR = {
  formula: 'Atenuación del modo TE10 por las pérdidas en las paredes: αc = Rs·(2bπ² + a³k²)/(a³·b·β·k·η), Rs = √(ωμ0/2σ) (D. M. Pozar, Microwave Engineering, 4.ª ed., Wiley, 2012, ec. 3.96).',
  dimensiones: 'Dimensiones y bandas normalizadas EIA RS-261 / IEC 60153-2 (designaciones WR y R).',
  contraste: 'Gabriel Electronics, «Rectangular Waveguide Attenuation» (cobre de alta conductividad, 24 °C, ±5 %) y Mi-Wave, Appendix A (2024).',
};

// Conductividad de los materiales (S/m)
export const MATERIALES = [
  { id: 'cobre', nombre: 'Cobre (IACS 100 %)', sigma: 1 / 1.7241e-8,
    fuente: 'IACS: cobre recocido patrón, resistividad 1,7241 µΩ·cm a 20 °C (IEC 60028).' },
  { id: 'aluminio', nombre: 'Aleación de aluminio 6061-T6 (43 % IACS)', sigma: 0.43 / 1.7241e-8,
    fuente: 'Conductividad 40–48 % IACS para 6061-T6 (USAF T.O. 33B-1-1, tabla 4-3); se toma el valor central, 43 %.' },
  { id: 'laton', nombre: 'Latón 70/30 (28 % IACS)', sigma: 0.28 / 1.7241e-8,
    fuente: 'Cartridge brass 70/30: 28 % IACS (Copper Development Association, copper.org).' },
];

// ---------------------------------------------------------------------
// Accesorios: valores típicos (o máximos) de catálogo, editables.
//   valor:  pérdida por unidad (dB);  coef: pérdida = coef·√f(GHz) (dB)
//   fmax:   frecuencia máxima de la ficha (GHz), para avisar
// ---------------------------------------------------------------------
export const ACCESORIOS = [
  { id: 'conector', nombre: 'Conector coaxial (N, 7-16, 4.3-10)', coef: 0.05, fmax: 8.8,
    detalle: 'Pérdida = 0,05·√f (f en GHz): coeficiente típico de los conectores ANDREW L4TNM-PSA (N) y L4TDM-PSA (7-16) para cable de 1/2″, banda 0–8800 MHz; la forma 0,05·√f(GHz) es la que usa también Times Microwave para sus conectores.',
    url: 'https://www.andrew.com/products/fiber-power-rf-connectivity-accessories/rf-connectivity/rf-connectors/iteml4tnm-psa/' },
  { id: 'conector-ew', nombre: 'Conector de guía elíptica (a brida rectangular)', valor: 0.01,
    detalle: 'Pérdida típica 0,01 dB de los conectores ANDREW 177SE y 177SCM (EW77, 7,125–8,5 GHz) y 137SEM (EW37).',
    url: 'https://www.andrew.com/products/microwave/elliptical-waveguides-connectors-accessories/item177se/' },
  { id: 'transicion', nombre: 'Transición guía–coaxial', valor: 0.25,
    detalle: 'Pérdida típica 0,25 dB del adaptador Fairview Microwave SMW112ACN (WR-112 a N hembra, 7,05–10 GHz).',
    url: 'https://www.fairviewmicrowave.com/content/dam/infinite-electronics/product-assets/fairview-microwave/product-datasheets/SMW112ACN.pdf' },
  { id: 'flexible', nombre: 'Tramo flexible retorcible (sección de 30,5 cm)', valor: 0.15,
    detalle: 'Pérdida 0,15 dB por pie (30,5 cm) de la guía flexible retorcible Fairview FM-W90TF007-12 (WR-90, 8,2–12,4 GHz).',
    url: 'https://www.fairviewmicrowave.com/content/dam/infinite-electronics/product-assets/fairview-microwave/product-datasheets/FM-W90TF007-12.pdf' },
  { id: 'codo', nombre: 'Codo de guía (E o H, 90°)', valor: 0.15,
    detalle: 'Pérdida típica 0,15 dB de los codos Pasternack PE-W112B001 (plano E) y PE-W112B002 (plano H), WR-112.',
    url: 'https://www.pasternack.com/pages/RF-Microwave-and-Millimeter-Wave-Products/waveguide-bends.html' },
  { id: 'ventana', nombre: 'Ventana de presurización', valor: 0.2,
    detalle: 'Pérdida máxima 0,2 dB de la ventana Pasternack PEWGP1007 (WR-112, 6,57–9,99 GHz).',
    url: 'https://www.pasternack.com/wr-112-waveguide-pressure-window-6.57-ghz-to-9.99-ghz-frequency-1000-watts-cw-input-power-1.25-1-max-vswr-and-copper-brass-body-pewgp1007-p.aspx' },
  { id: 'protector', nombre: 'Protector de descargas coaxial (tubo de gas)', valor: 0.2, fmax: 7,
    detalle: 'Pérdida < 0,2 dB del protector CITEL P8AX09-6G-N/FF (N hembra-hembra, DC–7 GHz).',
    url: 'https://www.mouser.com/datasheet/2/785/INC_202501EN_P8AX09_6G_N_FF-2256482.pdf' },
  { id: 'circulador', nombre: 'Circulador (por paso)', valor: 0.2,
    detalle: 'Pérdida 0,2 dB del circulador de guía Microwave Devices WC7.80/1.2 (WR-112, 7,2–8,4 GHz), según su ficha en everythingrf.',
    url: 'https://www.everythingrf.com/products/waveguide-rf-circulators/microwave-devices-inc/624-412-wc7-80-1-2' },
  { id: 'filtro', nombre: 'Filtro de canal (paso banda)', valor: 0.2,
    detalle: 'Pérdida máxima 0,2 dB del filtro paso banda de guía Pasternack PE-W112F001 (7,9–8,4 GHz).',
    url: 'https://www.pasternack.com/images/productpdf/PE-W112F001.pdf' },
  { id: 'acoplador-3', nombre: 'Acoplador híbrido 1+1 equilibrado (3 dB)', valor: 3.3,
    detalle: 'Pérdida 3,3 ± 0,3 dB en cada rama (acoplador híbrido equilibrado de 3 dB, Huawei OptiX RTN 600 ODU, tabla 2-4).',
    url: 'https://manualslib.com/manual/2853852/Huawei-Optix-Rtn-600-Odu.html?page=70' },
  { id: 'acoplador-6p', nombre: 'Acoplador 1+1 desequilibrado (6 dB), rama principal', valor: 1.7,
    detalle: 'Pérdida ≤ 1,7 dB en la rama principal (acoplador híbrido desequilibrado de 6 dB con interfaces de guía, Huawei OptiX RTN 600 ODU, tabla 2-4).',
    url: 'https://manualslib.com/manual/2853852/Huawei-Optix-Rtn-600-Odu.html?page=70' },
  { id: 'acoplador-6r', nombre: 'Acoplador 1+1 desequilibrado (6 dB), rama de reserva', valor: 6.5,
    detalle: 'Pérdida 6,5 ± 0,6 dB en la rama de reserva (acoplador híbrido desequilibrado de 6 dB, Huawei OptiX RTN 600 ODU, tabla 2-4).',
    url: 'https://manualslib.com/manual/2853852/Huawei-Optix-Rtn-600-Odu.html?page=70' },
  { id: 'otro', nombre: 'Otro elemento (valor propio)', valor: 0, detalle: 'Pérdida que indique la ficha del elemento.', url: '' },
];

// ---------------------------------------------------------------------
// Orientación: pérdidas de alimentador y multiplexor por banda según la
// UIT-R F.758-8 (02/2025), cuadros 8 a 11 (sistemas punto a punto).
// «0 dB corresponde a equipos totalmente exteriores; el valor alto, por
// debajo de 18/23 GHz, sale de unos 50 m de guía de onda flexible».
// ---------------------------------------------------------------------
// Cada banda tiene dos columnas (dos sistemas de ejemplo con distinta modulación);
// se muestran las dos separadas por «·» cuando la recomendación da ambas.
export const F758 = [
  { f: [3.7, 4.2], rango: '3', cuadro: 8 },
  { f: [4.4, 5.0], rango: '0 · 3', cuadro: 8 },
  { f: [5.925, 6.425], rango: '2,5 … 5,6 · 1,1 … 3', cuadro: 8 },
  { f: [6.425, 7.125], rango: '0 … 6,3 · 0 … 6,3', cuadro: 8 },
  { f: [7.11, 7.9], rango: '0 … 3,0 · 0 … 3,0', cuadro: 9 },
  { f: [7.725, 8.5], rango: '0 … 3,0 · 0 … 3,0', cuadro: 9 },
  { f: [10.0, 10.5], rango: '0 … 6,3 · 0 … 6,3', cuadro: 9 },
  { f: [10.5, 10.68], rango: '2,1 … 10,0', cuadro: 9 },
  { f: [10.7, 11.7], rango: '0 … 9,5 · 0 … 7,6', cuadro: 9 },
  { f: [12.75, 13.25], rango: '0 … 9,5 · 0 … 7,6', cuadro: 9 },
  { f: [14.4, 15.35], rango: '0 … 10,0 · 0 … 10,0', cuadro: 10 },
  { f: [17.7, 19.7], rango: '0 … 9,3 · 0 … 9,3', cuadro: 10 },
  { f: [21.2, 23.6], rango: '0 … 6,3 · 0 … 5,9', cuadro: 10 },
  { f: [24.25, 29.5], rango: '0 … 6,3 · 0 … 6,3', cuadro: 10 },
  { f: [31.8, 33.4], rango: '0 … 1,5 · 0 … 1,5', cuadro: 10 },
  { f: [36.0, 40.5], rango: '0 · 0', cuadro: 11 },
  { f: [40.5, 43.5], rango: '0 … 2,5 · 0 … 2,5', cuadro: 11 },
];
export const FUENTE_F758 = {
  ref: 'Recomendación UIT-R F.758-8 (02/2025), cuadros 8 a 11, fila «Feeder/multiplexer loss range (dB)»',
  url: 'https://www.itu.int/rec/R-REC-F.758/es',
  nota: '0 dB corresponde a equipos totalmente exteriores (radio junto a la antena); el valor alto, en las bandas por debajo de 18/23 GHz, se obtiene con unos 50 m de guía de onda flexible.',
};
