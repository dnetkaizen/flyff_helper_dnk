type LogLevel = 'info' | 'warn' | 'error' | 'success';

const MAX_ENTRIES = 2000;

let logArea: HTMLElement | null = null;
const fullLog: string[] = [];

export function initDebugConsole() {
    logArea = document.getElementById('dnk_debug_log');

    document.getElementById('dnk_console_toggle')?.addEventListener('click', () => {
        const body = document.getElementById('dnk_console_body');
        if (!body) return;
        const isOpen = body.style.display === 'flex';
        body.style.display = isOpen ? 'none' : 'flex';
        const btn = document.getElementById('dnk_console_toggle');
        if (btn) btn.classList.toggle('btn-warning', !isOpen);
    });

    document.getElementById('dnk_debug_clear')?.addEventListener('click', () => {
        if (logArea) logArea.innerHTML = '';
        fullLog.length = 0;
    });

    document.getElementById('dnk_debug_copy')?.addEventListener('click', () => {
        const text = fullLog.join('\n');
        navigator.clipboard.writeText(text).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
        const btn = document.getElementById('dnk_debug_copy');
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { if (btn) btn.textContent = orig; }, 1200);
        }
    });

    document.getElementById('dnk_debug_download')?.addEventListener('click', () => {
        const text = fullLog.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        a.href     = url;
        a.download = `dnk_log_${ts}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

export function debugLog(message: string, level: LogLevel = 'info') {
    if (!logArea) return;

    const colors: Record<LogLevel, string> = {
        info:    '#c9d1d9',
        warn:    '#e3b341',
        error:   '#f85149',
        success: '#3fb950',
    };

    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`;
    const line = `[${ts}] [${level.toUpperCase()}] ${message}`;

    fullLog.push(line);

    const entry = document.createElement('div');
    entry.style.cssText = `color:${colors[level]};line-height:1.4;padding:1px 0;border-bottom:1px solid #21262d;word-break:break-all;`;
    entry.innerHTML = `<span style="color:#484f58;">[${ts}]</span> <span style="color:${colors[level]};">[${level.toUpperCase()}]</span> ${escapeHtml(message)}`;

    logArea.appendChild(entry);

    while (logArea.children.length > MAX_ENTRIES) {
        logArea.removeChild(logArea.firstChild!);
    }

    logArea.scrollTop = logArea.scrollHeight;
}

function escapeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
