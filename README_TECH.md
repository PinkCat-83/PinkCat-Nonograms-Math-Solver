# 🔧 Technical README — PinkCat Nonograms Math Solver

> Internal reference for development, debugging, and AI-assisted work.
> → [Presentation README](./README.md)

---

## 🤖 AI Instructions

- Esperar a que el autor especifique qué hay que hacer antes de actuar.
- Pedir los archivos relevantes antes de hacer cualquier modificación.
- Todo el código (nombres de variables, funciones, comentarios, strings) debe escribirse en inglés. No introducir texto fijo en ningún otro idioma dentro del código.
- El español se reserva exclusivamente para la interfaz de usuario (textos visibles, etiquetas, mensajes) — nunca para el código.
- **No inventar normas nuevas.** Cada norma (regla de deducción) la define el usuario explícitamente, con su descripción y su fórmula matemática. Antes de implementar una, verificarla con casos concretos (a mano o con un script de Node) y confirmar con el usuario cualquier caso límite ambiguo (redondeos, exclusiones para evitar solapes con otra norma, etc.) antes de escribir el archivo de la regla.
- Cada norma vive en su propio archivo dentro de `js/rules/`, numerado con el prefijo de la norma que implementa (`1-`, `2-`, …). No mezclar la lógica de varias normas en un mismo archivo, ni añadir lógica de una norma a `grid.js` o `main.js`.
- `grid.js` es el único módulo que conoce el estado del tablero (pistas, normas activas, marcas manuales) y el que decide qué se pinta y con qué prioridad. Ningún otro archivo debe leer o escribir ese estado directamente.
- El namespace global ya es `window.NonogramApp` en todos los archivos (renombrado desde `window.CronogramApp`, residuo de la confusión inicial de nombres "Cronograma"/"Nonograma" — ver sección 11). El nombre de la carpeta raíz (`cronogram-trainer`) sigue siendo el antiguo; no renombrarla sin que el usuario lo pida explícitamente.
- Antes de crear o modificar cualquier archivo, verificar el comportamiento con un script puntual (Node, con o sin `jsdom` según haga falta) — no hay una suite de tests persistente todavía (ver sección 12).

---

## 1. Project Structure

```
cronogram-trainer/
├── index.html
├── css/
│   └── style.css
├── json/
│   └── scenarios.json
├── language/
│   └── translations.csv
└── js/
    ├── i18n.js
    ├── ruleManager.js
    ├── clueEditor.js
    ├── grid.js
    ├── main.js
    └── rules/
        ├── 1-blockComplete.js
        ├── 2-blockGreaterHalf.js
        ├── 3-blocksPlusGaps.js
        └── 4-blocksGreaterHalf.js
```

---

## 2. Module Responsibilities

| Archivo | Responsabilidad |
|---|---|
| `i18n.js` | Motor de idiomas: hace `fetch()` de `language/translations.csv`, lo parsea, y expone `t()`, `getLocale()`/`setLocale()`, persistencia en `localStorage`. Se carga antes que cualquier otro script. |
| `language/translations.csv` | **Única fuente de todos los textos de interfaz**, incluidos `name`/`hint` de las 4 normas — un archivo, separado por `;`, una columna por idioma. Ver sección 5. |
| `ruleManager.js` | Registro compartido de normas (`app.registerRule`, `app.rules`) y validación mínima del contrato de cada una. |
| `js/rules/*.js` | Una norma de deducción por archivo: su condición matemática, `isApplicable` y `computePaintMask`. `name`/`hint` son **claves de traducción** (strings), no el texto en sí. |
| `grid.js` | Estado completo del tablero (pistas, normas activas, marcas manuales), el barrido/pintado de normas, y el pintado manual con el ratón. |
| `clueEditor.js` | Popup reutilizable para escribir las pistas de una fila o columna. No conoce normas ni pintado. |
| `main.js` | Cableado de la interfaz: tarjetas de normas, formulario de tamaño, plantillas de prueba, coordenada bajo el ratón, selector de idioma. Espera a `app.i18n.load()` antes de arrancar nada más. |
| `json/scenarios.json` | Plantillas de prueba de solo lectura (tamaño + pistas ya rellenas). No localizado (ver sección 11). |

---

## 3. Data Format (`json/scenarios.json`)

Se lee con `fetch()` al iniciar la app (`main.js`); es de solo lectura, no hay forma de escribir en él desde la interfaz.

