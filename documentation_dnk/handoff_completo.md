# Handoff Completo — Flyff Universe Helper Bot
**Fecha:** 2026-04-26  
**Repositorio:** `C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper`  
**Documentación:** `documentation_dnk/` (dentro del repo)
**GitHub:** https://github.com/dnetkaizen/flyff_dnk.git
**Ramas:** `main` (prod), `ultronk` (ULTRON_NK), `opusnk` (Opus)

---

## Contexto del proyecto

Extensión de Chrome/Firefox para automatizar el juego Flyff Universe (https://universe.flyff.com/play).  
El juego usa **WebGL** (Emscripten/WASM) y sobreescribe el objeto `chrome` global.  
Stack: TypeScript + Webpack 5 + Bootstrap 5 + Draggabilly.

**Comandos de build:**
```bash
npm run build-chrome   # output: dist/chrome/
npm run build-firefox  # output: dist/firefox/
```

---

## Estado actual de cada sistema

### 1. Template Matching (tecla Alt) — PARCIALMENTE FUNCIONAL
- Template carga correctamente como base64 inline
- Canvas WebGL se copia a canvas 2D temporal para leer píxeles
- Píxeles blancos del template se ignoran en el matching
- **PROBLEMA:** confianza máxima = 0.431 vs threshold 0.70
- **CAUSA RAÍZ:** El template actual (`assets/monster_template.png`) es un sprite 2D de wiki/menú. El juego renderiza en 3D con iluminación diferente.
- **SOLUCIÓN PENDIENTE:** Tomar screenshot del monstruo en el juego, recortar solo el mob, reemplazar el PNG, regenerar el base64 (ver instrucciones abajo)

### 2. Radar de cursor (botón Target) — FUNCIONA
- Hace espiral desde el centro de pantalla
- Detecta cambio de cursor a `curattack` (el juego cambia el cursor al pasar sobre un mob)
- Hace clic cuando detecta el cursor
- **PROBLEMA PENDIENTE:** No diferencia entre monstruos normales y peligrosos (rojos/elite)
- Atacar un mob de categoría incorrecta mata al personaje y lo saca del área de leveo

### 3. Mouse handlers (JSEvents) — FUNCIONA
- `mouseReady=true` confirmado
- Bug del evento `load` corregido (ver sección de bugs)

### 4. Panel de debug en UI — FUNCIONA
- Botón "Debug" en el panel principal
- 4 herramientas de inspección: Scan Window, Scan DOM, Pixel Inspector, Scan Target
- Botones: copy, clear, ✕

---

## Bugs corregidos en esta sesión

### Bug 1: `chrome.runtime.getURL` devuelve undefined
**Causa:** El juego sobreescribe el objeto `chrome` global en contexto MAIN.  
**Fix:** Imagen embebida como base64 TypeScript en `src/utils/monster_template_b64.ts`.
```typescript
import monsterTemplateUrl from './utils/monster_template_b64';
// usa la URL directamente sin chrome.runtime
```

### Bug 2: `getContext('2d')` devuelve null en canvas WebGL
**Causa:** Un canvas con contexto WebGL activo no puede abrir contexto 2D.  
**Fix en `imageDetection.ts` → `detectInCanvas()`:**
```typescript
const tempCanvas = document.createElement('canvas');
tempCanvas.width = gameWidth;
tempCanvas.height = gameHeight;
const tempCtx = tempCanvas.getContext('2d')!;
tempCtx.drawImage(gameCanvas, 0, 0); // copia frame WebGL
const gameData = tempCtx.getImageData(0, 0, gameWidth, gameHeight);
```

### Bug 3: Evento `load` nunca se dispara
**Causa:** Extensión se inyecta en `document_end` — el evento `load` ya ocurrió.  
**Fix en `inputs.ts` → `initMouse()`:**
```typescript
if (document.readyState === 'complete') {
    tryInit(); // ejecutar directamente
} else {
    window.addEventListener('load', tryInit);
}
```

### Bug 4: Fondo blanco destruía el score de matching
**Fix en `imageDetection.ts` → `calculateMatchScore()`:**
```typescript
if (tr > 230 && tg > 230 && tb > 230) continue; // ignorar píxeles blancos
```

### Bug 5: Freeze del juego ~5 segundos durante detección
**Fix:** Stride aumentado de 2px a 4px + zona de búsqueda limitada al 70% central.  
Resultado: 420k posiciones → 46k posiciones, tiempo 7000ms → 488ms.

---

## Arquitectura de archivos relevantes

```
src/
├── flyff.ts                    # App principal (1800+ líneas)
│   ├── detectAndClickMonster() # Tecla Alt → template matching
│   ├── searchTarget()          # Botón Target → radar de cursor
│   ├── loadMonsterTemplate()   # Carga base64 del template
│   ├── debugLog()              # Log al panel de debug
│   ├── inspectWindow()         # Scan variables globales del juego
│   ├── inspectDOM()            # Scan elementos HTML del juego
│   ├── inspectTarget()         # Scan colores UI del target seleccionado
│   ├── togglePixelInspector()  # Inspector de pixel en tiempo real
│   └── initResize()            # Resize del panel con drag
├── ui/
│   └── html.ts                 # Templates HTML de la UI
│       └── container           # Panel principal con debug panel
├── utils/
│   ├── imageDetection.ts       # Template matching + logs detallados
│   ├── inputs.ts               # Mouse/keyboard injection + JSEvents
│   ├── timer.ts                # Delays
│   └── monster_template_b64.ts # Imagen base64 embebida (GENERADO)
└── assets.d.ts                 # Tipos TypeScript para imports PNG/JPG

assets/
├── monster_template.png        # Template actual (sprite 2D — reemplazar)
└── Pukepuke.jpg                # Original del usuario

manifest/
├── chrome.json                 # MV3, world: MAIN, incluye assets
└── firefox.json                # MV2, incluye assets
```

---

## Tarea principal pendiente: Filtrar monstruos por categoría

**El problema:** `cursorMutation` (detección de cursor `curattack`) dispara para CUALQUIER mob atacable — normales, rojos, elites, bosses. Atacar el tipo equivocado mata al personaje.

**Solución recomendada (Opción B — Tab-target + leer UI):**

1. Presionar Tab para seleccionar el monstruo más cercano
2. Leer el color del nombre/HP bar en la posición fija de la UI del juego
3. Comparar color con threshold:
   - Nombre blanco/gris → mob normal → atacar
   - Nombre rojo/naranja → mob peligroso → Escape, buscar otro
4. Si es correcto → atacar

**Para implementar esto necesitas primero:**
1. Usar **Scan Target** (botón en debug panel) con Tab sobre un mob normal → anotar colores
2. Usar **Scan Target** con Tab sobre un mob peligroso → anotar colores
3. Con esos valores implementar el filtro en `flyff.ts`

**Código aproximado del filtro:**
```typescript
private async isTargetSafe(): Promise<boolean> {
    const gameCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    const tmp = document.createElement('canvas');
    tmp.width = gameCanvas.width;
    tmp.height = gameCanvas.height;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(gameCanvas, 0, 0);

    // Leer franja superior donde aparece el nombre del target seleccionado
    // NOTA: ajustar y0, y1 según lo que muestre Scan Target
    const y0 = Math.floor(gameCanvas.height * 0.02);
    const y1 = Math.floor(gameCanvas.height * 0.08);
    const stripe = ctx.getImageData(0, y0, gameCanvas.width, y1 - y0);

    let redCount = 0, totalCount = 0;
    for (let i = 0; i < stripe.data.length; i += 4) {
        const r = stripe.data[i], g = stripe.data[i+1], b = stripe.data[i+2];
        if (r < 20 && g < 20 && b < 20) continue; // ignorar negro
        totalCount++;
        // Detectar si hay pixeles rojos dominantes (mob peligroso)
        if (r > 180 && g < 80 && b < 80) redCount++;
    }

    const redRatio = totalCount > 0 ? redCount / totalCount : 0;
    this.debugLog(`isTargetSafe: redRatio=${redRatio.toFixed(3)} (${redCount}/${totalCount})`, 'info');
    return redRatio < 0.1; // menos del 10% rojo = seguro
}
```

---

## Cómo reemplazar el template con screenshot real del juego

```powershell
# 1. Capturar screenshot del monstruo en el juego (Win+Shift+S, recortar solo el mob)
# 2. Guardar como monster_template.png en la carpeta assets/

# 3. Regenerar el archivo base64:
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper\assets\monster_template.png")
$b64 = [System.Convert]::ToBase64String($bytes)
$content = "const monsterTemplateB64 = `"data:image/png;base64,$b64`";`nexport default monsterTemplateB64;"
[System.IO.File]::WriteAllText("C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper\src\utils\monster_template_b64.ts", $content, [System.Text.Encoding]::UTF8)

# 4. Build
cd C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper
npm run build-chrome
```

---

## Panel de Debug — Referencia rápida

**Activar:** Botón "Debug" en el panel principal (se pone amarillo cuando está activo)

**Colores de log:**
- Blanco `#eee` → info general (flyff.ts)
- Azul claro `#4fc3f7` → éxito
- Rojo `#ef5350` → error
- Naranja `#ffb74d` → advertencia
- Gris `#ccc` → imageDetection.ts
- Azul `#90caf9` → inputs.ts

**Botones de inspección:**
- `Scan Window` → variables globales del juego en `window`
- `Scan DOM` → elementos HTML (canvas, UI elements)
- `Pixel Inspector` → RGB del pixel bajo el cursor en tiempo real
- `Scan Target` → colores dominantes en franjas de la pantalla (útil para leer UI del target)

**Resize del panel:** Arrastrar desde borde izquierdo (ancho), borde inferior (alto) o esquina inferior-izquierda (ambos)

---

## Información del entorno

- **OS:** Windows 10 IoT Enterprise LTSC 2021
- **Browser:** Chrome (Manifest V3)
- **Juego:** universe.flyff.com/play — WebGL, Emscripten/WASM
- **Node:** verificar con `node --version`
- **Extensión cargada en:** chrome://extensions → "Flyff Buttons" v0.0.6

---

## Próxima sesión — Checklist

- [ ] Reemplazar template con screenshot real del juego
- [ ] Ejecutar Scan Target con mob normal seleccionado → anotar colores
- [ ] Ejecutar Scan Target con mob peligroso seleccionado → anotar colores  
- [ ] Calibrar `isTargetSafe()` con los colores obtenidos (commit d17a234 en ultronk)
- [ ] Probar flujo completo: Target → Tab → isTargetSafe → atacar/skip
- [ ] Considerar mejora del radar: grid en lugar de espiral

---

## Cambios ULTRON_NK (sesión 2026-04-26)

### Implementado: `isTargetSafe()` en `src/flyff.ts`
- Lee franja superior del canvas (25% central, 2%-10% altura) tras Tab-target
- Detecta pixeles rojos (>180R, <80G, <80B) y naranjas (>200R, 100-180G, <60B)
- Thresholds: rojo >8% y > whiteRatio = peligroso, naranja >10% y > whiteRatio = agresivo
- Integrado en `attackTarget()`: searchTarget → Tab → isTargetSafe → atacar o Escape+skip
- **PENDIENTE CALIBRAR** con datos reales de Scan Target

### Git cleanup
- Eliminadas ramas: develop, docs/ia-workflow, session/ultron-20260426
- Creadas: `ultronk` (ULTRON_NK), `opusnk` (Opus)
- Estructura final: main / ultronk / opusnk
- [ ] Integrar filtro en el flujo: Tab → isTargetSafe() → atacar o skip
- [ ] Considerar mejora del radar: grid en lugar de espiral para búsqueda más rápida
