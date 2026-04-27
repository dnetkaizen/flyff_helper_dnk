# Investigación: Obtener datos del mob seleccionado
**Sesión:** 2026-04-26  
**Objetivo:** Leer nombre, nivel y HP del mob seleccionado (Tab) para discriminar mobs peligrosos.  
**Estado:** Investigación cerrada para texto/nombre. Pixel HP bar = único camino pendiente.

---

## Contexto técnico

El juego corre sobre **WebGL + Emscripten/WASM**. Todo el estado del juego vive dentro de la memoria lineal WASM. El canvas principal es WebGL puro — texto, UI, barras de HP, todo se renderiza como polígonos/texturas WebGL. No existe ningún canvas 2D en la página.

---

## Resumen ejecutivo

| Método | Estado | Por qué no funciona |
|---|---|---|
| Window globals scan | ❌ DESCARTADO | Solo infraestructura Emscripten, no datos de mob |
| WebSocket intercept | ❌ DESCARTADO | Paquetes encriptados con clave en WASM |
| WASM HEAP search | ❌ DESCARTADO | `Module.HEAP8` no expuesto en este build |
| `Module.UTF8ToString` hook | ❌ DESCARTADO | WASM no llama a la función JS |
| `Module.platform_text_edited` | ❌ DESCARTADO | Solo para inputs de texto, no UI del juego |
| `Module.ctx.fillText` | ❌ DESCARTADO | `Module.ctx` es WebGL, no tiene `fillText` |
| `CanvasRenderingContext2D.prototype.fillText` global | ❌ DESCARTADO | Nunca disparó — juego usa WebGL puro |
| WebSocket subclase constructor | ❌ DESCARTADO + PELIGROSO | Crashea el juego (pantalla negra) |
| **Pixel scan HP bar** | 🔬 PENDIENTE TESTEAR | Panel ubicado en y≈65-85, falta encontrar la barra |
| OCR sobre canvas | ⏸ DESCARTADO por ahora | Lento (~500ms), complejo, no vale la pena aún |

---

## Métodos descartados — detalle

### 1. Window globals scan ❌
**Qué se hizo:** Iterar `Object.keys(window)` buscando objetos con propiedades como `name`, `hp`, `level`, `maxHp`.

**Resultado:** 4 hits, todos falsos positivos:
- `window.AL` → sistema de audio OpenAL de Emscripten
- `window.JSEvents` → sistema de eventos de input
- `window.EmValType` → binding C++ de Emscripten  
- `window.0` → iframe TCF (publicidad)

**Por qué no funciona:** El juego no expone estado de entidades como objetos JS. Todo vive en WASM memory.

---

### 2. WebSocket intercept ❌
**Qué se hizo:** Hookear `WebSocket.prototype.send` para detectar conexiones y escuchar mensajes.

**Servidores detectados:**
- `wss://login-lb-universe.flyff.com/` → autenticación (cierra en code 1000)
- `wss://fwc-srv03-universe.flyff.com/` → servidor de juego (permanente)

**Frecuencia de paquetes:** ~200-400ms, constante durante el juego.

**Tamaños observados:** 63b, 101b, 113b, 155b–660b (updates periódicos), 972b–5257b (bulk, posiblemente lista de entidades al seleccionar mob).

**Resultado:** Todos los paquetes son binario encriptado. Las strings extraídas son ruido aleatorio (`iRB`, `wxd`, `hRV`...). La clave de encriptación está dentro del WASM — no es recuperable desde JS sin reverse engineering del binario.

**Intento fallido adicional:** Subclase `class FlyffWS extends WebSocket` → crash pantalla negra. El juego verifica integridad del constructor nativo.

**Por qué no funciona:** Protocolo propietario encriptado. Sin key no hay datos legibles.

---

### 3. WASM HEAP search ❌
**Qué se hizo:** Intentar leer `Module.HEAP8` para buscar el string "Aibatt" con TextDecoder en chunks de 256KB.

**Resultado:** `Module.HEAP8` no existe. El build de Emscripten usado por Flyff Universe no expone los buffers HEAP en `window.Module`.

**Keys disponibles en Module (18-21 keys):**
```
totalDependencies, wasmBinary, requestAnimationFrame, pauseMainLoop, resumeMainLoop,
UTF8ToString, stringToUTF8, _malloc, _free, _main, calledRun,
platform_text_edited, platform_got_devicemotion_permission, platform_captcha_completed,
platform_websocket_open, platform_websocket_close, platform_websocket_message, ctx
```

**Nota:** `_malloc` y `_free` están expuestos pero sin acceso al buffer de memoria no son útiles.

**Por qué no funciona:** Build personalizado de Emscripten que no expone HEAP públicamente.

---

### 4. Module.UTF8ToString hook ❌
**Qué se hizo:** Reemplazar `Module.UTF8ToString` con función que loguea cada conversión de string WASM→JS.

**Resultado:** Nunca disparó durante el juego ni al seleccionar mobs.

**Por qué no funciona:** `Module.UTF8ToString` es una utilidad JavaScript para llamar desde JS code, no desde WASM. El WASM tiene su propia implementación interna de manejo de strings que no pasa por esta función.

---

### 5. Module.platform_text_edited hook ❌
**Qué se hizo:** Hookear `Module.platform_text_edited` esperando que se dispare al actualizar texto de UI (nombre del mob, HP).

**Resultado:** Nunca disparó durante selección de mobs ni durante el juego en general.

**Por qué no funciona:** Este callback es para edición de inputs de texto (campo de chat, login), no para renderizado de UI del juego.

