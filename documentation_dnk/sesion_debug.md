# Sesión de Debug — Flyff Universe Helper

**Fecha:** 2026-04-26  
**Estado:** En progreso

---

## Resumen ejecutivo

El sistema de detección por imagen (Alt) no funciona con el sprite 2D original.  
El sistema de radar por cursor (botón Target) **funciona correctamente**.  
Los handlers de mouse están correctamente inicializados tras corregir el bug del evento `load`.

---

## Cambios implementados en esta sesión

### 1. Imagen del template

**Problema:** La carpeta `assets/` no existía y la imagen tenía espacios en el nombre.

**Solución:**
- Creada carpeta `assets/` en la raíz del proyecto
- Imagen `Pukepuke.jpg` añadida por el usuario
- Convertida a `monster_template.png` (sin espacios) vía PowerShell
- Declarada en `web_accessible_resources` de ambos manifests

---

### 2. Bug: `chrome.runtime.getURL` devuelve undefined

**Archivo:** `src/flyff.ts` — `loadMonsterTemplate()`

**Causa:** El juego (Flyff Universe) sobreescribe el objeto `chrome` global en el contexto MAIN, haciendo que `chrome.runtime.getURL` devuelva `undefined`.

**Solución:** Embeber la imagen directamente en el bundle como constante base64 TypeScript.

```typescript
// src/utils/monster_template_b64.ts  (generado automáticamente)
const monsterTemplateB64 = "data:image/png;base64,...";
export default monsterTemplateB64;
```

**Generación:**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("assets/monster_template.png")
$base64 = [System.Convert]::ToBase64String($bytes)
# Guardar en src/utils/monster_template_b64.ts
```

---

### 3. Bug: Canvas WebGL no acepta `getContext('2d')`

**Archivo:** `src/utils/imageDetection.ts` — `detectInCanvas()`

**Causa:** Flyff Universe usa WebGL. Un canvas con contexto WebGL activo no puede devolver un contexto 2D — `getContext('2d')` retorna `null`.

**Solución:** Copiar el canvas WebGL a un canvas 2D temporal antes de leer píxeles:

```typescript
const tempCanvas = document.createElement('canvas');
tempCanvas.width = gameWidth;
tempCanvas.height = gameHeight;
const tempCtx = tempCanvas.getContext('2d')!;
tempCtx.drawImage(gameCanvas, 0, 0);  // copia el frame WebGL
const gameData = tempCtx.getImageData(0, 0, gameWidth, gameHeight);
```

---

### 4. Bug: Template con fondo blanco destruía el score

**Causa:** El sprite tiene fondo blanco (255,255,255). El algoritmo comparaba esos píxeles blancos contra el fondo del juego (no blanco), colapsando la confianza a ~9%.

**Solución:** Ignorar píxeles blancos/casi blancos del template en el cálculo:

```typescript
// En calculateMatchScore — saltar si el pixel del template es casi blanco
if (tr > 230 && tg > 230 && tb > 230) continue;
```

Resultado: confianza subió de **0.091** a **0.431**.

---

### 5. Bug: Evento `load` nunca se dispara en `inputs.ts`

**Archivo:** `src/utils/inputs.ts` — `initMouse()`

**Causa:** La extensión se inyecta en `document_end` (después de que el DOM está listo). El evento `load` ya se disparó antes de que el script arranque, por lo que `window.addEventListener('load', ...)` nunca ejecuta el callback. Los handlers `emitMouseDown/Up/Move` quedaban sin inicializar.

**Solución:** Verificar `document.readyState` antes de esperar el evento:

```typescript
if (document.readyState === 'complete') {
    tryInit();  // ya cargó, ejecutar directamente
} else {
    window.addEventListener('load', tryInit);
}
```

---

### 6. Freeze del juego durante el escaneo (~5 segundos)

**Causa:** El template matching escanea ~420,000 posiciones en el hilo principal del navegador.

**Solución aplicada:**
- Stride aumentado de **2px** a **4px** — reduce comparaciones a 25%
- Zona de búsqueda limitada al **70% central** del canvas (15% de margen por lado)
- Resultado: **488ms** de escaneo (antes ~7000ms), posiciones reducidas a ~46,200

---

### 7. Panel de debug en la UI

**Botón:** "Debug" — aparece debajo de "Cheats" en el panel principal

**Controles:**
- `copy` — copia todo el log al portapapeles
- `clear` — limpia el log
- `✕` — cierra el panel

**Colores por tipo de mensaje:**
| Color | Tipo | Módulo |
|---|---|---|
| Blanco `#eee` | Info general | flyff.ts |
| Azul claro `#4fc3f7` | Éxito | flyff.ts |
| Rojo `#ef5350` | Error | flyff.ts / imageDetection.ts |
| Naranja `#ffb74d` | Advertencia | flyff.ts |
| Gris `#ccc` | Info detallada | imageDetection.ts |
| Azul `#90caf9` | Info input | inputs.ts |

