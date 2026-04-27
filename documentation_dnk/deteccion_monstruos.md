# Detección de Monstruos — Flyff Universe Helper

**Repositorio:** `flyff-universe-helper`  
**Archivos relevantes:**
- `src/utils/imageDetection.ts` — clase `ImageDetection` (lógica principal)
- `src/flyff.ts` — integración y disparo de la detección

---

## Resumen

El sistema detecta monstruos en pantalla comparando una imagen de referencia (template) contra el canvas del juego, píxel a píxel. Si la similitud supera un umbral configurable, se hace clic automáticamente en la posición detectada.

---

## Flujo completo

```
Extensión carga
    → loadMonsterTemplate()       [flyff.ts:1713]
    → Imagen fija en canvas interno (Captain Samoset.png)

Usuario presiona Alt
    → detectAndClickMonster()     [flyff.ts:1733]
    → detectInCanvas()            [imageDetection.ts:49]
    → calculateMatchScore()       [imageDetection.ts:119]
    → si confianza >= 0.7 → mouseClickEmmit(x, y)
```

---

## Paso 1 — Carga del template

**Archivo:** `flyff.ts:1713` — `loadMonsterTemplate()`

Al iniciar la extensión se carga **una única imagen fija**: `assets/Captain Samoset.png`.

La URL se obtiene con la API del navegador:
```typescript
imagePath = chrome?.runtime?.getURL('assets/Captain Samoset.png');
// Fallback Firefox:
imagePath = browser?.runtime?.getURL('assets/Captain Samoset.png');
```

`ImageDetection.loadTemplate()` (`imageDetection.ts:26`):
1. Crea un `<img>` y espera `onload`
2. Dibuja la imagen en un canvas interno privado
3. Extrae sus píxeles con `getImageData` y los guarda en memoria
4. Activa el flag `isLoaded = true`

A partir de este punto el template está disponible como array de píxeles raw (RGBA).

---

## Paso 2 — Disparo de la detección

**Archivo:** `flyff.ts:191`

```typescript
if (event.key === "Alt") {
    event.preventDefault();
    this.detectAndClickMonster();
}
```

La detección **se ejecuta solo al presionar la tecla Alt**. No hay loop continuo ni polling automático — es completamente manual y on-demand.

---

## Paso 3 — Template Matching (Sliding Window)

**Archivo:** `imageDetection.ts:49` — `detectInCanvas(gameCanvas, threshold = 0.8)`

Obtiene los píxeles del canvas del juego con `getImageData` y realiza un **sliding window**: desplaza el template por cada posición `(x, y)` posible del canvas y calcula la similitud.

```
gameCanvas [1920x1080]
    ┌────────────────────────────┐
    │  →  →  →  →  →  →  →  →  │
    │  comparar template aquí   │
    │  en cada posición (x,y)   │
    └────────────────────────────┘
```

### Optimizaciones de rendimiento

| Técnica | Detalle |
|---|---|
| **Stride de 2px** | El loop itera `x += 2`, `y += 2` tanto en el canvas como dentro del template — reduce el trabajo a ~25% |
| **Early exit a 0.95** | Si alguna posición supera 95% de confianza, para el scan inmediatamente |

### Resultado

Devuelve la posición con mayor `confidence`. Si supera el `threshold` (70% en la llamada real), marca `found: true` y devuelve las coordenadas del **centro** del match:
```typescript
bestMatch = { x: offsetX + templateWidth / 2, y: offsetY + templateHeight / 2, confidence }
```

---

## Paso 4 — Cálculo de similitud por píxel

**Archivo:** `imageDetection.ts:119` — `calculateMatchScore()`

Por cada posición del sliding window, compara bloque de píxeles template vs canvas del juego.

### Fórmula (por píxel)

```
pixelSimilarity = 1 - (|ΔR| + |ΔG| + |ΔB|) / (255 × 3)
```

- Colores idénticos → **1.0**
- Colores completamente opuestos → **0.0**
- Canal Alpha ignorado

El score final es el **promedio** de similitud de todos los píxeles muestreados.

> **Nota:** El comentario en el código menciona "normalized cross-correlation" pero la implementación real es una diferencia de color promediada. Es más simple y suficientemente efectiva para este caso.

---

## Paso 5 — Clic en el monstruo

**Archivo:** `flyff.ts:1754`

```typescript
const result = this.monsterDetection.detectInCanvas(gameCanvas, 0.7);

if (result.found) {
    await this.input.mouseClickEmmit(result.x, result.y);
}
```

Umbral usado: **0.7 (70% de confianza)**. Si se supera, delega el clic a `Input.mouseClickEmmit()` que inyecta un evento de mouse real en el canvas del juego.

---

## Método alternativo — Detección por color

**Archivo:** `imageDetection.ts:157` — `detectByColor()`

Busca un **color específico** en lugar de una imagen template. Itera de 5 en 5 píxeles y devuelve todos los puntos dentro de una tolerancia.

```typescript
const colorDiff = |r - targetR| + |g - targetG| + |b - targetB|;
if (colorDiff < tolerance * 3) → match
```

**Estado actual:** Implementado pero **no se usa en ningún lugar del código**. Es más rápido que el template matching pero mucho menos preciso.

---

## Interfaz `DetectionResult`

```typescript
interface DetectionResult {
    found: boolean;      // ¿se encontró el monstruo?
    x: number;           // coordenada X del centro del match (píxeles en canvas)
    y: number;           // coordenada Y del centro del match
    confidence: number;  // similitud 0.0 – 1.0
}
```

---

## Limitaciones conocidas

| Limitación | Impacto |
|---|---|
| **Template hardcodeado** | Solo detecta `Captain Samoset`. Cualquier otro monstruo requiere cambiar el archivo de imagen manualmente |
| **Sin escalado** | Si el monstruo aparece más grande o más pequeño según la distancia de cámara, la detección falla |
| **Sin rotación** | El monstruo debe aparecer en la misma orientación que el template |
| **Sensible al fondo** | Escenarios con colores similares al monstruo pueden generar falsos positivos |
| **Hilo principal** | El scan corre en el hilo principal del navegador; en canvases grandes puede congelar el juego momentáneamente |
| **Disparo manual** | No hay loop automático — el usuario debe presionar Alt cada vez que quiere detectar |

---

## Valores de configuración

| Parámetro | Valor | Ubicación |
|---|---|---|
| Umbral de confianza | `0.7` (70%) | `flyff.ts:1754` |
| Early exit | `0.95` (95%) | `imageDetection.ts:99` |
| Stride del sliding window | `2px` | `imageDetection.ts:80-81` |
| Stride interno del template | `2px` | `imageDetection.ts:131-132` |
| Stride detección por color | `5px` | `imageDetection.ts:168-169` |
