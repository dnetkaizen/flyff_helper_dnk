# Investigación de Eventos del Canvas — Flyff Universe
**Fecha:** 2026-04-26  
**Objetivo:** Extraer y monitorear todos los eventos del canvas WebGL para construir sistemas de farming, recolección de ítems y alimento de mascotas.

---

## Arquitectura del juego

Flyff Universe corre en **Emscripten** (C++ compilado a WebAssembly). La comunicación entre el engine del juego y el navegador pasa por:

```
C++ Engine (WASM)
    ↕
window.JSEvents          ← punto de interceptación principal
    ↕
Canvas WebGL             ← render del juego
    ↕
DOM / JavaScript         ← UI del juego
```

---

## window.JSEvents — El hub central

`window.JSEvents` es el objeto de Emscripten que gestiona todos los eventos del canvas. Es el punto más accesible para interceptar el estado del juego.

### Estructura

```javascript
window.JSEvents = {
    eventHandlers: [
        {
            eventTypeString: "mousedown",   // tipo de evento
            target: <canvas>,              // elemento objetivo
            eventListenerFunc: Function,   // handler del juego
            useCapture: boolean,
            allowsDeferredCalls: boolean
        },
        // ... más handlers
    ],
    deferredCalls: [],
    inEventHandler: 0,
    removeAllEventListeners: Function
}
```

### Cómo leer todos los handlers disponibles

```javascript
// Pegar en consola del juego o ejecutar desde la extensión
const handlers = window.JSEvents.eventHandlers;
const tipos = handlers.map(h => ({
    tipo: h.eventTypeString,
    target: h.target?.tagName,
    id: h.target?.id
}));
console.table(tipos);
```

### Handlers típicos encontrados en Flyff Universe

| eventTypeString | Descripción |
|---|---|
| `mousedown` | Clic izquierdo/derecho sobre canvas |
| `mouseup` | Soltar botón del mouse |
| `mousemove` | Movimiento del cursor |
| `keydown` | Tecla presionada |
| `keyup` | Tecla soltada |
| `wheel` | Scroll del mouse (zoom de cámara) |
| `touchstart` | Toque en mobile |
| `touchend` | Fin de toque |
| `touchmove` | Arrastre táctil |
| `resize` | Redimensión de ventana |
| `blur` / `focus` | Cambio de foco |
| `contextmenu` | Menú contextual (click derecho) |

---

## Técnica de Interceptación (Hook)

La forma más poderosa es **wrappear el handler original** de Emscripten para recibir todos los eventos antes que el juego.

### Interceptar mousedown (para detectar clics del juego)

```typescript
private hookMouseEvents() {
    const handlers = (window as any).JSEvents.eventHandlers;

    const mousedown = handlers.find((h: any) => h.eventTypeString === 'mousedown');
    if (!mousedown) return;

    const originalHandler = mousedown.eventListenerFunc;

    // Reemplazar con wrapper
    mousedown.eventListenerFunc = (event: MouseEvent) => {
        // Tu lógica ANTES que el juego procese el clic
        console.log(`[HOOK] mousedown en (${event.clientX}, ${event.clientY})`);
        
        // Llamar al handler original del juego
        originalHandler(event);
        
        // Tu lógica DESPUÉS que el juego procese el clic
    };
}
```

### Interceptar keydown (para detectar acciones del jugador)

```typescript
private hookKeyEvents() {
    const handlers = (window as any).JSEvents.eventHandlers;
    const keydown = handlers.find((h: any) => h.eventTypeString === 'keydown');
    if (!keydown) return;

    const original = keydown.eventListenerFunc;
    keydown.eventListenerFunc = (event: KeyboardEvent) => {
        this.debugLog(`[HOOK KEY] key="${event.key}" code="${event.code}"`, 'info');
        original(event);
    };
}
```

---

## Detección de Eventos del Juego via MutationObserver

El juego actualiza el DOM cuando ocurren eventos importantes. Observar estas mutaciones permite detectar estados del juego sin acceder a WASM.

### Eventos detectables via DOM

```typescript
private initGameObservers() {
    // 1. Cambio de cursor → detecta tipo de objeto bajo el mouse
    const cursorObserver = new MutationObserver(() => {
        const cursor = document.body.style.getPropertyValue('cursor');
        
        if (cursor.includes('curattack'))  this.onMobDetected();
        if (cursor.includes('curnpc'))     this.onNPCDetected();
        if (cursor.includes('curitem'))    this.onItemDetected();   // item en el suelo
        if (cursor.includes('curportal'))  this.onPortalDetected();
        if (cursor.includes('curdefault')) this.onNothingDetected();
    });
    cursorObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['style']
    });

    // 2. Cambios en la UI (aparición de loot, notificaciones, etc.)
    const uiObserver = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    this.debugLog(`[DOM] Nodo añadido: ${node.tagName} class="${node.className}"`, 'info');
                }
            });
        });
    });
    uiObserver.observe(document.body, { childList: true, subtree: true });
}
```