---

### 8. Resize del panel UI

El panel puede redimensionarse arrastrando desde los bordes:

| Zona | Cursor | Efecto |
|---|---|---|
| Borde izquierdo | `w-resize` | Ancho |
| Borde inferior | `s-resize` | Alto mínimo |
| Esquina inferior-izquierda | `sw-resize` | Ambos |

Implementado con handles absolutos (`#resize_left`, `#resize_bottom`, `#resize_corner`) y `stopPropagation` para no interferir con Draggabilly.

---

## Estado actual del sistema de detección

### Template matching (tecla Alt)

| Paso | Estado |
|---|---|
| Carga del template (base64 inline) | ✅ OK |
| Carga del ImageBitmap sin CSP issues | ✅ OK |
| Copia canvas WebGL a 2D temporal | ✅ OK |
| Píxeles útiles del template | ✅ 4948/25600 (19.3%) |
| Centro del template `(80,80)` | ✅ `[57,48,105]` (morado — cuerpo Pukepuke) |
| Tiempo de escaneo | ✅ ~488ms |
| Confianza máxima obtenida | ⚠️ 0.431 (threshold: 0.70) |
| Detección exitosa | ❌ No |

**Causa raíz:** El template es arte 2D (sprite de wiki/menú). En el juego el monstruo se renderiza en 3D con iluminación y perspectiva diferente — los colores no coinciden suficientemente.

### Radar de cursor (botón Target)

| Paso | Estado |
|---|---|
| Espiral desde el centro | ✅ OK |
| Detección de cambio de cursor `curattack` | ✅ OK — confirmado en debug |
| Handlers de mouse `mouseReady=true` | ✅ OK — bug del `load` corregido |
| Clic al detectar monstruo | ✅ OK |

---

## Próximos pasos

### Opción A — Arreglar template matching

1. Abrir el juego con un Pukepuke visible
2. Capturar screenshot recortado del monstruo en pantalla (`Win+Shift+S`)
3. Reemplazar `assets/monster_template.png` con el recorte
4. Regenerar `src/utils/monster_template_b64.ts`:
   ```powershell
   $bytes = [System.IO.File]::ReadAllBytes("assets/monster_template.png")
   $b64 = [System.Convert]::ToBase64String($bytes)
   "const monsterTemplateB64 = `"data:image/png;base64,$b64`";`nexport default monsterTemplateB64;" | Out-File src/utils/monster_template_b64.ts -Encoding utf8
   ```
5. `npm run build-chrome`

### Opción B — Mejorar el radar de cursor (recomendada)

El radar ya funciona. Mejoras posibles:
- Reemplazar la espiral fija por búsqueda en grid desde el centro
- Limitar el radio de búsqueda (no salir del área de juego)
- Hacer el movimiento más rápido (reduce el timer de 1ms a menos)
- Integrar con los timelines para que se active automáticamente

---

## Archivos modificados en esta sesión

| Archivo | Cambio |
|---|---|
| `assets/monster_template.png` | Creado (copia PNG de Pukepuke.jpg) |
| `src/utils/monster_template_b64.ts` | Creado (imagen embebida en base64) |
| `src/assets.d.ts` | Creado (tipos TypeScript para imports PNG/JPG) |
| `src/utils/imageDetection.ts` | Carga via Blob+ImageBitmap, canvas temporal, masking blanco, stride/margen, logs |
| `src/utils/inputs.ts` | Fix load event, mouseReady flag, logs detallados |
| `src/flyff.ts` | Panel debug, resize, import base64, debugLog, initResize |
| `src/ui/html.ts` | Panel debug HTML, handles de resize |
| `manifest/chrome.json` | `monster_template.png` en web_accessible_resources |
| `manifest/firefox.json` | Igual |
| `webpack/webpack.common.js` | Regla asset/inline para monster_template (no usada finalmente) |
