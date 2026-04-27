import { debugLog } from './debugConsole';

let captureMode = false;
let captureCount = 0;
const CAPTURE_LIMIT = 10;

const knownSockets = new WeakSet<WebSocket>();

export function activateCapture() {
    captureMode = true;
    captureCount = 0;
    debugLog(`[ws] captura activada — próximos ${CAPTURE_LIMIT} paquetes`, 'warn');
}

function extractStrings(bytes: Uint8Array, minLen = 3): string {
    const results: string[] = [];
    let cur = '';
    for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];
        if (c >= 32 && c <= 126) { cur += String.fromCharCode(c); }
        else { if (cur.length >= minLen) results.push(cur); cur = ''; }
    }
    if (cur.length >= minLen) results.push(cur);
    return results.join(' | ');
}

function toHex(bytes: Uint8Array, limit = 32): string {
    return Array.from(bytes.slice(0, limit))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function onMessage(data: any) {
    if (!captureMode) return;
    if (captureCount >= CAPTURE_LIMIT) {
        captureMode = false;
        debugLog(`[ws] captura finalizada`, 'warn');
        return;
    }
    captureCount++;

    if (typeof data === 'string') {
        debugLog(`[ws #${captureCount}] text: ${data.slice(0, 300)}`, 'info');
        return;
    }

    const process = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        debugLog(`[ws #${captureCount}] binary ${bytes.length}b → ${toHex(bytes)}`, 'info');
        const str = extractStrings(bytes);
        if (str) debugLog(`  strings: ${str}`, 'success');
    };

    if (data instanceof ArrayBuffer) process(data);
    else if (data instanceof Blob) data.arrayBuffer().then(process);
}

function attachToSocket(ws: WebSocket, url: string) {
    if (knownSockets.has(ws)) return;
    knownSockets.add(ws);
    debugLog(`[ws] socket detectado → ${url}`, 'success');
    ws.addEventListener('message', (e: MessageEvent) => onMessage(e.data));
    ws.addEventListener('close',   (e: CloseEvent)  => debugLog(`[ws] cerrado (${e.code}) ${url}`, 'warn'));
}

export function initWebSocketInterceptor() {
    const origSend = WebSocket.prototype.send;

    // Hook send — fired the first time the game sends data on each socket
    WebSocket.prototype.send = function(data) {
        attachToSocket(this, this.url);
        return origSend.apply(this, [data]);
    };

    debugLog(`[ws] interceptor instalado (via prototype.send)`, 'success');
}
