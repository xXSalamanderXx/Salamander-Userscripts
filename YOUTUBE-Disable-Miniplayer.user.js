// ==UserScript==
// @name         YOUTUBE-Disable-Miniplayer
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      1.1.0
// @description  Disables YouTube's miniplayer by blocking DOM attributes, intercepting navigation, and pausing playback.
// @updateURL    https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/YOUTUBE-Disable-Miniplayer.user.js
// @downloadURL  https://raw.githubusercontent.com/xXSalamanderXx/Salamander-Userscripts/main/YOUTUBE-Disable-Miniplayer.user.js
// @author       xXSalamanderXx
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-start
// ==/UserScript==


(function() {
    'use strict';


    const css = `
        ytd-miniplayer,
        [miniplayer-active_] ytd-miniplayer,
        [miniplayer-active] ytd-miniplayer,
        .ytp-miniplayer-ui,
        #movie_player.ytp-mini-player-active {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    if (document.documentElement) document.documentElement.appendChild(style);


    const killPlayback = () => {
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
        }


        const closeBtn = document.querySelector('.ytp-miniplayer-close-button');
        if (closeBtn) {
            closeBtn.click();
        }
    };


    if (window.navigation) {
        window.navigation.addEventListener('navigate', (event) => {
            const url = new URL(event.destination.url);
            if (!url.pathname.startsWith('/watch')) {
                killPlayback();
            }
        });
    }


    window.addEventListener('yt-navigate-start', (e) => {
        if (e.detail?.url && !e.detail.url.includes('/watch')) {
            killPlayback();
        }
    });


    const observer = new MutationObserver(() => {
        const app = document.querySelector('ytd-app');
        const isMiniActive = app && (app.hasAttribute('miniplayer-active_') || app.hasAttribute('miniplayer-active')) ||
                             document.querySelector('ytd-miniplayer[active]');


        if (isMiniActive) {
            killPlayback();


            if (app) {
                app.removeAttribute('miniplayer-active_');
                app.removeAttribute('miniplayer-active');
            }
            const mini = document.querySelector('ytd-miniplayer');
            if (mini) mini.removeAttribute('active');
        }
    });


    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['miniplayer-active_', 'miniplayer-active', 'active']
            });
        } else {
            requestAnimationFrame(startObserver);
        }
    };
    startObserver();


})();