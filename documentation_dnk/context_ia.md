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
| `opusnk` | Claude | Mi rama de trabajo |
| `ultronk` | Otras IAs | Experimentos de terceros |

**Regla:** Siempre trabajar en `opusnk`. Mergear a `main` solo cuando el usuario lo pida.

```bash
git checkout opusnk   # primer comando de cada sesión
git pull
npm run build-chrome  # verificar que compila
```

---

## Comandos esenciales

```bash
npm run build-chrome   # output: dist/chrome/
npm run build-firefox  # output: dist/firefox/
```

**Cargar en Chrome:** `chrome://extensions/` → Modo desarrollador → Cargar descomprimida → `dist/chrome/`
**Recargar:** ícono de recarga en `chrome://extensions/` → recargar pestaña del juego.

---

## Arquitectura de archivos clave

```
src/
├── flyff.ts                  # App principal
│   ├── searchTarget()        # Radar espiral, detecta cursor curattack
│   ├── sampleTargetUI()      # ⭐ Detecta panel target via MP bar (cyan), clasifica nombre
│   └── attackTarget()        # Flujo ataque: Tab → sampleTargetUI → atacar/skip
├── ui/
│   └── html.ts               # Templates HTML — DNK Console con Copy/DL/Clear
└── utils/
    ├── debugConsole.ts       # Console con fullLog buffer y botón Download
    ├── wsInterceptor.ts      # WebSocket hook via prototype.send (solo detección)
    ├── imageDetection.ts     # Template matching (pendiente calibrar)
    ├── inputs.ts             # Inyección mouse/teclado via JSEvents
    └── timer.ts              # Helpers de delay

documentation_dnk/
├── context_ia.md             # ESTE ARCHIVO
├── investigacion_mob_data.md # ⚠️ LEER — métodos intentados y descartados
├── handoff_completo.md       # Historial completo de sesiones
├── deteccion_monstruos.md    # Research detección monstruos
├── canvas_events_research.md # Research canvas WebGL
└── sesion_debug.md           # Notas debug

DL/                           # Logs descargados (NO commitear, en .gitignore)
```

---

## Estado actual por módulo

| Módulo | Estado | Notas |
|---|---|---|
| Radar (Target) | ✅ Funciona | Espiral desde centro, detecta cursor `curattack` |
| DNK Debug Console | ✅ Funciona | Botón Console en panel, Copy/DL/Clear |
| WebSocket interceptor | ✅ Básico | Detecta conexiones, datos encriptados (inútil para mob data) |
| sampleTargetUI | ✅ Funciona | MP bar como ancla, clasifica nombre blanco/amarillo/rojo |
| isTargetSafe() | 🔬 Pendiente calibrar | Base implementada, falta threshold con mob peligroso real |
| Template Matching (Alt) | ⚠️ Parcial | Score 0.431 vs 0.70. Necesita screenshot real del juego |
| Servidor Python local | ❌ No implementado | Próximo paso principal |

---

## ⭐ Detección del panel de target — CÓMO FUNCIONA

**Estructura del panel (confirmada por screenshots):**
```
┌─────────────────────────────┐
│  [Nombre del mob]            │  ← texto blanco/amarillo/ROJO
│  [████████████] HP 3080/3080 │  ← barra ROJA/ROSA
│  [░░░░░░░░░░░░] MP  376/376  │  ← barra CYAN rgb(52,176,235) ← ANCLA
└─────────────────────────────┘
Ubicación: TOP CENTER de pantalla (x=20%-80%, y=0-14% del canvas)
```

**Flujo en `sampleTargetUI()`:**
1. Busca la **barra MP (cyan)** → ancla del panel
2. Busca **barra HP (roja)** justo encima del MP
3. Escanea **nombre** (20-55px encima del MP bar) → cuenta píxeles brillantes
4. Clasifica:
   - Blanco > 5% → ✅ mob normal → atacar
   - Amarillo/dorado > 10% → ⚠️ mob agresivo → precaución
   - Rojo > 10% → ❌ mob peligroso → skip

**Resultados confirmados:**
- "Young Lawolf": MP bar y=100, HP bar y=96, nombre blanco 14.3% ✅
- "Cute Nyangnyang" barra2: nombre amarillo/dorado
- "Cute Nyangnyang" barra3: nombre ROJO ← peligroso

**Pendiente:** Confirmar threshold numérico con mob peligroso real via log

---

## DNK Debug Console

**Activar:** Botón "Console" en el panel → amarillo cuando activo.

```typescript
import { debugLog } from './utils/debugConsole';
debugLog('msg', 'info' | 'success' | 'warn' | 'error');
```

Desde DevTools: `dnkLog('test', 'warn')`

Botones: **Copy** (portapapeles), **DL** (descarga .txt completo), **Clear**

---

## Próximo paso: Servidor Python local

**Repo:** https://github.com/dnetkaizen/flyff_mcp_dnk.git
**Ruta local:** `C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-python-server\`

```
Extension JS → fetch('http://localhost:5000/analyze') → Python Flask
                     ↑ canvas screenshot (base64)
                     ↓ { name, type: 'normal'|'aggressive'|'dangerous' }

Python server (ya implementado):
  - api/app.py        → Flask endpoints /health y /analyze
  - api/analyzer.py   → EasyOCR + color detection + mob classification
  - recorder/record.py → graba gameplay (pantalla + inputs) para training
  - docker-compose.yml → contenedor listo para levantar

Arrancar servidor:
    cd flyff-python-server
    docker compose up --build

Sin Docker (dev):
    cd flyff-python-server/api
    pip install -r requirements.txt
    python app.py
```

---

## ⚠️ NO volver a intentar (ya falló)

- `class X extends WebSocket` → crashea el juego
- `Module.UTF8ToString` hook → WASM no lo usa
- `Module.platform_text_edited` → nunca dispara para mobs
- Scan `window` globals → solo falsos positivos Emscripten
- `Module.HEAP8` → no expuesto
- `CanvasRenderingContext2D.prototype.fillText` global → nunca dispara (juego WebGL puro)
- `Module.ctx.fillText` → WebGL context, no tiene fillText
- `scanTargetMemory()` → lag de 5s, eliminado
- `searchHeapForMobName()` → lag, HEAP no disponible, eliminado

Ver detalle completo en `investigacion_mob_data.md`.

---

## Convención de commits

```
feat: nueva funcionalidad
fix:  bug fix
docs: documentación
chore: build/config
refactor: limpieza sin cambio de comportamiento
```

---

## Checklist al iniciar sesión

- [ ] `git checkout opusnk && git pull`
- [ ] `npm run build-chrome` — verificar que compila sin errores
- [ ] Leer este archivo + `investigacion_mob_data.md`
- [ ] Al terminar: commit en `opusnk` + actualizar docs
