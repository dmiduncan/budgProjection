// js/app.js
// Thin orchestrator — wires auth events to app init/teardown.

import { getState } from './app-state.js';
import { initApp } from './main.js';

let appInitialized = false;

async function onSignIn() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'block';

    if (!appInitialized) {
        appInitialized = true;
        await initApp();
    }
}

function onSignOut() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'none';
    appInitialized = false;
}

window.addEventListener('userSignedIn', onSignIn);
window.addEventListener('userSignedOut', onSignOut);

// Fallback: auth may have resolved before this listener registered
const { user } = getState();
if (user) onSignIn();