```json
{
  "scenarios": [
    {
      "id": "string único",
      "name": "nombre mostrado en el desplegable",
      "rows": 10,
      "cols": 20,
      "rowClues": [[3, 4], [1, 6]],
      "colClues": [[10], [9]]
    }
  ]
}
```

`rowClues`/`colClues` deben tener, respectivamente, longitud `rows`/`cols` — `Grid.loadScenario()` lo valida y no hace nada si no coincide (devuelve `false`). Cada elemento es un array de números (una línea puede tener varias pistas, p. ej. `[3, 4]`).

Escenarios incluidos actualmente: uno por cada norma (`norma1-demo` … `norma4-demo`) y uno de resumen (`overview-demo`, 10×20) con filas vacías a propósito y columnas que recorren las 4 normas, incluyendo variantes de 3 bloques y un caso donde ninguna norma se aplica.

---

## 4. Rule Contract & Board Sweep

Cada norma es un objeto plano registrado con `app.registerRule(rule)`:

```js
{
  id: string,
  name: string | {es, en, fr},  // string simple, o localizado (ver sección 5)
  color: string,                 // CSS color
  condition: string,              // texto plano, sin traducir, p.ej. "n = total"
  hint: string | {es, en, fr},   // mismo formato que `name`
  isApplicable(n, total): boolean,
  computePaintMask(n, total): boolean[]   // longitud = total
}
```

**Campo opcional `supportsMultipleClues`** (usado por las Normas 3 y 4): si es `true`, `isApplicable`/`computePaintMask` reciben el array completo de pistas de la línea en vez de un único número:

```js
isApplicable(clueValues, total): boolean
computePaintMask(clueValues, total): boolean[]
```

`grid.js` recorre el tablero completo (`repaintBoard()`) en cada cambio relevante (activar/desactivar una norma, editar pistas, regenerar el tablero, cargar una plantilla). `sweepDimension()` tiene dos rutas:
- **Normas de una sola pista** (sin el campo anterior): solo se evalúan en líneas con exactamente una pista válida (`suma ≤ longitud`).
- **Normas multi-pista** (`supportsMultipleClues: true`): reciben el array completo, sea cual sea su longitud; la propia norma decide cuántos bloques necesita.

Si dos normas activas pintan la misma celda, la que esté más abajo en `app.rules` (orden de registro = orden de los `<script>` en `index.html`) pinta encima.

---

## 5. Internationalization (i18n)

Selector real en la interfaz, 3 idiomas: español (`es`, por defecto), inglés (`en`) y francés (`fr`, elección arbitraria como tercer idioma, fácil de sustituir o ampliar). **Todos los textos viven en un único archivo**, `language/translations.csv` — no hay ningún texto de interfaz hardcodeado en JS, ni siquiera el `name`/`hint` de las normas.

**Formato del CSV** (separado por `;`, no por `,`):

```
key;Español;English;Français
app_title;Entrenador de Nonogramas;Nonogram Trainer;Entraîneur de Nonogrammes
rule_block_complete_name;Norma completa;Complete rule;Règle complète
```

- La cabecera dice el **nombre del idioma en sí mismo** (`Español`, no `es`); `i18n.js` traduce eso a un código corto (`es`) mediante `COLUMN_NAME_TO_LOCALE`, un mapeo fijo en el propio archivo. **Es frágil a propósito de forma simple**: si alguien cambia el texto de la cabecera del CSV, esa columna deja de reconocerse (se ignora con un `console.error`, no rompe el resto). Ver sección 11.
- Cada norma (`js/rules/*.js`) declara `name`/`hint` como **claves de traducción** (p.ej. `"rule_block_complete_name"`), no como el texto en sí ni como un objeto `{es,en,fr}` — el texto real solo existe en el CSV. `main.js` hace `app.i18n.t(rule.name)` para resolverlo.
- `condition` (la fórmula matemática, p.ej. `"n = total"`) **no está en el CSV en absoluto**: solo usa variables (`n`, `total`, `k`, `p`, `Σ`), que se leen igual en los tres idiomas, así que se queda como literal en el propio archivo de la regla.
- **Las plantillas de prueba (`json/scenarios.json`) no están en el CSV** — su campo `name` siempre se muestra en español, en cualquier idioma de la interfaz. Es una limitación conocida, no un olvido (ver sección 11).
- El delimitador es `;`, así que **ningún valor puede contener un `;` sin usar comillas** — la convención adoptada aquí es evitarlo directamente en el texto (ver el propio CSV), aunque el analizador sí soporta campos entre comillas (`"como este; con punto y coma"`, con `""` para escapar una comilla literal) por si algún valor futuro lo necesita.

