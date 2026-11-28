# Radioenlace PtP — guía rápida

**Radioenlace PtP** (*Point-to-Point*, punto a punto) es una aplicación web instalable (PWA)
para planificar y estudiar radioenlaces punto a punto: mapa táctil, perfil del terreno con
datos del IGN/CNIG, línea de visión, 1.ª zona de Fresnel con el límite del 60 %, curvatura
terrestre con factor k, presupuesto de enlace en espacio libre o con el modelo
**Longley–Rice (ITM)**, con cada cálculo explicado (fórmula, sustitución y unidades),
**mapas de cobertura** alrededor del transmisor, **altura mínima de las antenas** y
**ejercicios aleatorios con comprobación automática** para clase (con su código QR) y
**pérdidas de línea y accesorios** calculadas con los datos de las fichas de los fabricantes.
Hasta la versión 1.1 se llamaba *Radioenlace PxP*.

No necesita cuentas, claves ni servidor propio: son archivos estáticos.

---

## 1. Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página de la aplicación |
| `css/app.css` | Aspecto visual (claro y oscuro) |
| `js/version.js` | Nombre, versión y **código de Safe Creative** (lo único que se cambia al registrar) |
| `js/radio.js` | **Todos los cálculos** (dBm, pérdidas, Fresnel, curvatura, análisis del perfil) |
| `js/itm.js` | Modelo **Longley–Rice (ITM)**, traducido de la implementación de referencia del NTIA |
| `js/modelos.js` | Modelos de propagación: espacio libre y Longley–Rice, con sus explicaciones |
| `js/terreno.js` | Cotas del MDT del IGN por zonas fijas, respaldo Copernicus y relieve guardado sin conexión |
| `js/cobertura.js` | Cálculo de los mapas de cobertura (el mismo que el del enlace A–B, píxel a píxel) |
| `js/cobertura-worker.js` | Cálculo de la cobertura en segundo plano (Web Worker) |
| `js/cobertura-ui.js` | Panel, capa del mapa, leyenda, ficha del píxel y descargas de la cobertura |
| `js/cobertura-exportar.js` | Exportación de la cobertura a KMZ (Google Earth) y CSV |
| `js/ejercicios.js` | Ejercicios aleatorios: datos por alumno, soluciones, tolerancias y puntos de los ejercicios de cobertura |
| `js/ejercicios-ui.js` | Ejercicios en la interfaz (profesor y alumno) y diálogo del código QR |
| `js/qr.js` | Generador de códigos QR (norma ISO/IEC 18004), sin conexión |
| `js/enlace.js` | Enlaces para compartir: normales (`?e=`), comprimidos (`?z=`) y de ejercicio (`?g=`) |
| `js/catalogo-lineas.js` | Datos de cables coaxiales, guías de onda y accesorios, cada uno con su fuente |
| `js/lineas.js` | Cálculo de las pérdidas de la línea y de los accesorios de cada lado |
| `js/lineas-ui.js` | Panel «Pérdidas de cada lado» de la pestaña *Datos* |
| `js/p838.js`, `js/p676.js` | Atenuación específica por lluvia (UIT-R P.838-3) y por gases (UIT-R P.676-13) |
| `js/p530.js` | UIT-R P.530-19: multitrayecto, lluvia, nieve húmeda, paso al año (P.841-7) y criterio de despeje |
| `js/datos-uit.js`, `datos/uit-espana.json` | Mapas climáticos oficiales de la UIT recortados a España y su interpolación |
| `js/disponibilidad.js`, `js/disponibilidad-ui.js` | Cálculo de la disponibilidad y tarjeta de la pestaña *Cálculos* |
| `js/etsi.js` | Umbrales de recepción y capacidad mínima de la norma ETSI EN 302 217-2 V3.4.1 |
| `js/capacidad.js`, `js/capacidad-ui.js` | Capacidad según la modulación y modulación adaptativa (tarjeta de *Cálculos*) |
| `js/mapa.js` | Mapa táctil (capas IGN, ortofoto PNOA, MTN y OpenStreetMap) |
| `js/perfil.js` | Gráfico del perfil |
| `js/explicacion.js` | Textos de los cálculos paso a paso |
| `js/ejemplos.js` | Los dos ejemplos (aquí puedes añadir más) |
| `js/app.js` | Une todas las piezas |
| `manifest.webmanifest`, `sw.js`, `iconos/` | Lo que la hace instalable y usable sin conexión |
| `pruebas/` | Pruebas automáticas de los cálculos y de los planos (opcional) |

