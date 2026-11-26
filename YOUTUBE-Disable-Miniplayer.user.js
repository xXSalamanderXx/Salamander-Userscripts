// ==UserScript==
// @name         YOUTUBE-Disable-Miniplayer
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      1.2.0
// @description  Hides YouTube's miniplayer and stops background playback after leaving a video page.
// @updateURL    https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/YOUTUBE-Disable-Miniplayer.user.js
// @downloadURL  https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/YOUTUBE-Disable-Miniplayer.user.js
// @author       xXSalamanderXx
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const playerSelector = '#movie_player';
    const blockedMediaSelector = '#movie_player, ytd-miniplayer';

    const style = document.createElement('style');
    style.textContent = `
        ytd-miniplayer,
        .ytp-miniplayer-ui,
        #movie_player.ytp-mini-player-active {
            display: none !important;
        }
    `;

    function installStyle() {
        if (!style.isConnected && document.documentElement) {
            document.documentElement.appendChild(style);
        }
    }

    function isPlaybackPage() {
        const path = location.pathname;
        return path === '/watch' ||
            /^\/(?:shorts|live|embed|clip)\/[^/]+/.test(path);
    }

    function pauseBackgroundPlayer() {
        if (isPlaybackPage()) return;

        document.querySelectorAll(playerSelector).forEach(player => {
            if (typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
        });

        document.querySelectorAll(
            '#movie_player video, #movie_player audio, ' +
            'ytd-miniplayer video, ytd-miniplayer audio'
        ).forEach(media => {
            if (!media.paused) media.pause();
        });
    }

    function onMediaStart(event) {
        const media = event.target;
        if (
            !isPlaybackPage() &&
            media instanceof HTMLMediaElement &&
            media.closest(blockedMediaSelector) &&
            !media.paused
        ) {
            media.pause();
        }
    }

    // Catch playback that resumes after YouTube moves or reuses the player.
    document.addEventListener('play', onMediaStart, true);
    document.addEventListener('playing', onMediaStart, true);

    // Check the committed URL, not the URL before navigation.
    window.navigation?.addEventListener(
        'currententrychange', pauseBackgroundPlayer
    );
    window.addEventListener('yt-navigate-finish', pauseBackgroundPlayer);
    window.addEventListener('popstate', pauseBackgroundPlayer);
    window.addEventListener('pageshow', pauseBackgroundPlayer);

    installStyle();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            installStyle();
            pauseBackgroundPlayer();
        }, { once: true });
    } else {
        pauseBackgroundPlayer();
    }
})();
