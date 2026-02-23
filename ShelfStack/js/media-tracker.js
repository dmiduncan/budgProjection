// js/media-tracker.js
// Thin orchestrator — wires all components together.
// Handles app init on sign-in, teardown on sign-out, and state-driven re-renders.

import { getState, setState, subscribe } from './app-state.js';
import { fetchTrackedMedia, fetchAllMediaItems } from './services/media-service.js';
import { fetchStreaks, renderStreakBar, hideAllStreaks } from './services/streak-service.js';
import { renderMediaItems, renderLoadingState } from './components/media-renderer.js';
import { initModals, openSearchModal } from './components/modal-manager.js';
import { initAutocomplete } from './components/autocomplete.js';
import { showToast } from './toast.js';

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadTrackedMedia() {
    const { user } = getState();
    if (!user) return;

    renderLoadingState();

    const { data, error } = await fetchTrackedMedia(user.id);

    if (error) {
        showToast('Error loading tracked media: ' + error.message, 'error');
        renderMediaItems([]);
        return;
    }

    const trackedMedia = (data || []).map(item => ({
        id:                 item.id,
        statusId:           item.status_id,
        title:              item.title || '',
        writer:             item.writer || '',
        mediaType:          item.media_type || '',
        totalPages:         item.total_pages || 1,
        currentPage:        item.current_page || 0,
        percentageComplete: item.percentage_complete || 0,
        status:             item.status,
        imageUrl:           item.image_url || null,
        dateUpdated:        item.date_updated,
        series:             item.series_id ? {
            id:                 item.series_id,
            name:               item.series_name,
            currentSeriesUnits: item.series_total_current_units,
            totalSeriesUnits:   item.series_total_units
        } : null
    }));

    const trackedMediaIds = new Set(trackedMedia.map(m => m.id));
    setState({ trackedMedia, trackedMediaIds });
}

async function loadAllMedia() {
    const { user, allMediaItems } = getState();
    if (!user || allMediaItems.length > 0) return; // already loaded — catalog is stable

    const { data, error } = await fetchAllMediaItems(user.id);
    if (error) {
        console.warn('Could not load full media catalog:', error.message);
        return;
    }

    setState({
        allMediaItems:    data.allItems,
        completedMediaIds: data.completedIds
    });
}

async function loadStreaks() {
    const { user } = getState();
    if (!user) return;

    const { data, error } = await fetchStreaks(user.id);
    if (error) {
        console.warn('Could not load streaks:', error.message);
        hideAllStreaks();
        return;
    }

    renderStreakBar(data);
    setState({ streaks: data });
}

// ── Search ────────────────────────────────────────────────────────────────────

function runSearch(searchTerm) {
    const { allMediaItems, completedMediaIds } = getState();
    if (!searchTerm || searchTerm.trim() === '') {
        showToast('Please enter a search term.', 'info');
        return;
    }

    const lower = searchTerm.toLowerCase().trim();

    const results = allMediaItems
        .filter(item =>
            (item.title || '').toLowerCase().includes(lower) ||
            (item.writer || '').toLowerCase().includes(lower) ||
            (item.mediaType || '').toLowerCase().includes(lower)
        )
        .sort((a, b) =>
            (a.title || '').toLowerCase()
                .localeCompare((b.title || '').toLowerCase(), undefined, { numeric: true, sensitivity: 'base' })
        )
        .map(item => ({ ...item, previouslyCompleted: completedMediaIds.has(item.id) }));

    openSearchModal(results);
}

// ── App init / teardown ───────────────────────────────────────────────────────

async function onSignIn() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'block';

    // Load in parallel where possible
    await Promise.all([
        loadTrackedMedia(),
        loadAllMedia()
    ]);
    await loadStreaks();
}

function onSignOut() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'none';

    renderMediaItems([]);
    hideAllStreaks();
}

// ── Wire up ───────────────────────────────────────────────────────────────────

function init() {
    // Init modal event bindings
    initModals();

    // Init autocomplete
    const searchInput = document.getElementById('search-input');
    const dropdown    = document.getElementById('autocomplete-dropdown');
    initAutocomplete(searchInput, dropdown, (selectedTitle) => {
        if (searchInput) searchInput.value = selectedTitle;
        runSearch(selectedTitle);
    });

    // Search button
    document.getElementById('search-btn')?.addEventListener('click', () => {
        const term = document.getElementById('search-input')?.value?.trim();
        dropdown?.classList.remove('active');
        runSearch(term);
    });

    // Enter key in search input
    document.getElementById('search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            dropdown?.classList.remove('active');
            runSearch(e.target.value.trim());
        }
    });

    // Auth events
    window.addEventListener('userSignedIn', onSignIn);
    window.addEventListener('userSignedOut', onSignOut);

    // Fallback: if auth already resolved before this listener registered (e.g. fast session
    // restore from localStorage), check state immediately and trigger init manually.
    const { user } = getState();
    if (user) {
        onSignIn();
    }

    // Background reload triggered by autocomplete inline track
    window.addEventListener('reloadTrackedMedia', loadTrackedMedia);

    // State subscription — re-render cards whenever trackedMedia changes
    subscribe((state) => {
        renderMediaItems(state.trackedMedia);
        renderStreakBar(state.streaks);
    });
}

// Run after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for any legacy callers
export { loadTrackedMedia };