---

## 2. Publicarla gratis en internet (GitHub Pages, sin usar la terminal)

Solo hay que hacerlo una vez. Tus alumnos **no** necesitan cuenta.

1. Entra en <https://github.com> y crea una cuenta gratuita (botón *Sign up*).
2. Arriba a la derecha pulsa **+ → New repository**.
   - *Repository name*: `radioenlace` (o el nombre que quieras).
   - Marca **Public**.
   - Pulsa **Create repository**.
3. En la página del repositorio vacío, pulsa el enlace **uploading an existing file**.
4. Abre la carpeta de la app en tu ordenador (la que contiene `index.html`), selecciona **todo su contenido**
   (`index.html`, `css`, `js`, `iconos`, `sw.js`, `manifest.webmanifest`…) y
   arrástralo a la ventana del navegador. Importante: arrastra el contenido, no la
   carpeta que lo contiene. Espera a que se suban todos los archivos.
5. Abajo, pulsa **Commit changes**.
6. Ve a **Settings → Pages**. En *Build and deployment*, *Source*: **Deploy from a branch**;
   *Branch*: **main** y carpeta **/ (root)**. Pulsa **Save**.
7. Espera 1–2 minutos y recarga esa página: aparecerá la dirección, del tipo
   `https://TU-USUARIO.github.io/radioenlace/`. Esa es la dirección para tus alumnos.

**Para actualizarla más adelante:** sube de nuevo los archivos modificados con
*Add file → Upload files*. Si cambias algo, abre `sw.js` y sube el número de
`VERSION` (por ejemplo `radioenlace-v1.4.1`) para que los móviles descarguen la versión nueva.

**Al registrar una versión en Safe Creative:** abre `js/version.js`, cambia el número de la
línea `REGISTRO` por el código nuevo y súbelo. La pestaña *Acerca de*, el informe CSV y los planos
PDF, DXF y KML lo toman de ahí. Cambia también el código y el enlace de las líneas 3 y 4 de
`LICENSE`.

> Alternativas equivalentes: Netlify, Cloudflare Pages o el servidor web del centro.
> Cualquier alojamiento de archivos estáticos con **https** sirve (la instalación como
> app y el modo sin conexión exigen https).

---

## 3. Compartir con los alumnos (enlace o código QR)

- **Enlace:** copia la dirección de GitHub Pages y pégala en el aula virtual.
- **Código QR:** en la pestaña *Descargas*, pulsa **Código QR** y elige *La app (sin
  datos)* o *Este enlace*. Se genera en la propia app, también sin conexión: **Pantalla
  completa** para proyectarlo, o descárgalo en **PNG** o **SVG** para imprimirlo.
- **Compartir un ejercicio concreto:** dentro de la app, prepara los datos y pulsa
  **Compartir**. Se genera un enlace que abre la app con esos mismos emplazamientos y
  parámetros; desde la 1.4 va comprimido (`?z=`), así su QR es menos denso. Los enlaces
  `?e=` de versiones anteriores se siguen abriendo.

---

## 4. Añadirla a la pantalla de inicio

**iPhone / iPad (Safari)**
1. Abre la dirección en **Safari**.
2. Pulsa el botón **Compartir** (cuadrado con flecha hacia arriba).
3. Elige **Añadir a pantalla de inicio** → **Añadir**.

(La app también muestra un botón **Instalar** con estas instrucciones.)

**Android (Chrome)**
1. Abre la dirección en **Chrome**.
2. Pulsa **Instalar** en la app, o menú **⋮ → Instalar aplicación**
   (en algunos móviles aparece como *Añadir a pantalla de inicio*).

Una vez instalada se abre a pantalla completa y, aunque no haya conexión, se abre igual;
el mapa y el relieve ya consultados quedan guardados. Para relieve de zonas nuevas
necesita internet.

---

