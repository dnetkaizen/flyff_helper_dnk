import { debugLog } from './debugConsole';

const knownSockets = new WeakSet<WebSocket>();

function attachToSocket(ws: WebSocket, url: string) {
    if (knownSockets.has(ws)) return;
    knownSockets.add(ws);
    debugLog(`[ws] socket detectado → ${url}`, 'success');
    ws.addEventListener('close', (e: CloseEvent) => debugLog(`[ws] cerrado (${e.code}) ${url}`, 'warn'));
}

export function initWebSocketInterceptor() {
    const origSend = WebSocket.prototype.send;

    WebSocket.prototype.send = function(data) {
        attachToSocket(this, this.url);
        return origSend.apply(this, [data]);
    };

    debugLog(`[ws] interceptor instalado`, 'success');
}
