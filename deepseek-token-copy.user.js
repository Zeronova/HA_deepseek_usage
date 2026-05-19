// ==UserScript==
// @name         DeepSeek Token Copy
// @namespace    https://github.com/Zeronova
// @version      0.1.1
// @description  Kopiert den DeepSeek Platform Session-Token per Klick in die Zwischenablage
// @author       Zeronova
// @match        https://platform.deepseek.com/*
// @icon         https://platform.deepseek.com/favicon.ico
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Styles ---
    GM_addStyle(`
        .ds-token-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 18px;
            background: linear-gradient(135deg, #4F46E5, #6366F1);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 16px rgba(79,70,229,0.35);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ds-token-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(79,70,229,0.45);
        }
        .ds-token-btn:active {
            transform: translateY(0);
        }
        .ds-token-btn.copied {
            background: linear-gradient(135deg, #059669, #10B981);
            box-shadow: 0 4px 16px rgba(5,150,105,0.35);
        }
        .ds-token-btn .ds-spinner {
            display: none;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: ds-spin 0.6s linear infinite;
        }
        .ds-token-btn.loading .ds-label { display: none; }
        .ds-token-btn.loading .ds-spinner { display: inline-block; }
        .ds-token-debug {
            display: none;
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 99998;
            background: #1F2937;
            color: #E5E7EB;
            padding: 16px;
            border-radius: 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-width: 400px;
            max-height: 300px;
            overflow: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            line-height: 1.6;
        }
        .ds-token-debug.visible { display: block; }
        .ds-token-debug .key { color: #93C5FD; }
        .ds-token-debug .val { color: #A7F3D0; word-break: break-all; }
        @keyframes ds-spin { to { transform: rotate(360deg); } }
    `);

    const SVG_COPY = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const SVG_OK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    // --- Token finden ---
    function findToken() {
        // 1. Cookies durchsuchen
        try {
            const cookies = document.cookie.split(';');
            for (const c of cookies) {
                const [name, val] = c.trim().split('=');
                const lname = name.toLowerCase();
                if (lname.includes('token') || lname.includes('session') || lname.includes('auth') || lname.includes('sess')) {
                    if (val && val.length > 20) return decodeURIComponent(val);
                }
            }
        } catch(e) {}

        // 2. localStorage nach token-artigen Werten durchsuchen
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const lkey = key.toLowerCase();
                const val = localStorage.getItem(key);

                // Key heisst token/session/auth
                if (lkey.includes('token') || lkey.includes('session') || lkey.includes('auth') || lkey.includes('sess')) {
                    if (val && val.length > 20 && val.length < 500) return val;
                }

                // JSON parsen und rekursiv durchsuchen
                if (val && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        const parsed = JSON.parse(val);
                        const found = searchObject(parsed);
                        if (found) return found;
                    } catch(e) {}
                }
            }
        } catch(e) {}

        // 3. sessionStorage
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const lkey = key.toLowerCase();
                if (lkey.includes('token') || lkey.includes('session') || lkey.includes('auth')) {
                    const val = sessionStorage.getItem(key);
                    if (val && val.length > 20 && val.length < 500) return val;
                }
            }
        } catch(e) {}

        // 4. DOM nach langen Strings durchsuchen
        try {
            const text = document.body?.innerText || '';
            // Token-artige Strings: mindestens 40 Zeichen, keine Leerzeichen
            const matches = text.match(/[A-Za-z0-9\-_=.]{40,200}/g);
            if (matches) {
                // Filter: keine reinen Zahlen/Space-Trennungen
                for (const m of matches) {
                    if (m.match(/[A-Z]/) && m.match(/[a-z]/) && m.length > 40) {
                        return m;
                    }
                }
            }
        } catch(e) {}

        return null;
    }

    // Rekursive Suche in Objekten nach etwas das wie ein Token aussieht
    function searchObject(obj, depth = 0) {
        if (depth > 5) return null;
        if (!obj || typeof obj !== 'object') return null;

        for (const key of Object.keys(obj)) {
            const lkey = key.toLowerCase();
            const val = obj[key];

            if (typeof val === 'string' && val.length > 20 && val.length < 500) {
                if (lkey.includes('token') || lkey.includes('session') || lkey.includes('auth') ||
                    lkey.includes('apikey') || lkey.includes('secret') || lkey.includes('access')) {
                    return val;
                }
            }

            if (typeof val === 'object') {
                const found = searchObject(val, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    // --- Token aus dem Authorization-Header von fetch/XMLHttpRequest abfangen ---
    // Das ist der zuverlässigste Weg — der Token wird bei jedem API-Call mitgeschickt
    let interceptedToken = null;

    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const headers = args[1]?.headers;
        if (headers) {
            if (headers instanceof Headers && headers.has('Authorization')) {
                const auth = headers.get('Authorization');
                if (auth && auth.startsWith('Bearer ')) {
                    interceptedToken = auth.slice(7);
                }
            } else if (typeof headers === 'object' && headers['Authorization']) {
                const auth = headers['Authorization'];
                if (auth && auth.startsWith('Bearer ')) {
                    interceptedToken = auth.slice(7);
                }
            }
        }
        return origFetch.apply(this, args);
    };

    // Auch XMLHttpRequest abfangen
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._requestUrl = url;
        return origOpen.apply(this, arguments);
    };
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
            interceptedToken = value.slice(7);
        }
        return origSetHeader.apply(this, arguments);
    };

    // --- Debug-Panel: zeigt gefundene Kandidaten ---
    function collectCandidates() {
        const results = [];

        // Cookies
        try {
            document.cookie.split(';').forEach(c => {
                const [name, val] = c.trim().split('=');
                if (val && val.length > 15) results.push({source: '🍪 ' + name, value: val.substring(0, 50) + '...'});
            });
        } catch(e) {}

        // localStorage Keys
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k);
                results.push({source: '💾 ' + k, value: v.substring(0, 50) + (v.length > 50 ? '...' : '')});
            }
        } catch(e) {}

        // Authorization Header
        if (interceptedToken) {
            results.push({source: '🔑 Authorization (intercepted)', value: interceptedToken.substring(0, 50) + '...'});
        }

        return results;
    }

    // --- Button + Debug erstellen ---
    function createUI() {
        const btn = document.createElement('button');
        btn.className = 'ds-token-btn';
        btn.innerHTML = `${SVG_COPY}<span class="ds-label">Token kopieren</span><div class="ds-spinner"></div>`;

        const debug = document.createElement('div');
        debug.className = 'ds-token-debug';
        debug.id = 'ds-debug';

        document.body.appendChild(btn);

        btn.addEventListener('click', async () => {
            // Erst versuchen den Token zu finden
            let token = findToken();

            // Fallback: intercepted Authorization Header
            if (!token && interceptedToken) {
                token = interceptedToken;
            }

            if (!token) {
                // Debug-Panel zeigen falls kein Token gefunden
                const existing = document.getElementById('ds-debug');
                if (existing) existing.remove();

                const candidates = collectCandidates();
                let html = '<div style="color:#F87171;font-weight:bold;margin-bottom:8px;">❌ Kein Token gefunden</div>';
                html += '<div style="margin-bottom:6px;color:#9CA3AF;">Gefundene Kandidaten:</div>';
                candidates.forEach(c => {
                    html += `<div><span class="key">${c.source}:</span> <span class="val">${c.value}</span></div>`;
                });

                debug.innerHTML = html;
                debug.classList.add('visible');
                document.body.appendChild(debug);

                btn.classList.remove('loading');
                return;
            }

            btn.classList.add('loading');
            try {
                await navigator.clipboard.writeText(token);
                btn.classList.remove('loading');
                btn.classList.add('copied');
                btn.innerHTML = `${SVG_OK}<span class="ds-label">Kopiert!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `${SVG_COPY}<span class="ds-label">Token kopieren</span>`;
                }, 2500);
            } catch(e) {
                // Fallback
                GM_setClipboard(token);
                btn.classList.remove('loading');
                btn.classList.add('copied');
                btn.innerHTML = `${SVG_OK}<span class="ds-label">Kopiert!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `${SVG_COPY}<span class="ds-label">Token kopieren</span>`;
                }, 2500);
            }
        });

        // Debug schliessen bei Klick ausserhalb
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ds-token-btn') && !e.target.closest('.ds-token-debug')) {
                debug.classList.remove('visible');
            }
        });
    }

    // --- Start ---
    function init() {
        if (document.body) {
            createUI();
        } else {
            document.addEventListener('DOMContentLoaded', createUI);
        }
    }

    // Warten bis Seite geladen ist, damit fetch-Intercept schon läuft
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Nach 3 Sekunden nochmal checken ob wir was haben
    setTimeout(() => {
        if (!findToken() && interceptedToken) {
            // Token aus Intercept reicht — Button ist schon da
        }
    }, 3000);
})();