## 5. Probarla en tu ordenador antes de publicarla (opcional)

Por seguridad, los navegadores no ejecutan esta app con doble clic sobre `index.html`.
Necesitas un pequeño servidor local. La forma más sencilla:

- **Con Visual Studio Code:** instala la extensión *Live Server*, abre la carpeta y pulsa
  *Go Live* (abajo a la derecha).
- **Con Python instalado:** abre una terminal dentro de la carpeta y escribe
  `python -m http.server 8000`; luego visita `http://localhost:8000`.

Si no quieres instalar nada, publícala directamente (apartado 2) y pruébala allí.

---

## 6. Cómo se usa (resumen para el alumnado)

1. **Enlace:** arriba se ve si la app ya está instalada en el dispositivo o un botón para
   instalarla. Elige *A* o *B* en «Mover» y toca el mapa para situar ese punto, arrastra
   su marcador o escribe las coordenadas. La distancia también se puede escribir: B se
   desplaza manteniendo el rumbo.
2. **Datos:** frecuencia (MHz o GHz), potencia (W o dBm), alturas de antena, ganancias
   (dBi), pérdidas de cada lado (dB, escritas a mano o **calculadas** con la línea y los
   accesorios), sensibilidad (dBm), factor k, tipo de relieve y **modelo de propagación**
   (espacio libre o Longley–Rice, con sus parámetros).
3. **Perfil:** relieve con curvatura, línea de visión, 1.ª zona de Fresnel, límite del
   60 % y punto más comprometido. Toca el gráfico para leer los valores en cada punto.
   Los deslizadores cambian las alturas y la frecuencia al momento.
4. **Cálculos:** presupuesto, despeje de Fresnel y difracción (o Longley–Rice), disponibilidad
   (UIT-R P.530), capacidad según la modulación y cada fórmula con la sustitución numérica y sus unidades.
5. **Mapa de cobertura** (bajo el mapa, en *Enlace*): elige el radio y la antena receptora
   y pulsa *Calcular cobertura*. Con *Mover: Ninguno*, toca el mapa para ver los datos de un
   píxel y pulsa *Poner B aquí* para comprobarlo con el enlace A–B.
6. **Altura mínima** (bajo el perfil): altura de mástil de A, de B o de los dos para despejar
   el 60 % de la 1.ª zona de Fresnel; se dibuja en el perfil y se puede aplicar.
7. **Descargas:** enlace y código QR, ejercicios para clase, planos PDF/DXF/KML, tablas CSV
   para Excel y la cobertura en KMZ, PNG y CSV.
8. **Acerca de** (desde la 1.4.3): qué hace la app, para quién es, qué calcula, fuentes de los
   datos, privacidad, licencia completa, registro en Safe Creative y correo de contacto
   (jimmy.jdr112@gmail.com). Las demás pestañas solo llevan una línea con el autor y la licencia.

Ejemplos incluidos (menú *Elegir ejemplo…*):
- **Talavera de la Reina → Cerro Cruces** (Sierra de San Vicente): 5,8 GHz, 0,5 W,
  antenas de 30 dBi, relieve real del MDT25.
- **Ejercicio teórico de 5 GHz y 10 km:** comprueba automáticamente
  L = 126,4 dB, Prx = −23,4 dBm, margen = 66,6 dB y r₁ = 12,2 m en el punto medio.

---

## 7. Datos del relieve

- Fuente principal: **MDT25 del IGN/CNIG** (malla de 25 m), servido por el WCS INSPIRE
  de la IDEE (`servicios.idee.es/wcs-inspire/mdt`). Para trayectos de más de 80 km se usa
  el **MDT200**.
- Desde la versión 1.3 el relieve se pide por **zonas fijas** de 200 × 200 celdas (0,05° en
  el MDT25, unos 5,5 × 4,3 km), siempre con la misma petición. Así la cota de un punto es la
  misma en el enlace A–B y en el mapa de cobertura.
- Si el IGN no devuelve alguna cota (fuera de España, mar o fallo del servicio), se
  completa con **Copernicus GLO-90** (malla de 3″, ≈ 90 m) mediante la API pública de
  Open-Meteo, y la app lo indica. Si tampoco hay dato, avisa y marca en rojo los puntos sin cota.
