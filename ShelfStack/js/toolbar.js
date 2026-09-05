// js/toolbar.js

import { signOut } from './auth.js';

export function initToolbar() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    toolbar.innerHTML = `
        <div class="toolbar__inner">
            <div class="toolbar__brand">
                <a class="toolbar__logo" href="../">shelf<span>STACK</span></a>
            </div>
            <nav class="toolbar__nav" id="toolbar-nav">
                <button type="button" class="toolbar__btn" title="Trends" onclick="window.location.href='trends/'">
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="2,16 6,9 10,13 14,6 18,10 22,5"/>
                    </svg>
                </button>
                <button type="button" class="toolbar__btn toolbar__btn--hidden" id="toolbar-logout-btn" title="Sign out">
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </button>
            </nav>
        </div>
    `;

    const logoutBtn = document.getElementById('toolbar-logout-btn');

    logoutBtn?.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await signOut();
        logoutBtn.disabled = false;
    });

    window.addEventListener('userSignedIn', () => {
        logoutBtn?.classList.remove('toolbar__btn--hidden');
    });

    window.addEventListener('userSignedOut', () => {
        logoutBtn?.classList.add('toolbar__btn--hidden');
    });
}