### Cursores conocidos de Flyff Universe

| Cursor URL | Evento del juego |
|---|---|
| `curattack.png` | Mouse sobre mob atacable |
| `curnpc.png` | Mouse sobre NPC |
| `curitem.png` | Mouse sobre ítem en el suelo |
| `curportal.png` | Mouse sobre portal/dungeon |
| `curdefault.png` | Sin objetivo |

> **Clave para filtrar mobs:** Leer el color del nombre del target DESPUÉS de que `curattack` se dispare. El color del nombre diferencia categorías de mobs.

---

## Sistema de Canvas Polling — Leer estado del juego por píxeles

Para datos que no están en el DOM (HP, MP, EXP, cantidad de ítems), se puede leer directamente el canvas en regiones específicas.

### Arquitectura del polling

```typescript
class GameStateReader {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tmp: HTMLCanvasElement;
    private tmpCtx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.querySelector('canvas')!;
        this.tmp = document.createElement('canvas');
        this.tmpCtx = this.tmp.getContext('2d')!;
    }

    // Capturar frame actual del juego
    private captureFrame(): ImageData {
        this.tmp.width  = this.canvas.width;
        this.tmp.height = this.canvas.height;
        this.tmpCtx.drawImage(this.canvas, 0, 0);
        return this.tmpCtx.getImageData(0, 0, this.tmp.width, this.tmp.height);
    }

    // Leer región específica del canvas
    readRegion(x: number, y: number, w: number, h: number): ImageData {
        this.tmp.width  = this.canvas.width;
        this.tmp.height = this.canvas.height;
        this.tmpCtx.drawImage(this.canvas, 0, 0);
        return this.tmpCtx.getImageData(x, y, w, h);
    }

    // Detectar color dominante en una región
    dominantColor(region: ImageData): {r: number, g: number, b: number} {
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < region.data.length; i += 4) {
            if (region.data[i+3] < 10) continue; // ignorar transparente
            r += region.data[i];
            g += region.data[i+1];
            b += region.data[i+2];
            count++;
        }
        return { r: r/count, g: g/count, b: b/count };
    }
}
```

---

## Casos de Uso por Proyecto

### PROYECTO 1: Farm de Mobs (actual)

**Flujo completo con filtrado:**
```
1. searchTarget()      → radar espiral, detecta curattack
2. Tab                 → seleccionar mob más cercano
3. isTargetSafe()      → leer color nombre en UI → ¿es mob correcto?
4. Si seguro → Z       → auto-follow + ataque
5. Si peligroso → Esc  → volver a paso 1
```

**Señales a monitorear:**
- Cursor `curattack` → mob disponible
- Color del nombre en target UI → categoría del mob
- HP bar del personaje → si baja mucho → flee/buff

---

### PROYECTO 2: Recolección de Alimento de Mascotas

Las mascotas en Flyff se alimentan con ítems que dropean ciertos mobs o se compran. El bot necesita:

**a) Detectar ítems en el suelo:**
```typescript
// El cursor cambia a curitem cuando hay un ítem bajo el mouse
// Combinado con el radar, se puede buscar ítems sistemáticamente

private async searchItems() {
    // Similar a searchTarget() pero busca cursor 'curitem'
    // Modificar initCursorObserver para también detectar 'curitem'
    (window as any)._onItemFound = (x: number, y: number) => {
        this.input.mouseClickEmmit(x, y); // recoger ítem
    };
}
```

**b) Monitorear inventario (canvas polling):**
```typescript
// El inventario está en una región fija del canvas cuando está abierto
// Leer los slots y detectar cambios de color = ítem nuevo
private monitorInventory(region: {x,y,w,h}) {
    const before = this.reader.readRegion(region.x, region.y, region.w, region.h);
    setInterval(() => {
        const after = this.reader.readRegion(region.x, region.y, region.w, region.h);
        const diff = this.compareRegions(before, after);
        if (diff > 0.05) this.debugLog(`Inventario cambió (diff=${diff.toFixed(3)})`, 'warn');
    }, 500);
}
```

