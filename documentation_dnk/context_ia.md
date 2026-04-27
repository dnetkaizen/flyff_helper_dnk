# Context IA — Flyff Universe Helper (DNK Fork)
> Este archivo es para que una IA retome contexto al inicio de cada sesión.
> Leer PRIMERO antes de tocar cualquier código.

---

## Identidad del proyecto

| Campo | Valor |
|---|---|
| Proyecto | Extensión Chrome/Firefox para automatizar Flyff Universe |
| Juego | https://universe.flyff.com/play (WebGL / Emscripten / WASM) |
| Repo GitHub | https://github.com/dnetkaizen/flyff_helper_dnk.git |
| Ruta local | `C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper` |
| Stack | TypeScript + Webpack 5 + Bootstrap 5 + Draggabilly |

---

## Estructura de ramas

| Rama | Propietario | Propósito |
|---|---|---|
| `main` | Usuario | Producción. NO tocar directamente. |
| `opusnk` | Claude (Opus/Sonnet) | Mi rama de trabajo |
| `ultronk` | Otras IAs | Experimentos de terceros |

**Regla:** Siempre trabajar en `opusnk`. Mergear a `main` solo cuando el usuario lo pida.

```bash
git checkout opusnk   # primer comando de cada sesión
```

---

## Comandos esenciales

```bash
npm install            # primera vez o si hay cambios en package.json
npm run build-chrome   # compila → dist/chrome/
npm run build-firefox  # compila → dist/firefox/

git checkout opusnk
git push               # subir cambios a opusnk
```

**Cargar en Chrome:** `chrome://extensions/` → Modo desarrollador → Cargar descomprimida → seleccionar `dist/chrome/`  
**Recargar extensión:** clic en ícono de recarga en `chrome://extensions/` → recargar pestaña del juego.

---

## Arquitectura de archivos clave

```
src/
├── flyff.ts                    # App principal — clase App, constructor, todos los handlers
│   ├── hookCanvasText()        # Hooks: fillText global, platform_websocket_message, platform_text_edited
│   ├── sampleTargetUI()        # Scan de píxeles del panel del target (top 25% canvas)
│   ├── scanTargetMemory()      # Scan de window globals buscando datos de mob
│   └── searchHeapForMobName()  # Búsqueda de strings en WASM HEAP (HEAP8 no disponible)
├── ui/
│   └── html.ts                 # Templates HTML — incluye DNK Console con botones Copy/DL/Clear
└── utils/
    ├── debugConsole.ts         # DNK Debug Console con fullLog buffer y Download
    ├── wsInterceptor.ts        # WebSocket hook via prototype.send + capture mode
    ├── imageDetection.ts       # Template matching para detección de monstruos
    ├── inputs.ts               # Inyección de mouse/teclado via JSEvents
    └── timer.ts                # Helpers de delay

documentation_dnk/
├── context_ia.md               # ESTE ARCHIVO — leer al inicio de sesión
├── investigacion_mob_data.md   # ⚠️ LEER — todos los métodos intentados para leer datos del mob
├── handoff_completo.md         # Historial completo de sesiones y decisiones técnicas
├── deteccion_monstruos.md      # Research de detección de monstruos
├── canvas_events_research.md   # Research de eventos de canvas WebGL
└── sesion_debug.md             # Notas de sesión de debug

DL/                             # Logs descargados del debug console (NO commitear)
```

---

## Estado actual por módulo

| Módulo | Estado | Notas |
|---|---|---|
| DNK Debug Console | ✅ Funciona | Inline en panel principal, toggle con botón "Console" |
| Template Matching (Alt) | ⚠️ Parcial | Confianza max 0.431 vs threshold 0.70. Template PNG necesita ser screenshot real del juego |
| Radar de cursor (Target) | ✅ Funciona | Espiral desde centro, detecta cursor `curattack` |
| Mouse handlers (JSEvents) | ✅ Funciona | `mouseReady=true` confirmado |
| `isTargetSafe()` | ⚠️ Sin calibrar | Lógica implementada en `ultronk`, necesita datos reales de Scan Target |
| Buff warning | ✅ Funciona | Toggle en panel, persiste en localStorage |
| Party Skills / Buffs | ✅ Funciona | Configuración via modal |

