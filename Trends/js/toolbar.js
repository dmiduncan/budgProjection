// js/toolbar.js

import { signOut } from './auth.js';

export function initToolbar() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const nestedTrendsPath = window.location.pathname.includes('/ShelfStack/trends/');
    const landingPagePath = nestedTrendsPath ? '../../' : '../';
    const shelfStackPath = nestedTrendsPath ? '../../ShelfStack/' : '../ShelfStack/';

    toolbar.innerHTML = `
        <div class="toolbar__inner">
            <div class="toolbar__brand">
                <a class="toolbar__logo" href="${landingPagePath}">Trends</a>
            </div>
            <nav class="toolbar__nav">
                <button type="button" class="toolbar__btn" id="toolbar-shelfstack-btn" title="ShelfStack">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 20 18"
                         fill="none" stroke="currentColor" stroke-width="1.5"
                         stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2.5" y="3" width="3" height="12" rx="0.3"/>
                        <rect x="7" y="8" width="3" height="7" rx="0.3"/>
                        <rect x="11.5" y="5" width="3" height="10" rx="0.3"/>
                        <g transform="rotate(-15, 18.5, 15)">
                            <rect x="16" y="7" width="2.5" height="8" rx="0.3"/>
                        </g>
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

    document.getElementById('toolbar-shelfstack-btn')?.addEventListener('click', () => {
        window.location.href = shelfStackPath;
    });

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
