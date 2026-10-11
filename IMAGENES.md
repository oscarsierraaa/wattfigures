# Imágenes de WattFigures

**65 de 65.** 30 electrodomésticos, 34 cabeceras y la tarjeta social.

---

## El set está completo y sin defectos abiertos (28-07)

El Reino Unido entró el 28-07 y cierra las 65. La escena —un cuadro eléctrico en
el armario del hueco de la escalera, abrigos y aspiradora al lado, la puerta de
la calle al fondo— no repite habitación con ninguna de las otras trece, que era
el riesgo.

El mismo día se cerró el recorte que se comía las banderas — a España, Alemania,
Países Bajos y el propio Reino Unido las dejaba irreconocibles, y a las otras
diez les quitaba un filo. **No se rehizo ninguna foto**: se movió el recorte. Lo
que hay que saber está en «Las banderas» más abajo; lo único que importa para
trabajar es esto:

> Las 28 páginas de país llevan `<figure class="article-hero has-flag">`, y ese
> `has-flag` les ancla el recorte **abajo** en vez de al centro. Lo pone
> `generate-heroes.mjs` solo; no se escribe a mano.

Consecuencia al pedir una foto de país: la que se pierde ahora es **la franja de
arriba, el 24 % entero**, no un 12 % por cada lado. Encuadra pensando en eso.

> **Trampa de orden**: `build:images` corre **antes** que `build:countries`, así
> que si dejas el PNG de un país cuya carpeta todavía no existe, la primera
> pasada de `npm run build` falla y aborta la cadena. La segunda va bien. Solo
> pasa con países nuevos, no con estos 14, que ya están publicados.

Cómo funciona el montaje está en las cabeceras de `tools/build-images.mjs`,
`tools/generate-heroes.mjs` y `tools/appliance-art.mjs`, que es donde no se
queda viejo. Aquí solo vive lo que no está en el código: **con qué se generaron
y con qué criterio se aceptan.**

---

## Añadir o rehacer una

Deja el PNG en `_originals/images/` con el nombre correcto y `npm run build`.
Nada más: el conversor lo recorta y lo comprime, y el generador de cabeceras lo
engancha a las dos lenguas y repunta el `og:image`.

El nombre **es** el slug de la página. Si no coincide con ninguna, el build
falla y lo dice, en vez de dejarlo caer en la página equivocada.

| Qué | Nombre |
|---|---|
| Electrodomésticos | el slug de `data/appliances.json` |
| Guías y calculadoras | el nombre de la carpeta, tal cual |
| Páginas de precios | con prefijo de sección: `electricity-prices-us-states.png` |
| Tarjeta social | `social-card` |

El prefijo es la única excepción, y existe para que `_originals/images/` no
necesite subcarpetas.

**El formato de entrega no importa mucho**: el build recorta al centro a 16:9.
Seis de las últimas llegaron en 3:2 y 16:9 mezclados y salieron bien. Pero
conviene mirar el recorte antes de darlo por bueno si el sujeto está pegado al
borde de arriba.

**Y ojo, que el build no es el último recorte.** El navegador vuelve a recortar
la cabecera a 21:9 en escritorio (`assets/shared.css`, la media query de
`.article-hero img` a partir de 700 px). Sobre un 16:9 eso se lleva **el 24% del
alto**. Dónde se lo lleva depende de la página:

| | Se pierde | Sobrevive |
|---|---|---|
| Guías, calculadoras, electrodomésticos | 12% arriba y 12% abajo | del 12% al 88% |
| **Las 28 de país** (`has-flag`) | **24% de arriba, nada de abajo** | del 24% al 100% |

Todo lo que importe tiene que caer dentro de su banda. En móvil no se recorta
nada: por debajo de 700 px la proporción es la del propio fichero.

---

## El criterio de aceptación

La regla vieja era «que no se lea ningún texto». La real es más fina:

> **Un número solo pasa si no se le puede llamar falso.**

Una lectura de contador (`002543.38 kWh`) es un dato neutro: no afirma nada.
`3x230/400V` o `Cl.1 50Hz` son marcados reales de un equipo real. En cambio un
amperaje, un precio o un consumo **sí afirman algo**, y entonces tienen que
cuadrar con lo que dice el artículo que encabezan — o no salir legibles.

