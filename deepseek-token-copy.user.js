// ==UserScript==
// @name         DeepSeek Token Copy
// @namespace    https://github.com/Zeronova
// @version      0.1.0
// @description  Kopiert den DeepSeek Platform Session-Token per Klick in die Zwischenablage
// @author       Zeronova
// @match        https://platform.deepseek.com/usage*
// @icon         https://platform.deepseek.com/favicon.ico
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const TOKEN_KEY = 'session_token';
    const CHECK_INTERVAL = 1000; // alle 1s prüfen ob Token geladen ist
    const MAX_RETRIES = 30;      // max 30s warten

    let retries = 0;

    // --- Styles ---
    GM_addStyle(`
        .ds-token-copy-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            margin-left: 10px;
            background: linear-gradient(135deg, #4F46E5, #6366F1);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(79,70,229,0.3);
        }
        .ds-token-copy-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79,70,229,0.4);
        }
        .ds-token-copy-btn:active {
            transform: translateY(0);
        }
        .ds-token-copy-btn.copied {
            background: linear-gradient(135deg, #059669, #10B981);
        }
        .ds-token-copy-btn svg {
            width: 16px;
            height: 16px;
        }
        .ds-token-copy-btn .ds-spinner {
            display: none;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: ds-spin 0.6s linear infinite;
        }
        .ds-token-copy-btn.loading .ds-spinner {
            display: inline-block;
        }
        .ds-token-copy-btn.loading .ds-label {
            display: none;
        }
        @keyframes ds-spin {
            to { transform: rotate(360deg); }
        }
    `);

    // --- Icon (Clipboard) ---
    const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;

    const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;

    // --- Token finden ---
    function findToken() {
        // 1. Aus localStorage (viele SPAs speichern Token dort)
        try {
            for (let key in localStorage) {
                if (key.toLowerCase().includes('token') || key.toLowerCase().includes('session')) {
                    const val = localStorage.getItem(key);
                    if (val && val.length > 20 && val.length < 200) {
                        return val;
                    }
                    // Könnte JSON sein
                    try {
                        const parsed = JSON.parse(val);
                        if (typeof parsed === 'object') {
                            for (let k in parsed) {
                                if (typeof parsed[k] === 'string' && parsed[k].length > 20 && parsed[k].length < 200) {
                                    return parsed[k];
                                }
                            }
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}

        // 2. Im DOM nach Token-Text suchen
        const bodyText = document.body?.innerText || '';
        // Typische Pattern: langer Base64-ähnlicher String
        const tokenMatch = bodyText.match(/[A-Za-z0-9\-_]{40,150}/);
        if (tokenMatch) {
            return tokenMatch[0];
        }

        // 3. In Meta-Tags oder data-Attributen
        const meta = document.querySelector('meta[name="csrf-token"], meta[name="api-token"]');
        if (meta) return meta.getAttribute('content');

        return null;
    }

    // --- Button erstellen ---
    function createButton(token) {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:center;';

        const label = document.createElement('span');
        label.textContent = 'Session-Token:';
        label.style.cssText = 'font-weight:600;color:#374151;font-size:14px;';

        const tokenDisplay = document.createElement('code');
        tokenDisplay.textContent = token.substring(0, 16) + '…' + token.slice(-8);
        tokenDisplay.style.cssText = 'margin:0 8px;padding:4px 10px;background:#F3F4F6;border-radius:6px;font-size:13px;color:#6B7280;';

        const btn = document.createElement('button');
        btn.className = 'ds-token-copy-btn';
        btn.innerHTML = `${COPY_ICON}<span class="ds-label">Kopieren</span><div class="ds-spinner"></div>`;

        btn.addEventListener('click', async () => {
            btn.classList.add('loading');
            try {
                await navigator.clipboard.writeText(token);
                GM_setClipboard(token); // Fallback
                btn.classList.remove('loading');
                btn.classList.add('copied');
                btn.innerHTML = `${CHECK_ICON}<span class="ds-label">Kopiert!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `${COPY_ICON}<span class="ds-label">Kopieren</span>`;
                }, 2000);
            } catch(e) {
                GM_setClipboard(token);
                btn.classList.remove('loading');
                btn.classList.add('copied');
                btn.innerHTML = `${CHECK_ICON}<span class="ds-label">Kopiert!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `${COPY_ICON}<span class="ds-label">Kopieren</span>`;
                }, 2000);
            }
        });

        container.appendChild(label);
        container.appendChild(tokenDisplay);
        container.appendChild(btn);

        return container;
    }

    // --- Warten auf Seite und Token ---
    function waitAndInject() {
        if (retries >= MAX_RETRIES) return;

        const token = findToken();
        if (!token) {
            retries++;
            setTimeout(waitAndInject, CHECK_INTERVAL);
            return;
        }

        // Seite hat geladen, Token gefunden — einfügen
        const target = document.querySelector('[class*="api_keys"], [class*="token-list"], [class*="apikey-list"], main, .app-content, #root > div > div');
        if (!target) {
            // Fallback: ans Ende von #root
            const root = document.getElementById('root');
            if (root) {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'padding:16px 24px;border-bottom:1px solid #E5E7EB;background:white;';
                wrapper.appendChild(createButton(token));
                root.prepend(wrapper);
            }
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding:12px 24px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;';
        wrapper.appendChild(createButton(token));

        // Vor dem ersten Child einfügen
        target.prepend(wrapper);
    }

    // --- Start ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndInject);
    } else {
        waitAndInject();
    }
})();