---

## DNK Debug Console — uso

La consola está integrada en el panel principal de la extensión.

**Activar:** Botón "Console" (debajo de "Cheats") → se pone amarillo cuando está abierta.

**Desde código TypeScript:**
```typescript
import { debugLog } from './utils/debugConsole';
debugLog('mensaje', 'info');    // gris
debugLog('mensaje', 'success'); // verde
debugLog('mensaje', 'warn');    // amarillo
debugLog('mensaje', 'error');   // rojo
```

**Desde consola del navegador (DevTools):**
```javascript
dnkLog('test', 'warn')
```

**Botones dentro del panel:**
- `Copy` → copia todo el log al portapapeles
- `Clear` → limpia el log

---

## Problema principal pendiente

**Filtrar monstruos por categoría antes de atacar.**

El radar (`searchTarget`) hace clic en cualquier mob con cursor `curattack`, incluyendo elites/rojos que matan al personaje.

**Solución diseñada (`isTargetSafe()` en `ultronk`):**
1. Presionar Tab para seleccionar mob cercano
2. Leer color del nombre en la franja superior del canvas
3. Si hay píxeles rojos/naranjas dominantes → mob peligroso → Escape y skip
4. Si no → atacar

**Pendiente:** Calibrar thresholds con datos reales usando "Scan Target" sobre mobs normales y peligrosos.

---

## Convención de commits

```
feat: descripción corta        # nueva funcionalidad
fix: descripción corta         # bug fix
docs: descripción corta        # documentación
chore: descripción corta       # build, config, sin lógica
```

---

## Checklist al iniciar sesión

- [ ] `git checkout opusnk`
- [ ] `git pull` para traer cambios remotos
- [ ] Leer `handoff_completo.md` si retomas algo específico de sesiones anteriores
- [ ] Verificar build: `npm run build-chrome`
- [ ] Al terminar: commit en `opusnk` + actualizar docs

---

## Checklist de tareas pendientes

- [ ] Confirmar si `CanvasRenderingContext2D.prototype.fillText` global captura texto del juego
- [ ] Implementar detección de barra de HP via scan de línea horizontal de color sólido
- [ ] Explorar acceso a HEAP via `Module.asm` o `Module._malloc` para triangular buffer
- [ ] Reemplazar `assets/monster_template.png` con screenshot real del juego
- [ ] Calibrar `isTargetSafe()` con datos reales de colores del panel de target
- [ ] Probar flujo completo: Target → Tab → isTargetSafe → atacar/skip
- [ ] Mergear `opusnk` → `main` cuando esté estable

## ⚠️ NO volver a intentar (ya falló — ver investigacion_mob_data.md)

- Subclase `class X extends WebSocket` → crashea el juego (pantalla negra)
- `Module.UTF8ToString` hook → WASM no llama a esta función JS
- `Module.platform_text_edited` hook → solo para inputs de texto, nunca dispara para mobs
- Scan de `window` globals para datos de mob → solo falsos positivos Emscripten
- `Module.HEAP8` → no expuesto en este build de Emscripten
- `CanvasRenderingContext2D.prototype.fillText` global → nunca dispara (juego es WebGL puro)
- `Module.ctx.fillText` → Module.ctx es contexto WebGL, no tiene fillText

## 🔬 Pendiente testear (próxima sesión)

1. **HP bar pixel scan** — panel ubicado en y≈65-85 con fondo purpúreo confirmado. Falta implementar búsqueda de run de píxeles verdes/rojos para detectar la barra de HP. Ver código en `investigacion_mob_data.md`.
2. **HEAP via Module.asm** — explorar si `WebAssembly.Memory` es accesible por ruta alternativa.
3. **Correlación paquete grande con selección de mob** — paquetes de 4523b y 5257b aparecen al hacer Tab. ¿Son siempre iguales?
