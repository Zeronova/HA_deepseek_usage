// ==UserScript==
// @name         DeepSeek Token Copy
// @namespace    https://github.com/Zeronova
// @version      0.2.0
// @description  Kopiert das DeepSeek Platform API-Token per Klick in die Zwischenablage
// @author       Zeronova
// @match        https://platform.deepseek.com/*
// @icon         https://platform.deepseek.com/favicon.ico
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    /* ================================================================
       STYLES
    ================================================================ */
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
        .ds-token-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79,70,229,0.45); }
        .ds-token-btn:active { transform: translateY(0); }
        .ds-token-btn.copied {
            background: linear-gradient(135deg, #059669, #10B981);
            box-shadow: 0 4px 16px rgba(5,150,105,0.35);
        }
        .ds-token-btn .ds-spinner {
            display: none;
            width: 16px; height: 16px;
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
            max-width: 450px;
            max-height: 350px;
            overflow: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            line-height: 1.6;
        }
        .ds-token-debug.visible { display: block; }
        .ds-token-debug .key { color: #93C5FD; }
        .ds-token-debug .val { color: #A7F3D0; word-break: break-all; }
        @keyframes ds-spin { to { transform: rotate(360deg); } }

        /* Inline copy buttons neben Token-Feldern */
        .ds-inline-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: #4F46E5;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 6px;
            transition: background 0.2s;
        }
        .ds-inline-btn:hover { background: #6366F1; }
        .ds-inline-btn.copied { background: #059669; }
    `);

    const SVG_COPY = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const SVG_OK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    /* ================================================================
       TOKEN FINDER — mehrere Quellen
    ================================================================ */

    let interceptedToken = null;
    let tokenFromResponse = null;

    // --- Quellen für Token-Suche ---
    const TOKEN_SOURCES = [];

    function addSource(name, value) {
        if (!value || typeof value !== 'string' || value.length < 10) return;
        if (!TOKEN_SOURCES.find(s => s.value === value)) {
            TOKEN_SOURCES.push({ source: name, value: value.substring(0, 80) + (value.length > 80 ? '...' : '') });
        }
    }

    // --- 1. DOM gezielt nach Token-Feldern durchsuchen ---
    function findTokenInDOM() {
        // 1a. Input-Felder (type=text/password) mit langem Wert
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
        for (const input of inputs) {
            const val = input.value;
            if (val && val.length > 20 && val.length < 500) {
                addSource('🔤 Input[name=' + (input.name || input.id || '?') + ']', val);
            }
            // Auch placeholder/aria-label für Anzeigezwecke
            const dataVal = input.getAttribute('data-key') || input.getAttribute('data-value');
            if (dataVal && dataVal.length > 20) {
                addSource('📋 Input data-' + input.className.substring(0, 20), dataVal);
            }
        }

        // 1b. Code/Pre/Code-Blöcke mit token-artigen Inhalten
        const codeBlocks = document.querySelectorAll('code, pre, .token-display, .api-key, .key-value, [class*="token"], [class*="apikey"], [class*="api_key"]');
        for (const el of codeBlocks) {
            const text = el.textContent.trim();
            if (isTokenLike(text)) {
                addSource('📄 ' + getSelectorHint(el), text);
            }
        }

        // 1c. Span/Div-Elemente die explizit token-artige Klassen haben
        const tokenElements = document.querySelectorAll('[class*="token"], [class*="apikey"], [data-testid*="token"], [data-testid*="key"]');
        for (const el of tokenElements) {
            const text = el.textContent.trim();
            if (isTokenLike(text)) {
                addSource('🔑 ' + getSelectorHint(el), text);
            }
        }

        // 1d. Alle sichtbaren Textknoten nach token-artigen Strings durchsuchen
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (isTokenLike(text) && text.length > 20) {
                const parent = node.parentElement;
                if (parent) {
                    const tag = parent.tagName.toLowerCase();
                    if (!['script', 'style', 'noscript'].includes(tag)) {
                        addSource('📝 ' + getSelectorHint(parent), text);
                    }
                }
            }
        }

        // 1e. Gesamten sichtbaren Text nach token-artigen Fragmenten scannen
        const bodyText = document.body?.innerText || '';
        const matches = bodyText.match(/[A-Za-z0-9+/=_\-.]{30,300}/g);
        if (matches) {
            for (const m of matches) {
                // Token typisch: enthält Gross-/Kleinbuchstaben, > 40 Zeichen
                // und ist kein einfacher UUID/Hex-String
                if (m.length > 40 &&
                    /[A-Z]/.test(m) && /[a-z]/.test(m) &&
                    !/^[0-9a-f\-]+$/i.test(m)) {
                    addSource('🔍 Text-Fund', m);
                }
            }
        }

        // 1f. Next.js __NEXT_DATA__ prüfen
        const nextData = document.getElementById('__NEXT_DATA__');
        if (nextData) {
            try {
                const parsed = JSON.parse(nextData.textContent);
                if (parsed.props?.pageProps) {
                    deepSearch(parsed.props.pageProps, 'nextProps', 3);
                }
            } catch(e) {}
        }

        // 1g. window.__INITIAL_STATE__
        if (window.__INITIAL_STATE__) {
            deepSearch(window.__INITIAL_STATE__, '__INITIAL_STATE__', 3);
        }

        // 1h. window.__STORE__ / Redux
        if (window.__STORE__?.getState) {
            deepSearch(window.__STORE__.getState(), '__STORE__', 3);
        }
    }

    // --- 2. Cookies ---
    function findTokenInCookies() {
        try {
            const cookies = document.cookie.split(';');
            for (const c of cookies) {
                const [name, val] = c.trim().split('=');
                const decoded = decodeURIComponent(val || '');
                if (decoded && decoded.length > 20) {
                    const lname = name.toLowerCase();
                    if (lname.includes('token') || lname.includes('session') || lname.includes('auth') || lname.includes('sess')) {
                        addSource('🍪 Cookie: ' + name, decoded);
                    }
                }
            }
        } catch(e) {}
    }

    // --- 3. localStorage ---
    function findTokenInStorage(storage, prefix) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                const lkey = key.toLowerCase();
                const val = storage.getItem(key);

                // Key deutet auf Token hin
                if (lkey.includes('token') || lkey.includes('session') || lkey.includes('auth') || lkey.includes('apikey') || lkey.includes('secret') || lkey.includes('credential') || lkey.includes('sess')) {
                    if (val && typeof val === 'string' && val.length > 10 && val.length < 2000) {
                        addSource('💾 ' + prefix + ': ' + key, val);
                    }
                }

                // Wert ist ein Objekt — rekursiv durchsuchen
                if (val && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        const parsed = JSON.parse(val);
                        deepSearch(parsed, prefix + ': ' + key, 3);
                    } catch(e) {}
                }
            }
        } catch(e) {}
    }

    // --- 4. Intercept fetch/XMLHttpRequest Authorization Header ---
    function interceptNetwork() {
        // fetch
        const origFetch = window.fetch;
        window.fetch = function(...args) {
            const headers = args[1]?.headers;
            if (headers) {
                let auth = null;
                if (headers instanceof Headers) {
                    if (headers.has('Authorization')) auth = headers.get('Authorization');
                } else if (typeof headers === 'object' && headers['Authorization']) {
                    auth = headers['Authorization'];
                }
                if (auth && auth.startsWith('Bearer ')) {
                    interceptedToken = auth.slice(7);
                    addSource('🔑 Authorization (fetch)', interceptedToken);
                }
            }
            return origFetch.apply(this, args)
                .then(async (response) => {
                    // Auch Response-Bodies durchsuchen
                    if (response.ok) {
                        try {
                            const clone = response.clone();
                            const text = await clone.text();
                            if (text.length < 50000) {
                                if (text.includes('token') || text.includes('apikey') || text.includes('sk-')) {
                                    deepSearchString(text, '📥 Response: ' + response.url.substring(0, 60));
                                }
                            }
                        } catch(e) {}
                    }
                    return response;
                });
        };

        // XMLHttpRequest
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            this._requestUrl = url;
            this._requestMethod = method;
            return origOpen.apply(this, arguments);
        };
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            if (header.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
                interceptedToken = value.slice(7);
                addSource('🔑 Authorization (XHR)', interceptedToken);
            }
            return origSetHeader.apply(this, arguments);
        };
    }

    // --- 5. Hilfsfunktionen ---

    function isTokenLike(str) {
        if (!str || typeof str !== 'string') return false;
        return str.length > 20 &&
            /[A-Z]/.test(str) && /[a-z]/.test(str) &&
            /[0-9]/.test(str) &&
            str.length < 1000 &&
            !/^[0-9a-f\-]+$/i.test(str);
    }

    function getSelectorHint(el) {
        if (el.id) return '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            return '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.');
        }
        if (el.getAttribute('data-testid')) return '[data-testid=' + el.getAttribute('data-testid') + ']';
        if (el.getAttribute('aria-label')) return '[aria-label=' + el.getAttribute('aria-label').substring(0, 20) + ']';
        return el.tagName.toLowerCase();
    }

    function deepSearch(obj, path, depth) {
        if (depth <= 0 || !obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            const fullPath = path + '.' + key;
            const lkey = key.toLowerCase();

            if (typeof val === 'string') {
                if (lkey.includes('token') || lkey.includes('apikey') || lkey.includes('secret') || lkey.includes('session') || lkey.includes('key') && val.length > 5) {
                    if (val.length < 2000) {
                        addSource('🧩 ' + fullPath, val);
                    }
                }
            } else if (typeof val === 'object' && val !== null) {
                deepSearch(val, fullPath, depth - 1);
            }
        }
    }

    function deepSearchString(text, label) {
        // Suche in API-Responses nach token-artigen Werten
        const patterns = [
            /["'](?:token|apikey|api_key|session_token|access_token)["']\s*:\s*["']([^"']{20,})["']/i,
            /["'](?:token|apikey|api_key)["']\s*:\s*["']([^"']{20,})["']/i,
            /(?:token|apikey|api_key)\s*[:=]\s*["']?([A-Za-z0-9+/=_\-.]{30,})["']?/i,
        ];

        for (const re of patterns) {
            const match = text.match(re);
            if (match && match[1] && match[1].length > 20) {
                addSource('📥 ' + label + ' → ' + match[0].substring(0, 40) + '...', match[1]);
            }
        }
    }

    // --- Besten Token ermitteln ---
    function bestToken() {
        // 1. Intercept hat Vorrang (sicher authentifiziert)
        if (interceptedToken && interceptedToken.length > 20) return interceptedToken;

        // 2. Aus gesammelten Quellen den längsten, glaubwürdigsten Token nehmen
        let best = null;
        let bestScore = -1;

        for (const s of TOKEN_SOURCES) {
            const val = s.value.replace('...', '');
            // Echte Token sind lang (40+) und haben gemischte Zeichen
            const score = val.length * 2 + (/^[A-Za-z0-9+/=_\-.]{40,}$/.test(val) ? 100 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = val;
            }
        }

        return best;
    }

    // --- Token ausgeben (für Debug) ---
    function collectCandidates() {
        findTokenInCookies();
        findTokenInStorage(localStorage, 'localStorage');
        findTokenInStorage(sessionStorage, 'sessionStorage');

        // Nächste DOM-Durchläufe
        findTokenInDOM();

        if (interceptedToken) {
            addSource('🔑 Authorization (intercepted)', interceptedToken);
        }

        return TOKEN_SOURCES;
    }

    /* ================================================================
       UI
    ================================================================ */

    function createUI() {
        const btn = document.createElement('button');
        btn.className = 'ds-token-btn';
        btn.innerHTML = `${SVG_COPY}<span class="ds-label">Token holen</span><div class="ds-spinner"></div>`;

        const debug = document.createElement('div');
        debug.className = 'ds-token-debug';
        debug.id = 'ds-debug';

        document.body.appendChild(btn);

        btn.addEventListener('click', async () => {
            btn.classList.add('loading');

            // Quellen aktualisieren
            TOKEN_SOURCES.length = 0;
            collectCandidates();

            const token = bestToken();

            if (!token) {
                // Debug-Panel
                const existing = document.getElementById('ds-debug');
                if (existing) existing.remove();

                let html = '<div style="color:#F87171;font-weight:bold;margin-bottom:8px;">❌ Kein Token gefunden</div>';
                html += '<div style="margin-bottom:6px;color:#9CA3AF;">Gefundene Kandidaten (' + TOKEN_SOURCES.length + '):</div>';

                if (TOKEN_SOURCES.length === 0) {
                    html += '<div style="color:#6B7280;font-style:italic;">— Keine Kandidaten gefunden</div>';
                    html += '<div style="margin-top:8px;color:#FBBF24;font-size:11px;">💡 Navigiere zu API Keys auf der Seite und versuchs nochmal</div>';
                } else {
                    TOKEN_SOURCES.forEach(s => {
                        html += `<div><span class="key">${s.source}:</span> <span class="val">${s.value}</span></div>`;
                    });
                }

                debug.innerHTML = html;
                debug.classList.add('visible');
                document.body.appendChild(debug);

                btn.classList.remove('loading');
                return;
            }

            try {
                await navigator.clipboard.writeText(token);
            } catch(e) {
                GM_setClipboard(token);
            }

            btn.classList.remove('loading');
            btn.classList.add('copied');
            btn.innerHTML = `${SVG_OK}<span class="ds-label">Kopiert!</span>`;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = `${SVG_COPY}<span class="ds-label">Token holen</span>`;
            }, 2500);
        });

        // Debug schliessen
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ds-token-btn') && !e.target.closest('.ds-token-debug')) {
                debug.classList.remove('visible');
            }
        });
    }

    /* ================================================================
       MUTATION OBSERVER — passiert auf dynamische DOM-Änderungen
    ================================================================ */

    function observeDOM() {
        const observer = new MutationObserver(() => {
            // Token aus DOM setzen
            findTokenInDOM();

            // Auch inline Buttons an Token-Felder anheften
            attachInlineButtons();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
        });
    }

    // --- Inline-Kopier-Buttons neben Token-Feldern ---
    function attachInlineButtons() {
        // Input-Felder die nach Token aussehen
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const input of inputs) {
            if (input.dataset.dsAttached) continue;
            const val = input.value;
            if (val && val.length > 20 && /[A-Z]/.test(val) && /[a-z]/.test(val)) {
                // Nur neben Inputs die token-verdächtig aussehen
                const parent = input.parentElement;
                const label = parent?.querySelector('label')?.textContent || input.placeholder || input.id || '';
                const llabel = label.toLowerCase();
                if (llabel.includes('token') || llabel.includes('key') || llabel.includes('apikey') || llabel.includes('session') ||
                    input.id.toLowerCase().includes('token') || input.name?.toLowerCase().includes('token')) {

                    const inlineBtn = document.createElement('button');
                    inlineBtn.className = 'ds-inline-btn';
                    inlineBtn.innerHTML = SVG_COPY;
                    inlineBtn.title = 'Token kopieren';
                    inlineBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(input.value);
                        inlineBtn.classList.add('copied');
                        inlineBtn.innerHTML = SVG_OK;
                        setTimeout(() => {
                            inlineBtn.classList.remove('copied');
                            inlineBtn.innerHTML = SVG_COPY;
                        }, 2000);
                    });

                    input.style.paddingRight = '40px';
                    input.parentElement.style.position = 'relative';
                    input.parentElement.appendChild(inlineBtn);
                    input.dataset.dsAttached = 'true';
                }
            }
        }
    }

    /* ================================================================
       START
    ================================================================ */

    function init() {
        interceptNetwork();  // Sofort fetch abfangen

        if (document.body) {
            createUI();
            observeDOM();

            // Initialen Scan nach 2s (nachdem React initial gerendert hat)
            setTimeout(() => {
                collectCandidates();
                const token = bestToken();
                if (token) {
                    addSource('✅ Auto-Scan:', token.substring(0, 30) + '...');
                }
            }, 2000);

            // Nochmal nach 5s (manche Seiten laden in Phasen)
            setTimeout(() => {
                collectCandidates();
            }, 5000);
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