- El relieve descargado se guarda en el dispositivo y **no se borra al actualizar la app**:
  el enlace A–B y los mapas de cobertura de las zonas ya descargadas funcionan sin
  conexión. En *Mapa de cobertura → Relieve guardado* se ven las zonas y se pueden borrar.
- El MDT es **suelo desnudo**: no incluye edificios ni arbolado.
- La app muestra en todo momento la fuente, la resolución y el número de cotas.
- La cobertura del MDT25 en EPSG:4258 es la Península y Baleares; en Canarias las cotas
  llegarán del respaldo Copernicus.

---

## 8. Modelo Longley–Rice (ITM)

En **Datos → Modelo de propagación** elige *Longley–Rice*. Aparecen sus parámetros:

| Parámetro | Por defecto | Notas |
|---|---|---|
| Clima radioeléctrico | 5 · continental templado | En la costa, 6 · marítimo templado sobre tierra |
| Refractividad N₀ | 301 unidades N | Entre 250 y 400 |
| Suelo | Medio (εr = 15, σ = 0,005 S/m) | También pobre, bueno, agua dulce y agua de mar |
| Polarización | Vertical | O horizontal |
| Fiabilidad en tiempo | 50 % (valor mediano) | También 90 %, 99 % y 99,9 % |

La variabilidad se calcula en modo *accidental*, sin variabilidad de ubicaciones
(emplazamientos fijos) y con las situaciones al 50 %.

- Con Longley–Rice, la pérdida **ya incluye el relieve**: no se suma la difracción en filo
  de cuchillo (UIT-R P.526). El despeje de Fresnel se sigue mostrando como información.
- El ITM calcula su propia curvatura a partir de N₀ y de la altitud del trayecto; el
  factor k de «Datos» solo se usa para dibujar el perfil y comprobar el despeje.
- El modo de propagación (línea de visión, difracción o dispersión troposférica) lo decide
  el ITM con su propio criterio: compara la distancia con el horizonte en tierra lisa de
  las alturas efectivas, no con el rayo real.
- Necesita el perfil completo. Si faltan cotas, la frecuencia está fuera de 20 MHz – 20 GHz
  o alguna antena fuera de 0,5–3000 m, la app lo avisa y usa espacio libre con difracción.