**Piezas del motor (`app.i18n`, expuesto por `i18n.js`):**
- `load()` — hace `fetch("language/translations.csv")`, lo parsea y rellena los diccionarios. Devuelve una promesa; solo hace el `fetch` una vez aunque se llame varias veces. Si falla (archivo ausente, abierto sin servidor local...), no lanza ni cuelga la app: registra el error en consola y sigue con los diccionarios vacíos — `t()` entonces muestra la clave en crudo como texto visible, feo pero fácilmente depurable. **Deliberadamente no hay una segunda copia hardcodeada en JS como respaldo** — eso anularía el sentido de haber sacado los textos del código.
- `t(key, params)` — traduce una clave, interpolando `{placeholders}`. Si falta en el idioma actual, cae a español; si falta también ahí, devuelve la clave tal cual.
- `getSupportedLocales()` — códigos de idioma detectados en la cabecera del CSV, en el orden en que aparecen sus columnas.
- `getLocaleDisplayName(locale)` — el texto exacto de la cabecera para ese idioma (p.ej. `"Français"`), usado tal cual en el selector — un selector de idioma muestra convencionalmente cada opción en su propio idioma, no traducida.
- `setLocale(locale)` / `getLocale()` — cambia/lee el idioma actual; persiste en `localStorage` (con `try/catch`, por si el navegador lo bloquea).
- `onLocaleChange(callback)` — un único listener (lo usa `main.js`) que se dispara cuando `setLocale` cambia de verdad el idioma.

**Arranque asíncrono:** como los textos ya no están en memoria desde el principio, `main.js` espera a `app.i18n.load()` antes de hacer nada más — generar el tablero, montar las tarjetas de norma, todo. El texto en español que ya trae `index.html` de fábrica hace de "estado de carga" mientras tanto (igual que ya pasaba con `json/scenarios.json`, que sigue siendo un `fetch()` aparte y independiente).

**Por qué `grid.js` ya no construye mensajes de reglas:** `toggleRule()` devuelve datos estructurados (`{success, isActiveNow, appliedCount}`) en vez de un mensaje ya escrito, y es `main.js` quien arma el texto con `t(rule.name)` — es el único módulo que ya tenía `app.i18n` a mano para esto. `grid.js` sigue usando `app.i18n.t()` directamente para sus propios textos (etiquetas ARIA de las cabeceras, título del popup de pistas), que no dependen de ninguna norma.

**Qué pasa al cambiar de idioma en caliente:** `main.js` reaplica todas las traducciones estáticas, repuebla el selector de idioma y las tarjetas de norma (conservando cuál estaba activa), y repuebla el desplegable de plantillas de prueba si ya se había cargado. **No retraduce el mensaje que esté mostrándose en ese momento** en el banner de estado (p.ej. "Regla activada" o "Plantilla cargada") — ese mensaje se queda como estaba; solo la próxima acción sale ya en el nuevo idioma. Es una decisión de alcance, no una limitación técnica.

---

## 6. Rules Implemented

| # | Nombre | Condición | Alcance | Color |
|---|---|---|---|---|
| 1 | Norma completa | `n = total` | 1 pista | `#c0392b` (rojo, 6°) |
| 2 | Norma mayor que la mitad | `total/2 < n < total` | 1 pista | `#1c6e73` (teal, 183°) |
| 3 | Norma suma de bloques y espacios | `Σn + (k-1) = total` | 2+ bloques | `#94316f` (magenta/ciruela, 322°) |
| 4 | Norma distribución con margen | `p = total-(Σn+(k-1))`, `p>0` | 2+ bloques | `#4f7a1c` (verde oliva, 87°) |

Cada norma excluye deliberadamente el caso que duplicaría a la anterior de la tabla (p.ej. la 2 excluye `n=total` para no repetir la 1; la 3 y la 4 excluyen el caso de un único bloque para no repetir la 1 y la 2 respectivamente). La Norma 4 usa un algoritmo de solape "leftmost/rightmost" por bloque (ver el propio archivo `4-blocksGreaterHalf.js` para el detalle) — con un único bloque se reduce exactamente a la fórmula de la Norma 2.

Colores repartidos cada ~90° en la rueda de color a propósito, tras dos ajustes durante el desarrollo (ver sección 10).

---

## 7. Discarded Rules (5, 6 y 7)

