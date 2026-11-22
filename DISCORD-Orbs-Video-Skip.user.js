// ==UserScript==
// @name        【Sorry,Discord!】 DC Orbs Quests Video Skip Button
// @namespace   https://github.com/NiktoBlox/Tampermonkey-Scripts/
// @version     0.5
// @description 🔒 99% Safe & Account Ban-Free Script — Floating draggable skip button for Discord Orbs Quests Videos
// @updateURL   https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/DISCORD-Orbs-Video-Skip.user.js
// @downloadURL https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/DISCORD-Orbs-Video-Skip.user.js
// @author      xXSalamanderXx
// @license     MIT
// @match       https://discord.com/*
// @icon        https://files.catbox.moe/kdzneo.png
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    const btn = document.createElement('button');
    btn.innerText = '⏭️ Skip';
    btn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 99900;
        background: #5865F2;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: bold;
        cursor: grab;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        user-select: none;
        display: none; /* Hidden by default */
        transition: background-color 0.2s;
    `;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    // --- Visibility Logic for Discord's SPA ---
    // Checks the URL every 500ms to see if we are on the quest-home page
    setInterval(() => {
        if (window.location.pathname.startsWith('/quest-home')) {
            if (btn.style.display === 'none') btn.style.display = 'block';
        } else {
            if (btn.style.display === 'block') btn.style.display = 'none';
        }
    }, 500);

    // --- Dragging Logic ---
    btn.addEventListener('mousedown', (e) => {
        isDragging = false;
        const rect = btn.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        btn.style.cursor = 'grabbing';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        btn.style.left = startLeft + 'px';
        btn.style.top = startTop + 'px';

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
            const newLeft = Math.max(10, Math.min(startLeft + dx, window.innerWidth - btn.offsetWidth - 10));
            const newTop = Math.max(10, Math.min(startTop + dy, window.innerHeight - btn.offsetHeight - 10));
            btn.style.left = newLeft + 'px';
            btn.style.top = newTop + 'px';
        };

        const onMouseUp = () => {
            btn.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // --- Safe Skip Logic ---
    btn.addEventListener('click', () => {
        if (isDragging) return;

        let found = false;

        // Target videos and finish them "legitimately"
        document.querySelectorAll('video').forEach(el => {
            if (el.duration) {
                // Mute to prevent browser autoplay blocks
                el.muted = true;
                // Jump to 1.5 seconds before the end
                el.currentTime = Math.max(0, el.duration - 1.5);
                // Let the video naturally trigger the 'ended' event
                el.play().catch(err => console.warn("Autoplay prevented:", err));
                found = true;
            }
        });

        // Click any standard skip/dismiss buttons if they exist
        ['[class*="skip"]', '[class*="close"]', '[class*="dismiss"]'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.offsetParent !== null) {
                    el.click();
                    found = true;
                }
            });
        });

        btn.innerText = found ? '✅ Completing...' : '❌ Not Found';
        setTimeout(() => { btn.innerText = '⏭️ Skip'; }, 2500);
    });

    // --- Hover Effects ---
    btn.onmouseover = () => { if (!isDragging) btn.style.background = '#4752C4'; };
    btn.onmouseout = () => { btn.style.background = '#5865F2'; };

    document.body.appendChild(btn);
})();