- `js/itm.js` reproduce función a función la implementación de referencia en C++ del
  NTIA/ITS (<https://github.com/NTIA/itm>, de dominio público). Se ha contrastado con ella en
  sus casos oficiales y en decenas de miles de casos aleatorios, con diferencias menores de
  10⁻⁹ dB (ver `pruebas/prueba-calculos.mjs`).

---

## 9. Mapas de cobertura

En la pestaña **Enlace**, debajo del mapa, despliega **Mapa de cobertura**:

| Opción | Valores | Notas |
|---|---|---|
| Radio | 5, **10**, 20 o 30 km | Con más de 20 km la app pide confirmación y dice cuánto hay que descargar |
| Resolución | **Normal** (200 × 200 píxeles) o fina (400 × 400) | Píxel de 50, 100, 200 o 300 m en normal; la fina, mejor en un ordenador |
| Antena receptora | **La de B** o propia | Altura, ganancia y pérdidas; se supone orientada hacia A |

- **Cómo se calcula:** para cada píxel se traza un perfil propio desde A hasta su centro,
  con las mismas cotas, el mismo número de puntos, el mismo modelo (el elegido en *Datos*) y
  el mismo presupuesto que el enlace A–B. Por eso **cada píxel da exactamente lo mismo que el
  enlace A–B con B en su centro**: compruébalo tocando el píxel y pulsando *Poner B aquí*.
- **Colores:** margen sobre la sensibilidad en bandas de 10 dB (0–10, 10–20, 20–30 y
  ≥ 30 dB); la leyenda indica también el nivel recibido en dBm. Gris: por debajo de la
  sensibilidad. Sin color: sin cálculo (faltan cotas, el modelo no se puede aplicar o a
  menos de 50 m de A).
- Se calcula en segundo plano, con barra de progreso y botón **Cancelar**. Si cambian los
  datos, el mapa se marca como *desactualizado* hasta volver a calcularlo.
- **Modo ejercicio:** el mapa se puede calcular, pero no se ve hasta pulsar *Comprobar resultados*.
- **Descargas:** KMZ para Google Earth (un KML no puede llevar la imagen dentro), imagen PNG
  con leyenda y datos, y CSV con una fila por píxel.

---

## 10. Altura mínima de las antenas

Bajo el perfil, despliega **Altura mínima de las antenas**. Con el criterio por defecto (**60 % de r₁**), la tabla da la altura
de mástil que hace falta para que la línea de visión deje libre al menos el 60 % del radio de
la 1.ª zona de Fresnel en todo el trayecto (criterio de la UIT-R P.530, § 2.2.2), con el factor k
de *Datos*:

- **B**, con A a su altura actual; **A**, con B a su altura actual; o **la misma** en los dos.
- Como la flecha y r₁ no dependen de las alturas, la condición es lineal y el resultado es
  exacto (no se tantea). Se redondea hacia arriba al decímetro y se indica el punto que la limita.
- La variante elegida se dibuja en el perfil (línea discontinua) y **Aplicar esta altura** la pone
  en los datos. También aparece en *Cálculos* (paso explicado) y en el informe CSV.
- Desde la 1.4.2, el **Criterio de despeje** puede ser el completo de la **UIT-R P.530-19, § 2.2.2.1**:
  la mayor de dos alturas, la que da 1,0·r₁ con k = 4/3 y la que da 0,0·r₁ (obstáculo aislado) o
  0,3·r₁ (obstáculo extendido) con el kₑ superado el 99,9 % del peor mes, kₑ = 157/(144 + 2 670/d)
  (en clima tropical, 0,6·r₁ si d > 30 km). La nota indica qué paso limita cada altura.

---

## 11. Ejercicios para clase

**Ejercicio aleatorio** (*Descargas → Ejercicio aleatorio…* o *Datos → Cargar ejemplo*):

| Nivel | Se pregunta |
|---|---|
| 1 · Presupuesto | Pérdidas en espacio libre, potencia recibida y margen (terreno plano) |
| 2 · Fresnel y curvatura | Además, r₁ en el punto medio y en el obstáculo, y la flecha en el obstáculo |
| 3 · Obstáculo y difracción | Además, altura del obstáculo sobre la línea de visión, ν, J(ν) y margen con difracción (UIT-R P.526) |
| 4 · Altura mínima | Además, altura mínima de la antena B (con A fija) para despejar el 60 % de r₁ |
| 5 · Línea coaxial | Atenuación del cable (fórmula k₁·√f + k₂·f de Times Microwave), pérdidas de cada lado con sus conectores, L, Prx y margen |
| 6 · Coaxial o guía | Bajada larga en A: fc y atenuación del modo TE10 de una guía WR de cobre (Pozar) frente a un coaxial, pérdidas de cada solución y margen con la guía |
| 7 · Despeje P.530 | kₑ del 99,9 %, r₁ y flechas con k = 4/3 y con kₑ en el obstáculo, y altura mínima de B con el criterio completo de la UIT-R P.530-19 |
| 8 · Disponibilidad | Margen F, despeje medio hc, multitrayecto del peor mes y del año (P.841-7), γR, A₀,₀₁, porcentaje de lluvia, indisponibilidad y minutos al año |
| 9 · Capacidad | Rb, margen e indisponibilidad de tres modulaciones (umbrales de la ETSI EN 302 217-2), capacidad garantizada y media con modulación adaptativa |

Los niveles 1 a 4 son acumulativos; del 5 al 9 cada nivel pregunta solo lo suyo. El enunciado
de los niveles 5 a 9 incluye las fórmulas y los datos de las fuentes (fichas del fabricante,
Recomendaciones UIT-R y norma ETSI), y los datos se eligen para que el ejercicio quede dentro
de la zona de validez de esas fórmulas (por ejemplo, en el nivel 8 el margen supera At y la
lluvia cae entre el 0,001 y el 1 % del año). Al pulsar **Comprobar resultados** se despliega la
tarjeta de la app que lo resuelve (líneas, altura mínima, disponibilidad o capacidad).

1. Elige el nivel y si se permite ver la solución, y pulsa **Crear ejercicio**: se obtiene un
   código de 6 letras y un enlace corto (`?g=…`) con su **código QR**.
2. Cada alumno abre el enlace y escribe **su número de lista**: recibe sus propios datos (los
   mismos en cualquier dispositivo), calcula a mano y escribe sus resultados en *Cálculos*.
   **Comprobar mis resultados** marca cada uno como correcto o no, sin decir la solución.
   Se aceptan pequeñas diferencias (0,2 dB en el presupuesto, 1 % en r₁ y flecha, 0,1 m en h,
   0,02 en ν, 0,3 dB en J; en los niveles 8 y 9, el 2 % en γR y A₀,₀₁ y el 5 % en los
   porcentajes de tiempo), así que vale usar c = 3·10⁸ m/s, 32,44 dB o R = 6370 km.
3. **Solucionario CSV**: datos y soluciones de cada alumno (del 1 al N o con tu lista).

Los datos y soluciones no viajan en el enlace: se generan en el dispositivo. Es una
herramienta para practicar, no un examen seguro.

**Ejercicio con el mapa de cobertura**: calcula un mapa y pulsa **Crear ejercicio con este
mapa…**. Elige *Predicción* (el mapa se ve al final; el alumno pulsa **Estudiar** para ver el
perfil desde A hasta cada punto) o *Lectura* (el mapa se ve desde el principio), y puntos
aleatorios por alumno (mitad con señal y mitad sin señal, lejos de los límites de las bandas)
o marcados por ti en el mapa. Para cada punto P1…Pn el alumno elige si la señal llega y con
qué margen. El alumno calcula el mismo mapa en su dispositivo con los mismos datos.

Para crear ejercicios a mano está también el relieve **Plano con un obstáculo agudo** en *Datos*,
con la distancia y la cota del obstáculo.

---

## 12. Pérdidas de línea y accesorios

En **Datos**, bajo la tabla de A y B, despliega **Pérdidas de cada lado: línea de transmisión y
accesorios**. Cada lado puede tener sus pérdidas **A mano** (como siempre) o **Calculadas**: la app
suma la atenuación de cada tramo de línea a la frecuencia del enlace y la de cada accesorio, y
rellena sola la casilla «Pérdidas (dB)».

| Elemento | Cómo se calcula | Datos |
|---|---|---|
| Cable coaxial | Fórmula del fabricante α = k₁·√f + k₂·f o su tabla, interpolada (log–log) | Times Microwave LMR, ANDREW HELIAX (LDF, FSJ, AVA), Belden RG-58, RG-213 y RG-174 |
| Guía elíptica | Tabla del fabricante, interpolada | ANDREW EW37 a EW220 (3,6 a 23,6 GHz) |
| Guía rectangular WR | Atenuación del modo TE₁₀ por las paredes (Pozar), con su corte | WR-284 a WR-28; cobre, aluminio o latón |
| Línea con datos propios | k₁ y k₂ o una tabla de la ficha que tengas | — |
| Accesorios | Valor típico de catálogo (editable) por unidad | Conectores, transiciones, flexibles, codos, ventanas, protectores, circuladores, filtros y acopladores 1+1 |

- Por defecto, cada elemento usa un **valor estándar de catálogo con su fuente**; si conoces el modelo,
  elígelo; si tienes la ficha de tu equipo, escribe su valor. Las fuentes (fabricante, ficha, enlace y
  fecha de consulta) están en *Fuentes de los datos*.
- La app **solo interpola dentro de la banda de uso** de cada ficha: fuera de ella (un cable por encima
  de su frecuencia máxima, una guía fuera de su banda o por debajo de su corte) avisa en rojo y mantiene
  el último valor válido. Dentro de la banda, si la tabla no llega al borde, se prolonga y se avisa.
- **Partir de** tres configuraciones típicas: radio junto a la antena (0 dB, como en la UIT-R F.758),
  radio en interior con bajada larga (50 m de guía elíptica por encima de 3 GHz o de coaxial grueso por
  debajo) y frecuencias bajas (coaxial con conectores y protector de descargas).
- **Copiar al lado B** (o A) copia la lista. El desglose aparece en *Cálculos* (pasos L<sub>A</sub> y
  L<sub>B</sub>) y en el informe CSV. En modo ejercicio el panel no se muestra.
- Los datos guardados y los enlaces de versiones anteriores se abren con sus pérdidas como valor manual.

---

## 13. Disponibilidad del enlace (UIT-R P.530-19)

En **Cálculos**, despliega **Disponibilidad del enlace**. La app calcula qué porcentaje del año el
desvanecimiento supera el margen del presupuesto y el enlace se corta:

| Efecto | Método | Datos de la UIT para el punto medio del trayecto |
|---|---|---|
| Multitrayecto (aire claro) | P.530-19, §§ 2.3.1–2.3.2 (peor mes) y § 2.3.4 con la P.841-7 (año) | K y dN₇₅ (ficheros LogK y dN75 de la P.530-19) |
| Lluvia | P.530-19, § 2.4.1, con γ<sub>R</sub> de la P.838-3 | R₀,₀₁ de la P.837-8 |
| Lluvia y nieve húmeda | P.530-19, § 2.4.2 (capa de fusión) | h₀ de la P.839-4 y P₀ de la P.837-8 (con T de la P.1510-1) |
| Gases (opcional) | P.676-13, sumada al presupuesto | T de la P.1510-1, ρ de la P.836-6 y presión de la P.835-7 |

- El **margen F** es el del presupuesto (con la difracción, si la hay). Con Longley–Rice se recalcula
  al **50 % del tiempo**, porque la variabilidad la añade la P.530.
- La **polarización** es la misma que la de Longley–Rice (cambiarla en un sitio la cambia en el otro).
- Los mapas oficiales están incluidos para **España peninsular, Baleares, Canarias, Ceuta y Melilla**
  (26–45° N, 19° O–5° E) y funcionan sin conexión. En *Datos climáticos del punto medio* se ven los
  valores del mapa; si tienes datos locales, escríbelos (tienen prioridad y se guardan).
- Resultados: p<sub>w</sub> del peor mes (corte no selectivo P<sub>ns</sub>), porcentaje del año por
  multitrayecto y por lluvia, **indisponibilidad** total, tiempo fuera de servicio y **disponibilidad**.
  La P.530 asigna el multitrayecto sobre todo a la calidad y la lluvia a la disponibilidad; la app los
  suma para dar una cifra única y lo explica. No incluye el desvanecimiento selectivo (depende del equipo).
- Todo aparece en *Cálculos paso a paso* y en el informe CSV. En modo ejercicio la tarjeta no se muestra.
- **Sumar la atenuación por gases** añade A<sub>a</sub> = γ·d al presupuesto de todo el enlace (está
  desactivada por defecto; la P.530 la recomienda por encima de unos 10 GHz).

---

## 14. Capacidad según la modulación (ETSI EN 302 217-2)

En **Cálculos**, despliega **Capacidad según la modulación** (desde la 1.4.4):

- **Velocidad binaria** de cada modulación: R<sub>b</sub> = CS/(1 + α)·log₂M·r, con la separación de canal
  CS, el factor de caída α (0,25 por defecto) y la tasa del código r (0,9). Esos valores por defecto dan
  cifras parecidas a las de las fichas comerciales (por ejemplo, unos 160 Mbit/s con 256QAM en 28 MHz).
- **Capacidad mínima (RIC)** y **umbral de recepción** para BER ≤ 10⁻⁶ de la norma europea ETSI EN 302 217-2
  V3.4.1 en la banda del enlace (anexos C a F: de 3,4 a 43,5 GHz). Si el canal no está en la norma, se
  deriva del más próximo (RIC × CS/CS<sub>k</sub> y umbral + 10·log(CS/CS<sub>k</sub>)) y se marca con *.
  Fuera de esas bandas (por ejemplo, 5,8 GHz) hay que escribir los umbrales de la ficha.
- Los umbrales de la norma son **límites que el equipo debe garantizar**: las fichas reales suelen ser
  varios dB mejores. Escribe los de tu equipo si los tienes (se guardan). **Usar** pone ese umbral como
  sensibilidad del receptor en *Datos*.
- **Marca las modulaciones** que admite tu equipo: con una sola es un enlace de modulación fija; con varias,
  de **modulación adaptativa**. Con el perfil y los datos climáticos, la app calcula con la P.530 el margen
  y la disponibilidad de cada modulación, la **capacidad garantizada** para el objetivo (99,99 % por
  defecto) y la **capacidad media del año**.
- 4096QAM no tiene clase en la norma: solo se usa con un umbral propio.

---

## 15. Estadísticas de uso (GoatCounter)

La app cuenta, de forma anónima y sin cookies, las visitas, las instalaciones, las
aperturas de la app ya instalada, los mapas de cobertura calculados, las descargas por tipo y,
desde la 1.4, los ejercicios, las alturas aplicadas y los códigos QR (eventos `instalacion`,
`apertura-instalada`, `cobertura-calculada`, `descarga-pdf`, `descarga-dxf-perfil`,
`descarga-dxf-planta`, `descarga-kml`, `descarga-csv-informe`, `descarga-csv-perfil`,
`descarga-cobertura-kmz`, `descarga-cobertura-png`, `descarga-cobertura-csv`,
`alturas-aplicadas`, `ejercicio-creado`, `ejercicio-iniciado`, `ejercicio-comprobado`,
`descarga-solucionario-csv`, `ejercicio-cobertura-creado`, `ejercicio-cobertura-iniciado`,
`ejercicio-cobertura-comprobado`, `qr-generado`, `descarga-qr-png`, `descarga-qr-svg` y, desde la 1.5,
`perdidas-linea-aplicadas`, `disponibilidad-calculada`, `gases-incluidos`, `altura-p530-aplicada`, desde la 1.4.3 `contacto-correo` y desde la 1.4.4 `capacidad-calculada` y `sensibilidad-etsi-aplicada`).
Nunca se envían los datos de los enlaces compartidos ni los identificadores de los alumnos. No hay ningún contador
visible: los datos se consultan en el panel <https://radioenlace.goatcounter.com>.
Las pruebas en `localhost` no se cuentan.

---

## 16. Comprobar los cálculos (opcional, para quien tenga Node.js)

```
node pruebas/prueba-calculos.mjs
node pruebas/prueba-planos.mjs
node pruebas/prueba-cobertura.mjs
node pruebas/prueba-ejercicios.mjs
node pruebas/prueba-qr.mjs
node pruebas/prueba-lineas.mjs
node pruebas/prueba-disponibilidad.mjs
node pruebas/prueba-capacidad.mjs
```

Comprueban el ejercicio de 5 GHz, la curvatura, la detección de obstáculos, la lectura
de datos del IGN, Longley–Rice frente a los casos oficiales del NTIA, los planos y que
cada píxel de la cobertura coincide exactamente con el cálculo punto a punto (con una red
simulada, sin conexión), que las soluciones de los ejercicios son las que calcula la app, las
tolerancias, la altura mínima, el código QR con los valores de la norma y que las pérdidas
de línea reproducen cada valor publicado en las fichas de los fabricantes. La de disponibilidad
contrasta la P.838-3 y la P.837 con los ejemplos de validación oficiales de la UIT y comprueba la
P.841-7, el multitrayecto, la lluvia, la nieve húmeda y el criterio de despeje de la P.530-19. La de
capacidad comprueba los valores de la norma ETSI, su coherencia interna y la modulación adaptativa.
La de ejercicios resuelve también los niveles 5 a 9 a mano, con las fórmulas del enunciado y
constantes redondeadas, y comprueba que todas esas respuestas se aceptan.

---

Datos: © Instituto Geográfico Nacional (IGN) · CNIG; © colaboradores de OpenStreetMap;
Copernicus DEM GLO-90 (ESA) vía Open-Meteo. Mapas climáticos: © UIT (Recomendaciones
UIT-R P.530-19, P.836-6, P.837-8, P.839-4 y P.1510-1). Modelo Longley–Rice traducido de la
implementación de referencia del NTIA/ITS (dominio público). Herramienta didáctica
inspirada en el flujo de trabajo de Radio Mobile; no comparte código con él.