**c) Detectar hambre de mascota:**
La UI de mascota tiene una barra de hambre. Cuando baja a cierto color (rojo/naranja):
```typescript
private checkPetHunger(): 'full' | 'hungry' | 'starving' {
    // Leer región donde aparece la barra de hambre de la mascota
    // Ajustar coordenadas con Pixel Inspector
    const hunger = this.reader.readRegion(petHungerX, petHungerY, 60, 8);
    const color = this.reader.dominantColor(hunger);
    
    if (color.g > 150 && color.r < 100) return 'full';      // verde
    if (color.r > 150 && color.g > 100) return 'hungry';    // amarillo/naranja
    if (color.r > 180 && color.g < 80)  return 'starving';  // rojo
    return 'full';
}
```

---

### PROYECTO 3: Auto-buff + Recolección Loop completo

```
LOOP:
├── ¿Buffs activos?     → No → activar buffs (tecla `)
├── ¿Mascota hambrienta? → Sí → abrir inventario, usar alimento
├── ¿Mob en rango?      → searchTarget() → Tab → isTargetSafe() → atacar
├── ¿Ítem en suelo?     → curitem detectado → recoger
├── ¿HP < 50%?          → usar poción HP (tecla configurada)
└── ¿MP < 30%?          → usar poción MP
```

---

## Herramientas de Investigación (ya implementadas)

Disponibles en el panel **Debug** de la extensión:

### Scan Window
Lista variables globales del juego. Busca objetos relacionados con:
- Estado del personaje (`player`, `char`, `actor`)
- Sistema de mobs (`monster`, `mob`, `entity`, `npc`)
- Inventario (`inventory`, `item`, `bag`)
- Mascotas (`pet`, `familiar`)

### Scan DOM
Inspecciona elementos HTML de la UI del juego. Útil para encontrar:
- Barra de HP/MP como elemento DOM (si existe)
- Contenedor del inventario
- UI de mascota

### Pixel Inspector
Lee el RGB del pixel bajo el cursor en tiempo real.  
**Uso:** Pasar el cursor por la UI del juego para anotar coordenadas y colores de:
- HP bar del personaje
- Barra de hambre de mascota
- Nombre del mob seleccionado
- Barra de EXP

### Scan Target
Escanea franjas horizontales del canvas reportando colores dominantes.  
**Uso:** Seleccionar distintos tipos de mob con Tab → ejecutar Scan Target → comparar colores.

---

## Próximos pasos de investigación

### Paso 1 — Mapear la UI del juego
Con **Pixel Inspector** activo, pasar el cursor por cada elemento de la UI y anotar:
```
HP bar personaje:    x=?, y=?, color_lleno=?, color_vacío=?
MP bar personaje:    x=?, y=?, color_lleno=?, color_vacío=?
EXP bar:             x=?, y=?, color=?
HP bar target:       x=?, y=?, color=?
Nombre target:       x=?, y=?, color_normal=?, color_peligroso=?
Barra mascota:       x=?, y=?, color_full=?, color_hungry=?
```

### Paso 2 — Hook de eventos completo
Ejecutar en consola con un mob seleccionado para ver todos los eventos que dispara el juego:
```javascript
window.JSEvents.eventHandlers.forEach(h => {
    const orig = h.eventListenerFunc;
    h.eventListenerFunc = function(e) {
        if (['mousedown','mouseup','keydown','keyup'].includes(h.eventTypeString))
            console.log(`[EVENT] ${h.eventTypeString}`, e.type, e.key || `(${e.clientX},${e.clientY})`);
        return orig.call(this, e);
    };
});
```

### Paso 3 — Identificar variables WASM expuestas
Ejecutar **Scan Window** con el inventario abierto, con un mob seleccionado, y sin nada — comparar las diferencias entre estados para identificar qué variables cambian.

---

## Notas técnicas importantes

1. **WebGL preserveDrawingBuffer:** Flyff NO usa `preserveDrawingBuffer: true`. El canvas se limpia entre frames. Para leer píxeles hay que copiar el canvas inmediatamente tras un evento del juego (no en un setTimeout arbitrario).

2. **Emscripten WASM heap:** Los datos del juego están en `window.HEAP8`, `window.HEAP32`, etc. Sin el mapa de memoria del binario compilado es imposible leer directamente. No explorar esta vía.

3. **Timing de eventos:** Flyff corre a ~60fps. Cada frame dura ~16ms. Los canvas polls deben ejecutarse durante el frame activo, no entre frames. La mejor ventana es dentro del handler de `mousemove` o `keydown` donde el juego acaba de renderizar.

4. **CSP del juego:** Flyff bloquea `data:` URLs en `<img>` (confirmado). `createImageBitmap(blob)` funciona sin restricción CSP.
