import { debugLog } from './debugConsole';

let captureMode = false;
let captureCount = 0;
const CAPTURE_LIMIT = 10;

export function activateCapture() {
    captureMode = true;
    captureCount = 0;
    debugLog(`[ws] modo captura activado — próximos ${CAPTURE_LIMIT} paquetes`, 'warn');
}

function extractStrings(bytes: Uint8Array, minLen = 3): string {
    const results: string[] = [];
    let current = '';
    for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];
        if (c >= 32 && c <= 126) {
            current += String.fromCharCode(c);
        } else {
            if (current.length >= minLen) results.push(current);
            current = '';
        }
    }
    if (current.length >= minLen) results.push(current);
    return results.join(' | ');
}

function toHex(bytes: Uint8Array, limit = 24): string {
    return Array.from(bytes.slice(0, limit))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
}

function handleMessage(data: any) {
    if (!captureMode) return;
    if (captureCount >= CAPTURE_LIMIT) {
        captureMode = false;
        debugLog(`[ws] captura finalizada`, 'warn');
        return;
    }
    captureCount++;

    if (typeof data === 'string') {
        debugLog(`[ws #${captureCount}] text (${data.length}c): ${data.slice(0, 300)}`, 'info');
        return;
    }

    const processBuffer = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        const hex = toHex(bytes);
        const strings = extractStrings(bytes);
        debugLog(`[ws #${captureCount}] binary ${bytes.length}b | hex: ${hex}`, 'info');
        if (strings) debugLog(`  strings: ${strings}`, 'success');
    };

    if (data instanceof ArrayBuffer) {
        processBuffer(data);
    } else if (data instanceof Blob) {
        data.arrayBuffer().then(processBuffer);
    }
}

export function initWebSocketInterceptor() {
    const OrigWS = (window as any).WebSocket;
    if (!OrigWS) {
        debugLog(`[ws] WebSocket no disponible`, 'error');
        return;
    }

    class FlyffWS extends OrigWS {
        constructor(url: string, protocols?: string | string[]) {
            super(url, protocols);
            debugLog(`[ws] nueva conexión → ${url}`, 'success');

            this.addEventListener('open',  () => debugLog(`[ws] conectado: ${url}`, 'success'));
            this.addEventListener('close', (e: CloseEvent) => debugLog(`[ws] cerrado (code=${e.code})`, 'warn'));
            this.addEventListener('error', () => debugLog(`[ws] error de conexión`, 'error'));
            this.addEventListener('message', (e: MessageEvent) => handleMessage(e.data));
        }
    }

    (window as any).WebSocket = FlyffWS;
    debugLog(`[ws] interceptor instalado`, 'success');
}