---

### 6. Module.platform_websocket_message hook ⚠️ PARCIAL
**Qué se hizo:** Hookear `Module.platform_websocket_message` para interceptar mensajes WebSocket antes de que entren al WASM.

**Resultado:** Se dispara correctamente con cada paquete. Recibe el `MessageEvent` completo con `.data` como `ArrayBuffer`. Pero los datos son los mismos paquetes encriptados — la desencriptación ocurre DENTRO del WASM después de recibir los bytes.

**Útil para:** Detectar frecuencia de comunicación, tamaño de paquetes, timing. No para leer datos de mob.

---

### 7. CanvasRenderingContext2D.prototype.fillText global hook ❌ DEFINITIVO
**Qué se hizo:** Hookear el prototipo global de `fillText` para capturar cualquier texto 2D en la página.

**Resultado:** Nunca disparó. Zero llamadas durante toda la sesión.

**Por qué no funciona:** Confirma definitivamente que el juego usa WebGL puro para TODO el rendering. No existe ningún canvas 2D activo. El texto (nombres de mobs, HP, chat, UI) se renderiza como texturas bitmap sobre polígonos WebGL, nunca como `fillText`.

**Importancia:** Este es el hallazgo más importante de la investigación. Cierra definitivamente todos los métodos basados en texto JS.

---

## Único camino viable: Pixel scan de barra de HP

### Lo que sabemos del panel del target

Del análisis de múltiples logs:

| Sesión | Y del panel | Colores detectados |
|---|---|---|
| Log 1 | y≈178 | `rgb(255,255,255)` → píxel blanco (texto/borde) |
| Log 2 | y≈33-39 | Colores intermedios, terreno |
| Log 3 | y≈55-66 | Marrones/tierra |
| Log 4 | y≈65-85 | **Purpúreos** `rgb(76-88, 68-83, 83-121)` ← fondo del panel |

**Conclusión:** El panel se mueve dependiendo de la posición de la ventana del juego / resolución. Los **colores purpúreos** en el log 4 son claramente el fondo semitransparente del panel de target (distinto del terreno marrón/verde).

El color `x528=rgb(146,138,171)` (lila más brillante) probablemente es el **borde/marco** del panel.

### Cómo encontrar la barra de HP

La barra de HP en Flyff Universe es una franja horizontal de color sólido:
- **HP alta** → verde `rgb(~50-100, ~180-220, ~50-80)`
- **HP media** → amarillo/naranja
- **HP baja** → rojo `rgb(~200-255, ~30-60, ~30-60)`

**Estrategia:** Escanear línea por línea dentro del área purpúrea del panel buscando:
1. Filas con alta proporción de un color sólido dominante (R, G, o B >> otros dos)
2. Que esa fila tenga al menos 20px consecutivos del mismo color (es una barra, no ruido)

### Implementación pendiente

```typescript
// Buscar dentro del strip del panel (y=0 a y=25% canvas)
// Para cada fila, buscar run de píxeles de mismo color
// Si hay run > 20px de verde/rojo → es la barra de HP

private findHPBar(pixels: Uint8ClampedArray, cw: number, stripH: number) {
    for (let y = 0; y < stripH; y++) {
        let greenRun = 0, redRun = 0, maxGreen = 0, maxRed = 0;
        for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
            // Verde: g dominante
            if (g > 120 && g > r * 1.5 && g > b * 1.5) {
                greenRun++; maxGreen = Math.max(maxGreen, greenRun);
            } else greenRun = 0;
            // Rojo: r dominante
            if (r > 150 && r > g * 2 && r > b * 2) {
                redRun++; maxRed = Math.max(maxRed, redRun);
            } else redRun = 0;
        }
        if (maxGreen > 20) return { y, color: 'green', run: maxGreen };
        if (maxRed   > 20) return { y, color: 'red',   run: maxRed   };
    }
    return null;
}
```

---

## Lo que falta testear

### 🔬 Test 1: Detección de barra de HP (PRIORITARIO)
- Implementar `findHPBar()` en `sampleTargetUI()`
- Seleccionar mob con Target → ver si se detecta barra verde
- Comparar mob normal vs mob con HP baja vs mob peligroso (nombre rojo)
- **Resultado esperado:** Posición Y de la barra + color dominante

### 🔬 Test 2: Acceso HEAP via Module.asm (EXPLORACIÓN)
Verificar si la memoria WASM es accesible por ruta alternativa:
```javascript
// En DevTools con mob seleccionado:
Module._malloc        // debería retornar una dirección
// Luego buscar el buffer via:
Object.values(Module).find(v => v instanceof WebAssembly.Memory)
// o
WebAssembly.instantiate  // ver si hay referencia accesible
```

### 🔬 Test 3: Correlación tamaño paquete con selección de mob
Los paquetes grandes (4523b, 5257b) aparecen justo al seleccionar un mob. Verificar si siempre aparece un paquete de ese tamaño al hacer Tab, para identificar cuál es el "paquete de datos del mob".

---

## Archivos relevantes

| Archivo | Contenido |
|---|---|
| `src/flyff.ts` | `sampleTargetUI()`, `scanTargetMemory()`, `searchHeapForMobName()`, `hookCanvasText()` |
| `src/utils/wsInterceptor.ts` | WebSocket hook via `prototype.send` + capture mode |
| `src/utils/debugConsole.ts` | Console con fullLog buffer y botón Download |
| `DL/*.txt` | Logs de sesiones de debug (no commitear) |
