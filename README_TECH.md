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
- El namespace global sigue siendo `window.CronogramApp` en todos los archivos (residuo de la confusión inicial de nombres "Cronograma"/"Nonograma" — ver sección 10). No renombrarlo sin que el usuario lo pida explícitamente, aunque el nombre público del proyecto sea distinto.
- Antes de crear o modificar cualquier archivo, verificar el comportamiento con un script puntual (Node, con o sin `jsdom` según haga falta) — no hay una suite de tests persistente todavía (ver sección 11).

---

## 1. Project Structure

```
cronogram-trainer/
├── index.html
├── css/
│   └── style.css
├── json/
│   └── scenarios.json
└── js/
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
| `ruleManager.js` | Registro compartido de normas (`app.registerRule`, `app.rules`) y validación mínima del contrato de cada una. |
| `js/rules/*.js` | Una norma de deducción por archivo: su condición matemática, `isApplicable` y `computePaintMask`. |
| `grid.js` | Estado completo del tablero (pistas, normas activas, marcas manuales), el barrido/pintado de normas, y el pintado manual con el ratón. |
| `clueEditor.js` | Popup reutilizable para escribir las pistas de una fila o columna. No conoce normas ni pintado. |
| `main.js` | Cableado de la interfaz: tarjetas de normas, formulario de tamaño, plantillas de prueba, coordenada bajo el ratón. |
| `json/scenarios.json` | Plantillas de prueba de solo lectura (tamaño + pistas ya rellenas). |

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
  name: string,              // español, visible en la UI
  color: string,              // CSS color
  condition: string,           // texto plano, p.ej. "n = total"
  hint: string,                 // explicación en prosa, español
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

## 5. Rules Implemented

| # | Nombre | Condición | Alcance | Color |
|---|---|---|---|---|
| 1 | Norma completa | `n = total` | 1 pista | `#c0392b` (rojo, 6°) |
| 2 | Norma mayor que la mitad | `total/2 < n < total` | 1 pista | `#1c6e73` (teal, 183°) |
| 3 | Norma suma de bloques y espacios | `Σn + (k-1) = total` | 2+ bloques | `#94316f` (magenta/ciruela, 322°) |
| 4 | Norma distribución con margen | `p = total-(Σn+(k-1))`, `p>0` | 2+ bloques | `#4f7a1c` (verde oliva, 87°) |

Cada norma excluye deliberadamente el caso que duplicaría a la anterior de la tabla (p.ej. la 2 excluye `n=total` para no repetir la 1; la 3 y la 4 excluyen el caso de un único bloque para no repetir la 1 y la 2 respectivamente). La Norma 4 usa un algoritmo de solape "leftmost/rightmost" por bloque (ver el propio archivo `4-blocksGreaterHalf.js` para el detalle) — con un único bloque se reduce exactamente a la fórmula de la Norma 2.

Colores repartidos cada ~90° en la rueda de color a propósito, tras dos ajustes durante el desarrollo (ver sección 9).

---

## 6. Discarded Rules (5, 6 y 7)

Propuestas por el usuario y descartadas tras verificarlas con scripts de Node (fuerza bruta, o el propio algoritmo de la Norma 4) — ninguna llegó a implementarse como archivo:

- **Norma 5** ("suma de bloques igual a total − 1"): matemáticamente es el caso `p=1` de la Norma 4. Su descripción original ("todas seguras excepto la celda vacía") es incorrecta en cuanto hay más de un bloque.
- **Norma 6** ("patrones de bloques únicos"): dos resultados concretos anotados a mano (`1-4-1`, `2-3-2` en línea de 10), no una fórmula. Verificados por fuerza bruta: `2-3-2` coincidía con lo anotado, `1-4-1` no (desliz de anotación — el resultado correcto es distinto). Ambos, con el resultado correcto, ya los cubre la Norma 4.
- **Norma 7** ("regla de solapamiento"): el mismo algoritmo leftmost/rightmost por bloque que ya implementa la Norma 4, redescubierto con otra notación (`k`, `H` en vez de `n`, `p`). A diferencia de la 5 y la 6, no es un caso particular — es literalmente la misma norma.

Conclusión compartida con el usuario: dado que el alcance del proyecto es "una línea, sin recursividad, sin cruces" (sección 8), las 4 normas actuales agotan lo deducible de un solo vistazo; cualquier norma nueva que respete esa restricción será, con toda probabilidad, un caso particular o una redescripción de alguna de las 4 ya existentes.

---

## 7. Manual Cell Painting

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

## 8. Deliberate Scope Constraints

Confirmado explícitamente por el usuario: la herramienta busca descubrir qué celdas se pintan **directamente**, mirando **una única línea aislada**, **sin recursividad** (no encadena una deducción sobre otra) y **sin cruzar información con otras filas/columnas** (no usa lo ya pintado en el tablero ni lo que se sepa de líneas cruzadas). No pretende resolver el nonograma completo.

Esto es lo que hace descartables las Normas 5, 6 y 7 (sección 6), y lo que separa "normas recursivas para resolver el puzzle completo" (sección 11, *A futuro*) de una quinta norma — es un modo/objetivo distinto del entrenador actual de una sola pasada, no una ampliación de las 4 normas existentes.

---

## 9. Bug History

- **Popup que no se cerraba nunca**: `.clue-popup-overlay` tenía `display:flex` fijo en CSS, que ganaba al atributo `hidden` del navegador. Corregido controlando la visibilidad con la clase `.is-open`.
- **Pintura obsoleta al editar pistas**: si se aplicaba una regla y luego se cambiaba la pista de la línea, el pintado anterior no se borraba. Llevó a rediseñar el pintado como un barrido completo recalculado desde cero en cada cambio (`repaintBoard()`), en vez de parches incrementales.
- **Solape matemático entre normas**: la Norma 2 original (`n > total/2`, sin límite superior) duplicaba a la Norma 1 cuando `n=total`; se añadió `n<total`. El mismo patrón de exclusión se repitió después entre las Normas 3-1 y 4-2.
- **Fórmula inicial incorrecta de la Norma 4**: la primera versión (un único rango central calculado con `p/2` para toda la línea) daba resultados incorrectos con varios bloques. Detectado enumerando a mano todas las colocaciones posibles de un caso real (`3 4` en longitud 9) y contrastándolo con el usuario; sustituido por el algoritmo leftmost/rightmost por bloque.
- **Colores demasiado parecidos**: la Norma 4 pasó de azul (`#2f5d8a`, 210°) a verde oliva (`#4f7a1c`, 87°) por estar a solo 60° del morado de la Norma 3. Después la propia Norma 3 pasó de ese morado poco saturado (`#6b4c8a`, 270°, 29% saturación) a magenta/ciruela (`#94316f`, 322°, 50% saturación), por leerse parecido al teal de la Norma 2 pese a los 87° de diferencia de matiz.
- **Cursor parpadeando en los bordes del tablero**: `cursor:pointer` solo estaba puesto en `.grid-cell`, no en los huecos de 2px (`gap`) entre celdas de `.crono-grid`, así que parpadeaba al cruzar esa línea. Movido al contenedor completo del grid.

---

## 10. Known Technical Debt

- El namespace global sigue siendo `window.CronogramApp` en todos los archivos JS (arrastrado de la confusión inicial "Cronograma"/"Nonograma"), sin relación con el nombre público "PinkCat Nonograms Math Solver". Renombrarlo a algo como `NonogramApp` es un cambio puramente interno, pendiente de que se pida explícitamente.
- La leyenda de símbolos del panel de reglas (`n`, `total`, `k`, `p`, `Σ`) es una lista estática escrita a mano en `index.html`, no generada a partir de las normas registradas — si se añade una norma con un símbolo nuevo, hay que actualizarla a mano.
- Las plantillas de prueba son de solo lectura a propósito (pedido explícito del usuario); no hay mecanismo de guardado desde la interfaz.
- No hay suite de tests persistente: cada cambio se verifica con scripts puntuales de Node (con o sin `jsdom`) que se descartan al terminar.

---

## 11. Pending Tasks

- [x] Colores de las normas poco diferenciados
- [x] Visualizador de coordenada bajo el ratón
- [x] Pintado manual de celdas (clic + arrastre, con prioridad menor que las normas)
- [ ] Visualizador de cómo se implementa cada norma — marcado como importante; pensado para que el propio usuario aprenda a implementar normas nuevas viendo un ejemplo visual paso a paso. Previsiblemente distinto por norma (una sola pista vs. varios bloques, solape vs. determinación exacta), no una plantilla única.
- [ ] *(A futuro)* Normas recursivas para resolver el nonograma completo — rompe a propósito el alcance actual (sección 8); sería un modo distinto, no una quinta norma.
- [ ] *(A futuro)* Leer un nonograma desde cámara/imagen y cargarlo directamente en el tablero — tensión real con el proyecto siendo estático y sin dependencias (sección "What is this?" del README de presentación); requiere decidir explícitamente una librería de OCR/visión por computador o un servicio externo antes de empezar a implementarlo.
