# ◈ PinkCat Nonograms Math Solver

Entrenador de nonogramas basado en normas matemáticas de deducción por línea. Construido con HTML, CSS y JavaScript, sin frameworks, sin build ni dependencias.

---

## What is this?

Aplicación web estática para practicar técnicas de deducción lógica en nonogramas. A la izquierda hay un tablero donde se editan las pistas de cada fila y columna; a la derecha, un panel de "normas" que funcionan como interruptores: al activar una, recorre todo el tablero y pinta automáticamente las casillas que esa norma puede garantizar como seguras, mirando únicamente las pistas de cada línea — sin recursividad y sin cruzar información con otras filas o columnas.

---

## Requirements

- Ninguno del lado del proyecto — es HTML/CSS/JS estático, sin build ni paquetes que instalar.
- Sí hace falta un servidor local para servirlo (por ejemplo, Python 3 con `python -m http.server`, o cualquier otro servidor estático).

---

## Getting Started

**First time:**
```
cd cronogram-trainer
python -m http.server 8000
```
No hay nada que instalar: levanta un servidor local sencillo y listo.

**After that:**
```
python -m http.server 8000
```
or cualquier otro servidor estático de tu preferencia (`npx serve`, `http-server`, la extensión Live Server de VS Code…) directamente.

No funciona abriendo `index.html` con doble clic: el protocolo `file://` rompe el popup de pistas en Chrome/Edge, y el desplegable de plantillas de prueba necesita `fetch()`, que tampoco funciona así.

---

## Features

- **4 normas de deducción por línea** — actívalas como interruptores y observa qué casillas quedan garantizadas como seguras, mirando solo las pistas de esa fila o columna.
- **Plantillas de prueba (solo lectura)** — un desplegable con tableros predefinidos, uno por cada norma, para probarlas sin rellenar nada a mano.
- **Editor de pistas** — un popup para escribir las pistas de cualquier fila o columna, con la suma comprobada en vivo frente a la longitud de la línea.
- **Pintado manual** — clic izquierdo rellena una celda de negro, clic derecho la marca con una X; mantener pulsado y arrastrar repite la misma acción sobre varias celdas.
- **Coordenada bajo el ratón** — una etiqueta sigue al cursor indicando qué fila/columna hay debajo.

---

## Notes

- El nombre interno del proyecto (carpeta, namespace JS `window.CronogramApp`, algunos mensajes) sigue siendo "Cronograma" — residuo de una confusión de nombres del desarrollo inicial, sin relación con el nombre público "PinkCat Nonograms Math Solver" ni con el comportamiento de la app. Ver el README técnico para el detalle.
- Las plantillas de prueba son de solo lectura por ahora: no hay forma de guardar escenarios nuevos desde la interfaz.
- La herramienta está pensada para descubrir qué celdas se pueden pintar mirando una única línea aislada, sin recursividad ni cruces con otras filas/columnas — no resuelve el nonograma completo (todavía).

---

## Technical Documentation

→ [Technical README](./README_TECH.md)