Propuestas por el usuario y descartadas tras verificarlas con scripts de Node (fuerza bruta, o el propio algoritmo de la Norma 4) — ninguna llegó a implementarse como archivo:

- **Norma 5** ("suma de bloques igual a total − 1"): matemáticamente es el caso `p=1` de la Norma 4. Su descripción original ("todas seguras excepto la celda vacía") es incorrecta en cuanto hay más de un bloque.
- **Norma 6** ("patrones de bloques únicos"): dos resultados concretos anotados a mano (`1-4-1`, `2-3-2` en línea de 10), no una fórmula. Verificados por fuerza bruta: `2-3-2` coincidía con lo anotado, `1-4-1` no (desliz de anotación — el resultado correcto es distinto). Ambos, con el resultado correcto, ya los cubre la Norma 4.
- **Norma 7** ("regla de solapamiento"): el mismo algoritmo leftmost/rightmost por bloque que ya implementa la Norma 4, redescubierto con otra notación (`k`, `H` en vez de `n`, `p`). A diferencia de la 5 y la 6, no es un caso particular — es literalmente la misma norma.

Conclusión compartida con el usuario: dado que el alcance del proyecto es "una línea, sin recursividad, sin cruces" (sección 9), las 4 normas actuales agotan lo deducible de un solo vistazo; cualquier norma nueva que respete esa restricción será, con toda probabilidad, un caso particular o una redescripción de alguna de las 4 ya existentes.

---

## 8. Manual Cell Painting

Cableado en `grid.js` con event delegation sobre el `wrapperElement` (sobrevive a que `generate()`/`loadScenario()` reconstruyan el tablero por completo — no hay listeners por celda individual):

| Acción | Efecto |
|---|---|
| Clic izquierdo | Marca `"filled"` (relleno negro) |
| Clic derecho | Marca `"cross"` (una "X"); menú contextual del navegador suprimido sobre celdas |
| Arrastrar mientras se mantiene pulsado | Repite la misma acción (pintar o borrar) sobre cada celda nueva que toque el cursor |
| Clic sobre una celda que ya tiene esa misma marca | Vuelve a vacío |

La acción de todo un arrastre (pintar vs. borrar) se decide **una sola vez, al pulsar** — mirando si la celda de partida ya tenía esa misma marca — y no se re-decide celda a celda durante el arrastre.

**Prioridad — las normas siempre ganan al pintado manual:**
- El relleno negro se aplica con una clase CSS (`.is-manual-filled`), nunca con `style.backgroundColor` inline; como `paintLine()` sigue pintando con estilo en línea, este gana siempre en la cascada, sin lógica adicional.
- La X es un pseudo-elemento (`::after`) que solo se muestra si la celda no lleva la clase `.is-rule-painted` (añadida en `paintLine()`, quitada en `clearAllCellColors()` en cada repintado).
- El dato (`state.manualMarks`) se conserva siempre, esté o no visible en ese momento; si la norma que lo tapaba se desactiva, la marca reaparece sin que el usuario tenga que redibujarla.
- "Desactivar todo" **no** borra las marcas manuales — solo apaga las normas y limpia lo que ellas pintaron.

---

## 9. Deliberate Scope Constraints

Confirmado explícitamente por el usuario: la herramienta busca descubrir qué celdas se pintan **directamente**, mirando **una única línea aislada**, **sin recursividad** (no encadena una deducción sobre otra) y **sin cruzar información con otras filas/columnas** (no usa lo ya pintado en el tablero ni lo que se sepa de líneas cruzadas). No pretende resolver el nonograma completo.

Esto es lo que hace descartables las Normas 5, 6 y 7 (sección 7), y lo que separa "normas recursivas para resolver el puzzle completo" (sección 12, *A futuro*) de una quinta norma — es un modo/objetivo distinto del entrenador actual de una sola pasada, no una ampliación de las 4 normas existentes.

---

## 10. Bug History

