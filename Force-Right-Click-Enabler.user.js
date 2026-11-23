// ==UserScript==
// @name         Force Right Click Enabler
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      0.0.1
// @description  Restore native context menus, text selection, and copy without changing cursors.
// @author       xXSalamanderXx
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @icon         https://i.postimg.cc/wqJ0kBNc/Force-Enable-Right-Click.jpg
// @homepageURL  https://github.com/xXSalamanderXx/Salamander-Userscripts
// @supportURL   https://github.com/xXSalamanderXx/Salamander-Userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/Force-Right-Click-Enabler.user.js
// @updateURL    https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/Force-Right-Click-Enabler.user.js
// ==/UserScript==

(() => {
    'use strict';

    const key = `enabled:${location.origin}`;
    const enabled = GM_getValue(key, true);
    if (window === window.top) {
        GM_registerMenuCommand(enabled ? 'Disable on this origin' : 'Enable on this origin', () => {
            GM_setValue(key, !enabled);
            location.reload();
        });
    }
    if (!enabled) return;

    const options = { capture: true, passive: true };
    const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

    window.addEventListener('contextmenu', event => {
        if (event.isTrusted) event.stopImmediatePropagation();
    }, options);

    function allowNativeTextAction(event) {
        if (!event.isTrusted) return;
        const inEditor = event.composedPath().some(node =>
            node?.nodeType === 1 && (node.isContentEditable || node.matches(editable))
        );
        if (!inEditor) event.stopImmediatePropagation();
    }
    for (const type of ['copy', 'selectstart']) {
        window.addEventListener(type, allowNativeTextAction, options);
    }

    const css = `
        body, body *:not(:where(
            button, button *, input, textarea, select, option,
            [role="button"], [role="button"] *,
            [contenteditable], [contenteditable] *
        )) {
            -webkit-user-select: text !important;
            user-select: text !important;
        }
    `;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => GM_addStyle(css), { once: true });
    } else {
        GM_addStyle(css);
    }
})();