Lo que hay detrás: los modelos inventan letras y números, y un número inventado
en una web sobre facturas de luz es lo único que no podemos publicar.

---

## Las banderas, y el recorte que se las come

**Cambio de criterio del 27-07.** La regla anterior decía «sin banderas». Ahora
las 14 páginas de país llevan **la bandera sobrepuesta en la mitad derecha**,
como gráfico plano con esquinas redondeadas, al 20% del ancho. Decisión de
producto: sin ella la escena no dice de qué país habla la página.

Lo que costó aprender, y que no está en el código:

> **Una bandera de franjas horizontales pegada al borde inferior pierde una
> franja, y entonces ya no es esa bandera.**

Con el 12% inferior que se lleva el recorte 21:9, España se quedó en un bicolor
rojo/amarillo, Alemania en negro/rojo y Países Bajos en rojo/blanco. Las de
franjas **verticales** (Bélgica, Irlanda, Italia, Francia, Portugal, Canadá)
aguantan sin despeinarse: el recorte quita alto, y los colores van a lo ancho.

Es el mismo criterio de la sección anterior aplicado a un dibujo en vez de a una
cifra. Una bandera alemana sin el amarillo es un dato falso.

### Por qué no se arregló pidiéndolas mejor

Se intentó. Al pedirla no valen los porcentajes —el modelo los incumple— así que
se usó una referencia visual: «entre la bandera y el borde de abajo tiene que
caber otra bandera entera». **Y aun diciéndolo así falló**: el encargo del Reino
Unido del 28-07 llevaba esa frase escrita y la bandera volvió a 12 px del borde.

Medidas las catorce, ninguna cumplía. La bandera acababa así de abajo:

```
france 98,9%   belgium 96,4%   united-kingdom 94,9%   germany 94,4%
ireland 94,0%  italy 94,0%     spain 93,2%            canada 92,5%
netherlands 92,1%  portugal 92,1%  sweden 92,0%       united-states 91,7%
austria 91,4%  australia 91,2%
```

Y el recorte cortaba en el 88%. O sea: **el problema no eran cuatro fotos malas,
era una regla imposible de cumplir a ciegas.** Catorce de catorce fallaron.

### Lo que se hizo el 28-07: mover el recorte, no la foto

Las 28 páginas de país llevan `has-flag` y con eso el recorte se ancla abajo en
vez de al centro, así que **la bandera entera siempre sobrevive**, esté donde
esté. Lo pone `generate-heroes.mjs` a partir de `COUNTRY_PAGES`; una foto de país
nueva lo hereda sola.

Tenía que ser **abajo del todo** y no un valor intermedio: con Francia acabando
en el 98,9%, cualquier cosa por debajo del 96% la seguía cortando.

**Lo que hay que vigilar ahora es lo contrario.** Antes se perdía un 12% por
arriba; ahora se pierde el 24% de arriba entero. Al encargar una foto de país,
lo que esté en la franja superior —un techo, una lámpara colgada, la parte alta
de una ventana— no se va a ver en escritorio. Las catorce actuales se
comprobaron una a una con el recorte nuevo y ninguna se estropea, pero es la
comprobación que hay que repetir, no la de la bandera.

```js
// Lo que se ve en escritorio en una página de país: la banda inferior.
const m = await sharp(src).metadata();
const keepH = Math.round(m.width / (21 / 9));
await sharp(src).extract({ left: 0, top: m.height - keepH, width: m.width, height: keepH })
  .toFile('check.png');            // para guías y fichas, top: (m.height - keepH) / 2
```

**En las otras 37 imágenes la regla vieja sigue en pie**: recorte centrado, banda
del 12% al 88%, y lo que importe dentro.

Un cabo suelto conocido, y menor: el `og:image` que sale al compartir lo recorta
el scraper a 1,91:1 y **eso sí es centrado**, sin `has-flag` que valga, así que
deja fuera del 96,5% para abajo. Francia y Bélgica pierden un filo de bandera en
la tarjeta social. No se toca: el `og:image` es una miniatura y la vista
principal es el escritorio.

---

## Los prompts

### Electrodomésticos (4:3)

