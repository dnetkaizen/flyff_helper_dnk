type LogLevel = 'info' | 'warn' | 'error' | 'success';

const MAX_ENTRIES = 200;

let panel: HTMLElement | null = null;
let logArea: HTMLElement | null = null;

export function initDebugConsole() {
    panel = document.getElementById('dnk_debug_panel');
    logArea = document.getElementById('dnk_debug_log');

    document.getElementById('dnk_debug_clear')?.addEventListener('click', () => {
        if (logArea) logArea.innerHTML = '';
    });

    document.getElementById('dnk_debug_copy')?.addEventListener('click', () => {
        const text = logArea?.innerText ?? '';
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

    document.getElementById('dnk_debug_toggle')?.addEventListener('click', () => {
        const body = document.getElementById('dnk_debug_body');
        if (!body) return;
        body.style.display = body.style.display === 'none' ? 'flex' : 'none';
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

    const entry = document.createElement('div');
    entry.style.cssText = `color:${colors[level]};font-family:monospace;font-size:11px;line-height:1.4;padding:1px 0;border-bottom:1px solid #30363d;`;
    entry.innerHTML = `<span style="color:#6e7681;">[${ts}]</span> <span style="color:${colors[level]};">[${level.toUpperCase()}]</span> ${escapeHtml(message)}`;

    logArea.appendChild(entry);

    // Trim old entries
    while (logArea.children.length > MAX_ENTRIES) {
        logArea.removeChild(logArea.firstChild!);
    }

    logArea.scrollTop = logArea.scrollHeight;
}

function escapeHtml(str: string) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