- **Popup que no se cerraba nunca**: `.clue-popup-overlay` tenía `display:flex` fijo en CSS, que ganaba al atributo `hidden` del navegador. Corregido controlando la visibilidad con la clase `.is-open`.
- **Pintura obsoleta al editar pistas**: si se aplicaba una regla y luego se cambiaba la pista de la línea, el pintado anterior no se borraba. Llevó a rediseñar el pintado como un barrido completo recalculado desde cero en cada cambio (`repaintBoard()`), en vez de parches incrementales.
- **Solape matemático entre normas**: la Norma 2 original (`n > total/2`, sin límite superior) duplicaba a la Norma 1 cuando `n=total`; se añadió `n<total`. El mismo patrón de exclusión se repitió después entre las Normas 3-1 y 4-2.
- **Fórmula inicial incorrecta de la Norma 4**: la primera versión (un único rango central calculado con `p/2` para toda la línea) daba resultados incorrectos con varios bloques. Detectado enumerando a mano todas las colocaciones posibles de un caso real (`3 4` en longitud 9) y contrastándolo con el usuario; sustituido por el algoritmo leftmost/rightmost por bloque.
- **Colores demasiado parecidos**: la Norma 4 pasó de azul (`#2f5d8a`, 210°) a verde oliva (`#4f7a1c`, 87°) por estar a solo 60° del morado de la Norma 3. Después la propia Norma 3 pasó de ese morado poco saturado (`#6b4c8a`, 270°, 29% saturación) a magenta/ciruela (`#94316f`, 322°, 50% saturación), por leerse parecido al teal de la Norma 2 pese a los 87° de diferencia de matiz.
- **Cursor parpadeando en los bordes del tablero**: `cursor:pointer` solo estaba puesto en `.grid-cell`, no en los huecos de 2px (`gap`) entre celdas de `.crono-grid`, así que parpadeaba al cruzar esa línea. Movido al contenedor completo del grid.

---

## 11. Known Technical Debt

- El nombre de la carpeta raíz del proyecto (`cronogram-trainer`) sigue siendo un residuo de la confusión inicial "Cronograma"/"Nonograma", sin relación con el nombre público "PinkCat Nonograms Math Solver". El namespace JS ya se renombró (`window.NonogramApp`); renombrar también la carpeta es un cambio puramente de nomenclatura, pendiente de que se pida explícitamente (afecta a las rutas de los `<script src="...">` de `index.html`).
- La leyenda de símbolos del panel de reglas (`n`, `total`, `k`, `p`, `Σ`) es una lista estática escrita a mano en `index.html`, no generada a partir de las normas registradas — si se añade una norma con un símbolo nuevo, hay que actualizarla a mano (en los 3 idiomas).
- Las plantillas de prueba son de solo lectura a propósito (pedido explícito del usuario); no hay mecanismo de guardado desde la interfaz.
- **Las plantillas de prueba no están traducidas**: `json/scenarios.json` no tiene estructura `{es, en, fr}` (ni una fila en `translations.csv`) para el campo `name` de cada escenario, así que el desplegable de plantillas siempre muestra los nombres en español, sea cual sea el idioma de la interfaz. Traducirlas requeriría decidir el formato (¿claves en el mismo CSV, con prefijo tipo `scenario_norma1demo_name`? ¿un CSV aparte?) — no decidido todavía.
- **El mapeo de columnas del CSV es frágil a propósito**: `COLUMN_NAME_TO_LOCALE` en `i18n.js` reconoce las columnas del CSV por su texto exacto de cabecera (`"Español"`, `"English"`, `"Français"`). Si se renombra una cabecera en el CSV sin actualizar ese mapeo, esa columna se ignora (con un `console.error`, no rompe el resto, pero el idioma correspondiente se queda sin ningún texto).
- No hay suite de tests persistente: cada cambio se verifica con scripts puntuales de Node (con o sin `jsdom`) que se descartan al terminar.

---

## 12. Pending Tasks

- [x] Colores de las normas poco diferenciados
- [x] Visualizador de coordenada bajo el ratón
- [x] Pintado manual de celdas (clic + arrastre, con prioridad menor que las normas)
- [x] Renombrado `Cronogram` → `Nonogram` (namespace JS; nombre de carpeta pendiente, ver sección 11)
- [x] Sistema de idiomas (selector ES/EN/FR, ver sección 5)
- [ ] Visualizador de cómo se implementa cada norma — marcado como importante; pensado para que el propio usuario aprenda a implementar normas nuevas viendo un ejemplo visual paso a paso. Previsiblemente distinto por norma (una sola pista vs. varios bloques, solape vs. determinación exacta), no una plantilla única.
- [ ] *(A futuro)* Normas recursivas para resolver el nonograma completo — rompe a propósito el alcance actual (sección 9); sería un modo distinto, no una quinta norma.
- [ ] *(A futuro)* Leer un nonograma desde cámara/imagen y cargarlo directamente en el tablero — tensión real con el proyecto siendo estático y sin dependencias (sección "What is this?" del README de presentación); requiere decidir explícitamente una librería de OCR/visión por computador o un servicio externo antes de empezar a implementarlo.