```
Product photograph of a modern [SUBJECT], centered, three-quarter front view,
floating on a seamless dark charcoal background (#141418), soft large softbox
light from the top left, subtle warm amber rim light (#F5A524) along the right
edge, gentle soft reflection beneath the object, generous empty space around the
subject, no text, no logos, no brand names, no watermarks, no people, no hands,
photorealistic, crisp product detail, studio commercial photography,
4:3 aspect ratio, 1600x1200
```

Negativo:

```
text, letters, numbers, watermark, logo, brand name, label, packaging, people,
hands, cluttered background, multiple objects, collage, cartoon, illustration,
3d render look, low resolution, blurry, distorted proportions
```

**Estas 30 son las únicas que hay que rehacer en bloque.** Son fichas de
estudio idénticas puestas en cuadrícula: una que no case se ve al instante. Si
hace falta rehacer una y la sesión original ya no existe, se rehace el bloque
entero.

### Guías, calculadoras y precios (16:9)

```
editorial photograph, natural window light, warm neutral colour grade, shallow
depth of field, real lived-in European home, no text, no logos, no watermarks,
16:9 aspect ratio
```

Delante va la descripción de la escena, y **lo que no quieras que salga dilo en
positivo** («los importes ilegibles y desenfocados»): ChatGPT no tiene campo de
prompt negativo, así que la lista de arriba no sirve ahí.

Estas 33 no se comparan nunca entre sí, así que da igual el modelo. Las 6 del
27-07 se hicieron en ChatGPT y no desentonan con las 13 del 21-07.

Para las de país, «European home» **no vale en las cuatro de fuera** (EE.UU.,
Canadá, Australia, y en su día cualquier otra): el panel de breakers americano
no se parece a un cuadro europeo, y pedir una casa europea da una imagen que
contradice a la página. Dilo explícitamente en esas.

Y las 14 de país se publican en la misma sección, así que **hay que forzar la
variedad a mano**: los 14 artículos son plantilla — mismo `lead` salvo la cifra
y las mismas cinco secciones — de modo que el contenido no diferencia nada. Si
les das el mismo briefing salen 14 cuadros eléctricos iguales. Lo que funcionó
fue asignar a cada país una escena distinta de antemano (patio con bomba de
calor, lavadero, galería, calle nevada, pasillo con el armario bajo la
escalera…), sin repetir habitación ni hora del día en dos seguidas.

Las catorce, para no repetirlas al rehacer alguna: Irlanda salón lluvioso ·
Bélgica patio con bomba de calor · Alemania lavadero en sótano · Países Bajos
recibidor a un canal · Suecia salón con nieve fuera · Portugal calle empedrada
con azulejos · Italia cocina con cafetera · Reino Unido pasillo con el cuadro en
el armario de la escalera.

### Tarjeta social (1200×630)

```
minimal dark graphic composition, deep charcoal background (#0E0E11), a single
amber (#F5A524) lightning-bolt glyph on the left, large generous empty space on
the right, subtle amber glow, flat vector style, no text, no letters, 1200x630
```

Sin letras a propósito: el nombre lo pone la web encima.

---

## A vigilar

- **`ev-charging`** — el coche recuerda a un Tesla. Es una escena de calle, no
  un retrato de producto, y ahí un coche reconocible es lo normal.
- **`electricity-prices-us-states`** — el paisaje es monte mediterráneo, no
  estadounidense. Como la página va de precios y no de geografía, y unas lomas
  secas con un pueblo al fondo podrían ser California, se deja.
Resuelto el 28-07: **las catorce banderas cortadas.** España, Alemania y Países
Bajos salían como bicolores que no eran su bandera, el Reino Unido perdía el 53%
de la Union Jack, y las otras diez perdían un filo. No se rehízo ninguna foto:
se ancló el recorte abajo en las páginas de país. Ver «Las banderas» arriba.

Resuelto el 27-07: **`contracted-power-spain`** decía `Max. 63 A` (14,5 kW), un
caso que la guía no cubre (sus tramos van de 2,30 a 9,20 kW). Rehecha con
`Max. 25 A` — 5,75 kW, un piso normal, y sí está en la tabla.

Resuelto: **`game-console`** era reconociblemente una PlayStation 5; sustituida
el 21-07 por una consola genérica.
