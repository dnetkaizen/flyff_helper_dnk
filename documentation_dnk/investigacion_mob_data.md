# Investigación: Obtener datos del mob seleccionado
**Sesión:** 2026-04-26  
**Objetivo:** Leer nombre, nivel y HP del mob seleccionado (Tab) para discriminar mobs peligrosos.

---

## Contexto técnico

El juego corre sobre **WebGL + Emscripten/WASM**. Todo el estado del juego vive dentro de la memoria lineal WASM. El canvas principal es WebGL (no 2D), lo que significa que el texto de la UI se renderiza como texturas, no como llamadas a `fillText`.

---

## Métodos intentados

### 1. Pixel sampling del canvas — PARCIAL
**Idea:** Copiar frame WebGL a canvas 2D temporal y leer píxeles de la franja superior donde aparece el panel del target.

**Resultado:**
- Se detectan filas con alta varianza de brillo (panel UI presente)
- Los colores obtenidos son de terreno/fondo, no del texto
- Se encontró `rgb(255,255,255)` en `y≈178` → posiblemente borde o texto blanco
- `rgb(116,241,255)` en `y=63 x=528` → color inusual, posible elemento UI
- **No se puede leer texto** — solo píxeles individuales sin OCR

**Por qué no funciona para texto:** El juego renderiza texto como texturas bitmap sobre polígonos WebGL. Un solo píxel no identifica letras.

**Útil para:** Detectar la barra de HP (banda horizontal de color sólido verde/rojo). Pendiente implementar.

---

### 2. window globals scan — FALLA
**Idea:** Buscar objetos JS en `window` con propiedades como `name`, `hp`, `level`.

**Resultado:** Solo encontró infraestructura Emscripten:
- `window.AL` → sistema de audio OpenAL (falso positivo)
- `window.JSEvents` → sistema de eventos de input (falso positivo)
- `window.EmValType` → binding C++ (falso positivo)
- `window.0` → iframe TCF (falso positivo)

**Conclusión:** El juego no expone datos de mobs como objetos JS.

---

### 3. WebSocket interception — FALLA (datos encriptados)
**Idea:** Interceptar paquetes WebSocket para leer nombre/HP del mob cuando se selecciona.

**Servidores detectados:**
- `wss://login-lb-universe.flyff.com/` → autenticación
- `wss://fwc-srv03-universe.flyff.com/` → servidor de juego

**Resultado:** Todos los paquetes son binarios encriptados. Las "strings" extraídas son ruido (`{Qj`, `iRB`, `wxd`...), no datos legibles. El protocolo de red usa encriptación personalizada.

**Método 1 — Subclase de WebSocket:** Crasheó el juego (pantalla negra). El juego detecta que el constructor nativo fue reemplazado.

**Método 2 — Hook `WebSocket.prototype.send`:** No crashea. Detecta conexiones correctamente. Pero los datos siguen siendo encriptados.

---

### 4. WASM HEAP search — FALLA (HEAP no expuesto)
**Idea:** Buscar el string "Aibatt" en la memoria WASM usando TextDecoder en chunks.

**Resultado:** `Module.HEAP8` no disponible. El build de Emscripten usado por Flyff no expone los buffers HEAP directamente en `window.Module`.

**Keys seguras disponibles en Module:**
```
totalDependencies, wasmBinary, requestAnimationFrame, pauseMainLoop, resumeMainLoop,
UTF8ToString, stringToUTF8, _malloc, _free, _main, calledRun,
platform_text_edited, platform_got_devicemotion_permission, platform_captcha_completed,
platform_websocket_open, platform_websocket_close, platform_websocket_message, ctx
```

**Nota:** `wasmBinary` es el archivo WASM crudo (para carga), no la memoria runtime. No útil para leer estado.

---

### 5. Hook Module.UTF8ToString — FALLA (no llamado por WASM)
**Idea:** Interceptar `Module.UTF8ToString` para capturar strings que el WASM convierte a JS.

**Resultado:** La función nunca disparó. El WASM usa su propia implementación interna de conversión de strings, no la función JS del módulo. `UTF8ToString` en Module es una utilidad para llamar desde JS, no desde WASM.

---

### 6. Hook Module.platform_text_edited — FALLA (nunca disparado)
**Idea:** `platform_text_edited` sonaba a callback cuando cambia texto de UI.

**Resultado:** Nunca se disparó durante selección de mobs ni durante el juego en general. Probablemente es para edición de campos de texto (chat input), no para UI del juego.

---

### 7. Hook Module.platform_websocket_message — FUNCIONA PARCIALMENTE
**Idea:** Interceptar el callback que recibe mensajes WebSocket antes de que entren al WASM.

**Resultado:** Se dispara correctamente con cada paquete recibido. Recibe un `MessageEvent` con `.data` binario. Sin embargo, los datos binarios son los mismos paquetes encriptados — la encriptación ocurre en el servidor y se desencripta DENTRO del WASM, por lo que `platform_websocket_message` recibe datos encriptados.

---

### 8. Hook CanvasRenderingContext2D.prototype.fillText global — PENDIENTE PROBAR
**Idea:** Si el juego usa algún canvas 2D (overlay de UI, chat, etc.), capturar todo texto renderizado.

**Estado:** Implementado en `opusnk`, pendiente confirmar con log.

**Hipótesis:** Poco probable que funcione porque el juego es puramente WebGL. Pero vale verificar.

---

## Conclusiones

| Método | Estado | Razón |
|---|---|---|
| Pixel sampling | Parcial | No puede leer texto, solo colores |
| Window globals | Falla | Datos no expuestos en JS |
| WebSocket | Falla | Paquetes encriptados |
| WASM HEAP | Falla | HEAP no expuesto en Module |
| UTF8ToString hook | Falla | WASM no usa la función JS |
| platform_text_edited | Falla | No se dispara para UI de mobs |
| platform_websocket_message | Parcial | Datos encriptados |
| fillText global | Pendiente | Bajo a probar |

---

## Caminos que quedan

### A. Barra de HP via píxeles (más viable a corto plazo)
El panel del target está confirmado en `y≈55-80` del canvas. La barra de HP es una franja horizontal de color sólido:
- HP alta → verde `rgb(~50, ~200, ~50)`
- HP media → amarillo
- HP baja → rojo

Implementar scan de línea horizontal buscando runs de color sólido en esa zona.

### B. Acceso HEAP via Module.asm (complejo)
En algunos builds Emscripten, la memoria es accesible via:
```javascript
const memory = Module.asm.__memory_base  // viejo
// o
const view = new Int8Array(Module.wasmMemory?.buffer)  // si wasmMemory existe
// o buscar en Module._malloc retornando una dirección para triangular el buffer
```

### C. Reverse engineering del protocolo de red (muy complejo)
Analizar el patrón de bytes encriptados para encontrar el key/IV y desencriptar paquetes. Requiere análisis del binario WASM.

### D. OCR sobre canvas (complejo, lento)
Usar Tesseract.js o similar para leer el texto del panel del target. Lento (~500ms por frame).

---

## Archivos relevantes

- `src/flyff.ts` → `sampleTargetUI()`, `scanTargetMemory()`, `searchHeapForMobName()`, `hookCanvasText()`
- `src/utils/wsInterceptor.ts` → WebSocket hook via `prototype.send`
- `src/utils/debugConsole.ts` → console con Download button
- `DL/` → logs descargados de sesiones de debug
