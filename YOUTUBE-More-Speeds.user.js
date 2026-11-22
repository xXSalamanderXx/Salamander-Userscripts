// ==UserScript==
// @name         YouTube More Speeds
// @namespace    xXSalamanderXx.youtube-more-speeds
// @version      1.0
// @description  Adds a YouTube-style playback speed panel with a 0.25×–16× slider and 24 presets.
// @author       xXSalamanderXx
// @match        https://www.youtube.com/*
// @match        https://www.youtube-nocookie.com/embed/*
// @license      MIT
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const PRESETS = [
        0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
        2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4,
        5, 6, 7, 8, 10, 12, 14, 16,
    ];

    const PLAYER = '.html5-video-player';
    const MENU = '.ytp-settings-menu';
    const ROW = '.ytp-menuitem, [role="menuitem"], [role="menuitemradio"]';
    const GEAR = '.ytp-settings-button';
    const MOTION = matchMedia('(prefers-reduced-motion: reduce)');
    const TIMING = {
        duration: 180,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    };

    const format = rate => `${Number(rate.toFixed(2))}×`;
    let active = null;
    let speedSummaryFrame = 0;

    const style = document.createElement('style');
    style.textContent = `
        .ytp-settings-menu.ytms-covered {
            visibility: hidden !important;
            pointer-events: none !important;
        }

        .ytp-settings-menu.ytms-covered * {
            visibility: hidden !important;
        }

        .ytms-panel {
            position: absolute;
            z-index: 100;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            isolation: isolate;
            color: #fff;
            font: 400 13px Roboto, Arial, sans-serif;
            color-scheme: dark;
        }

        .ytms-header {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            gap: 9px;
            min-height: 37px;
            padding: 0 10px;
            border-bottom: 1px solid rgb(255 255 255 / 15%);
        }

        .ytms-panel button {
            appearance: none;
            border: 0;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .ytms-back {
            display: grid;
            place-items: center;
            flex: 0 0 27px;
            width: 27px;
            height: 27px;
            padding: 0;
            border-radius: 50%;
            background: transparent;
        }

        .ytms-back svg { width: 17px; height: 17px; }
        .ytms-back:hover { background: rgb(255 255 255 / 16%); }

        .ytms-title {
            flex: 1;
            white-space: nowrap;
        }

        .ytms-value {
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }

        .ytms-body {
            min-height: 0;
            overflow: auto;
            overscroll-behavior: contain;
            scrollbar-width: thin;
            padding: 6px 12px 11px;
        }

        .ytms-slider {
            display: block;
            box-sizing: border-box;
            width: 100%;
            height: 23px;
            margin: 0 0 6px;
            accent-color: #fff;
            cursor: pointer;
        }

        .ytms-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 5px;
        }

        .ytms-panel .ytms-preset {
            min-width: 0;
            height: 26px;
            padding: 0 2px;
            border-radius: 999px;
            background: rgb(255 255 255 / 13%);
            font-size: 12px;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }

        .ytms-panel .ytms-preset:hover {
            background: rgb(255 255 255 / 24%);
        }

        .ytms-panel .ytms-preset[aria-pressed="true"] {
            background: #f1f1f1;
            color: #0f0f0f;
        }

        .ytms-panel .ytms-preset[data-rate="1"] {
            box-shadow: inset 0 0 0 1px #fff;
        }

        .ytms-panel :focus-visible {
            outline: 2px solid #fff;
            outline-offset: 1px;
        }

        .ytms-status {
            margin: 7px 0 0;
            font-size: 11px;
        }

        .ytms-status:empty { display: none; }
    `;
    document.head.append(style);

    function make(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        return el;
    }

    function getVideo(player) {
        return player.querySelector('video.html5-main-video') ||
            player.querySelector('video');
    }

    function isSpeedRow(row) {
        const label = row.querySelector('.ytp-menuitem-label')?.textContent ||
            row.getAttribute('aria-label') || row.textContent;
        const id = [
            row.id,
            row.className,
            row.getAttribute('data-id'),
            row.getAttribute('data-menuitem-id'),
        ].join(' ');

        return /\bplayback\s+speed\b/i.test(label) ||
            /playback[-_\s]?speed|speedmaster/i.test(id);
    }

    function updateSpeedSummary() {
        for (const menu of document.querySelectorAll(MENU)) {
            const player = menu.closest(PLAYER);
            const video = player && getVideo(player);
            if (!video) continue;

            const row = [...menu.querySelectorAll(ROW)].find(candidate =>
                candidate.querySelector('.ytp-menuitem-content') &&
                isSpeedRow(candidate)
            );
            const summary = row?.querySelector('.ytp-menuitem-content');
            if (!summary) continue;

            const rate = Number(video.playbackRate.toFixed(2));
            const text = rate === 1
                ? 'Normal'
                : `${rate < 1 ? 'Slowed' : 'Faster'} - ${rate}x`;

            if (summary.textContent !== text) summary.textContent = text;
        }
    }

    function scheduleSpeedSummary() {
        if (speedSummaryFrame) return;
        speedSummaryFrame = requestAnimationFrame(() => {
            speedSummaryFrame = 0;
            updateSpeedSummary();
        });
    }

    function themePanel(panel, menu) {
        const outer = getComputedStyle(menu);
        const innerEl = menu.querySelector('.ytp-panel');
        const inner = innerEl ? getComputedStyle(innerEl) : outer;
        const transparent = color =>
            color === 'transparent' || color === 'rgba(0, 0, 0, 0)';

        panel.style.backgroundColor = [outer, inner]
            .map(css => css.backgroundColor)
            .find(color => !transparent(color)) || 'rgba(15, 15, 15, .88)';

        panel.style.backdropFilter = [outer, inner]
            .map(css => css.backdropFilter)
            .find(value => value && value !== 'none') || 'blur(12px)';

        panel.style.borderRadius = [outer, inner]
            .map(css => css.borderRadius)
            .find(value => value && value !== '0px') || '12px';

        if (outer.boxShadow !== 'none') panel.style.boxShadow = outer.boxShadow;
    }

    function position(state) {
        const { player, menu, panel } = state;
        const p = player.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        if (!p.width || !p.height || !m.width || !m.height) return false;

        const sx = p.width / (player.offsetWidth || p.width);
        const sy = p.height / (player.offsetHeight || p.height);
        const width = player.clientWidth;
        const height = player.clientHeight;
        const right = Math.max(6, Math.min(20, (p.right - m.right) / sx));
        const bottom = Math.max(6, Math.min(height - 52, (p.bottom - m.bottom) / sy));
        const panelWidth = Math.min(Math.max(228, m.width / sx), width - right - 6);

        panel.style.right = `${right}px`;
        panel.style.bottom = `${bottom}px`;
        panel.style.width = `${Math.max(0, panelWidth)}px`;
        panel.style.maxHeight = `${Math.max(0, height - bottom - 6)}px`;
        return true;
    }

    function close(back = false) {
        const state = active;
        if (!state) return;
        active = null;

        const { player, menu, row, panel } = state;

        state.abort.abort();
        state.observer.disconnect();
        state.resize.disconnect();
        state.enterAnimation?.cancel();
        state.backAnimation?.cancel();
        panel.remove();

        if (back) updateSpeedSummary();

        menu.classList.remove('ytms-covered');
        if (state.inertBefore) menu.setAttribute('inert', '');
        else menu.removeAttribute('inert');

        if (!back || !player.isConnected) return;

        requestAnimationFrame(() => {
            if (active || !player.isConnected) return;

            const menuIsOpen = [...player.querySelectorAll(MENU)].some(candidate =>
                candidate.getAttribute('aria-hidden') !== 'true' &&
                candidate.getClientRects().length > 0 &&
                getComputedStyle(candidate).visibility === 'visible'
            );

            if (!menuIsOpen) player.querySelector(GEAR)?.click();
            scheduleSpeedSummary();

            requestAnimationFrame(() => {
                if (!active && row.isConnected && row.getClientRects().length) {
                    row.focus({ preventScroll: true });
                }
            });
        });
    }

    function animateIn(state) {
        if (MOTION.matches) return;

        state.enterAnimation = state.panel.animate(
            [
                { transform: 'translateX(40px)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 },
            ],
            TIMING
        );

        state.enterAnimation.onfinish = () => {
            state.enterAnimation = null;
        };
    }

    function goBack() {
        const state = active;
        if (!state || state.backAnimation) return;

        if (MOTION.matches) {
            close(true);
            return;
        }

        const current = getComputedStyle(state.panel);
        const from = { transform: current.transform, opacity: current.opacity };
        state.enterAnimation?.cancel();
        state.enterAnimation = null;

        state.backAnimation = state.panel.animate(
            [from, { transform: 'translateX(40px)', opacity: 0 }],
            { ...TIMING, fill: 'forwards' }
        );

        state.backAnimation.onfinish = () => {
            if (active === state) close(true);
        };
    }

    function open(player, menu, row) {
        const video = getVideo(player);
        if (!video) return false;
        close();

        const panel = make('section', 'ytms-panel');
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Playback speed');

        const header = make('div', 'ytms-header');
        const back = make('button', 'ytms-back');
        back.type = 'button';
        back.setAttribute('aria-label', 'Back to settings');
        back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';

        const value = make('output', 'ytms-value');
        header.append(back, make('span', 'ytms-title', 'Playback speed'), value);

        const body = make('div', 'ytms-body');
        const slider = make('input', 'ytms-slider');
        slider.type = 'range';
        slider.min = '0.25';
        slider.max = '16';
        slider.step = '0.05';
        slider.setAttribute('aria-label', 'Playback speed');

        const grid = make('div', 'ytms-grid');
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Playback speed presets');

        const status = make('p', 'ytms-status');
        status.setAttribute('role', 'status');
        body.append(slider, grid, status);
        panel.append(header, body);

        const abort = new AbortController();
        const { signal } = abort;
        const buttons = new Map();

        function sync() {
            const rate = video.playbackRate;
            value.textContent = format(rate);
            slider.value = String(rate);
            slider.setAttribute('aria-valuetext', format(rate));

            for (const [preset, button] of buttons) {
                button.setAttribute('aria-pressed', String(Math.abs(rate - preset) < 0.001));
            }
        }

        function apply(rate) {
            status.textContent = '';
            try {
                video.playbackRate = rate;
                if (Math.abs(video.playbackRate - rate) >= 0.001) {
                    status.textContent = `${format(rate)} is unavailable in this player.`;
                }
            } catch {
                status.textContent = `${format(rate)} is unavailable in this browser.`;
            }
            sync();
            scheduleSpeedSummary();
        }

        for (const rate of PRESETS) {
            const button = make('button', 'ytms-preset', format(rate));
            button.type = 'button';
            button.dataset.rate = String(rate);
            button.addEventListener('click', () => apply(rate), { signal });
            buttons.set(rate, button);
            grid.append(button);
        }

        back.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            goBack();
        }, { signal });

        slider.addEventListener('input', () => apply(Number(slider.value)), { signal });
        video.addEventListener('ratechange', sync, { signal });

        for (const type of [
            'pointerdown', 'pointerup', 'mousedown', 'mouseup',
            'click', 'dblclick', 'keydown', 'keyup', 'wheel',
        ]) {
            panel.addEventListener(type, event => event.stopPropagation(), { signal });
        }

        const state = {
            player, menu, row, panel, abort,
            inertBefore: menu.hasAttribute('inert'),
            enterAnimation: null,
            backAnimation: null,
        };

        function check() {
            if (active !== state) return;

            if (!player.isConnected || !menu.isConnected ||
                !panel.isConnected || getVideo(player) !== video) {
                close();
                return;
            }

            if (state.backAnimation) return;

            if (menu.getAttribute('aria-hidden') === 'true' || !position(state)) {
                close();
            }
        }

        themePanel(panel, menu);
        player.append(panel);

        if (!position(state)) {
            panel.remove();
            abort.abort();
            return false;
        }

        active = state;
        menu.classList.add('ytms-covered');
        menu.setAttribute('inert', '');

        state.observer = new MutationObserver(check);
        state.observer.observe(menu, {
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
        });

        state.resize = new ResizeObserver(check);
        state.resize.observe(player);
        state.resize.observe(menu);

        window.addEventListener('resize', check, { signal });
        sync();
        back.focus({ preventScroll: true });
        animateIn(state);
        return true;
    }

    function intercept(event) {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (active) {
            if (active.panel.contains(target)) return;
            close();
        }

        if (target.closest(GEAR)) scheduleSpeedSummary();

        const row = target.closest(ROW);
        const menu = row?.closest(MENU);
        const player = menu?.closest(PLAYER);
        if (!player || !isSpeedRow(row)) return;

        if (open(player, menu, row)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    window.addEventListener('click', intercept, true);

    window.addEventListener('keydown', event => {
        if (active && event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            goBack();
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') intercept(event);
    }, true);

    window.addEventListener('pointerdown', event => {
        if (!active || !(event.target instanceof Element)) return;
        if (active.panel.contains(event.target)) return;

        const gear = event.target.closest(GEAR);
        if (!gear || active.player.contains(gear)) close();
    }, true);

    new MutationObserver(records => {
        for (const { target, addedNodes } of records) {
            const element = target instanceof Element ? target : target.parentElement;

            if (element?.closest(MENU) || [...addedNodes].some(node =>
                node instanceof Element &&
                (node.matches(MENU) || node.querySelector(MENU))
            )) {
                scheduleSpeedSummary();
                break;
            }
        }
    }).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
    });

    document.addEventListener('ratechange', scheduleSpeedSummary, true);
    document.addEventListener('yt-navigate-finish', scheduleSpeedSummary);
    document.addEventListener('yt-navigate-start', () => close(), true);
    document.addEventListener('fullscreenchange', () => close(), true);

    document.getElementById('more-speeds')?.remove();
    scheduleSpeedSummary();
})();
