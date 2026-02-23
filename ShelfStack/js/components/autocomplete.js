// js/components/autocomplete.js
// Search input autocomplete dropdown.
// Reads from state, calls trackMedia from media-service for inline tracking.

import { getState, setState } from '../app-state.js';
import { trackMedia as trackMediaService } from '../services/media-service.js';
import { getMediaImageUrl, getUnitLabel } from './media-renderer.js';
import { showToast } from '../toast.js';

const AUTOCOMPLETE_DEBOUNCE_MS = 150;
const MAX_AUTOCOMPLETE_RESULTS = 10;

let debounceTimer = null;

const ICON_PREVIOUSLY_COMPLETED_SM = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="#9bf1ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="5 8 9 12 17 4" stroke-width="2.4"/>
        <path d="M12 22 C10 21 5 20 2 20 L3 16 C6 16 10 17 12 19Z"/>
        <path d="M12 22 C14 21 19 20 22 20 L21 16 C18 16 14 17 12 19Z"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>`;

// ── Filter ────────────────────────────────────────────────────────────────────

function filterMedia(searchTerm) {
    const { allMediaItems, completedMediaIds } = getState();
    if (!searchTerm || searchTerm.trim() === '') return [];

    const lower = searchTerm.toLowerCase().trim();

    return allMediaItems
        .filter(item =>
            (item.title || '').toLowerCase().includes(lower) ||
            (item.writer || '').toLowerCase().includes(lower) ||
            (item.mediaType || '').toLowerCase().includes(lower)
        )
        .sort((a, b) =>
            (a.title || '').toLowerCase()
                .localeCompare((b.title || '').toLowerCase(), undefined, { numeric: true, sensitivity: 'base' })
        )
        .slice(0, MAX_AUTOCOMPLETE_RESULTS)
        .map(item => ({ ...item, previouslyCompleted: completedMediaIds.has(item.id) }));
}

// ── Render dropdown ───────────────────────────────────────────────────────────

function renderDropdown(suggestions, dropdown, inputEl, onSelectItem) {
    dropdown.innerHTML = '';

    if (suggestions.length === 0) {
        dropdown.classList.remove('active');
        return;
    }

    const { trackedMediaIds } = getState();

    suggestions.forEach(item => {
        const isTracked  = trackedMediaIds.has(item.id);
        const imageUrl   = getMediaImageUrl(item);
        const hasImage   = imageUrl && imageUrl.trim() !== '';

        const thumbnailHtml = hasImage
            ? `<img src="${imageUrl}" alt="${item.title}" class="autocomplete-item-thumbnail"
                   onerror="this.style.display='none'">`
            : `<div class="autocomplete-item-thumbnail autocomplete-item-thumbnail--placeholder">
                   ${item.title.charAt(0)}
               </div>`;

        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.dataset.mediaId = item.id;

        el.innerHTML = `
            ${thumbnailHtml}
            <div class="autocomplete-item-content">
                <div class="autocomplete-item-title">${item.title}</div>
                <div class="autocomplete-item-details">
                    ${item.writer ? `<strong>Writer:</strong> ${item.writer} · ` : ''}
                    <strong>Type:</strong> ${item.mediaType}
                </div>
            </div>
            <div class="autocomplete-item-track" style="display:flex; align-items:center; gap:0.25em;">
                ${item.previouslyCompleted
                    ? `<span class="autocomplete-tracked-icon" title="Previously completed">
                           ${ICON_PREVIOUSLY_COMPLETED_SM}</span>`
                    : ''
                }
                ${isTracked
                    ? `<span class="autocomplete-tracked-icon" title="Already tracked">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                               <polyline points="20 6 9 17 4 12"/>
                           </svg></span>`
                    : `<button type="button" class="button autocomplete-track-btn js-ac-track"
                           data-media-id="${item.id}" title="Start tracking">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                               <line x1="12" y1="5" x2="12" y2="19"/>
                               <line x1="5" y1="12" x2="19" y2="12"/>
                           </svg></button>`
                }
            </div>
        `;

        // Track button click — does not open search modal
        el.querySelector('.js-ac-track')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleInlineTrack(item.id, el);
        });

        // Row click — fill input and open search modal
        el.addEventListener('click', (e) => {
            if (e.target.closest('.js-ac-track')) return;
            inputEl.value = item.title;
            dropdown.classList.remove('active');
            onSelectItem(item.title);
        });

        dropdown.appendChild(el);
    });

    dropdown.scrollTop = 0;
    dropdown.classList.add('active');
}

async function handleInlineTrack(mediaId, el) {
    const { user, trackedMediaIds } = getState();
    if (!user) return;

    if (trackedMediaIds.has(mediaId)) {
        showToast('Already tracking.', 'info');
        return;
    }

    const { error } = await trackMediaService(mediaId, user.id);
    if (error) {
        showToast('Error tracking: ' + error.message, 'error');
        return;
    }

    const newTracked = new Set(trackedMediaIds);
    newTracked.add(mediaId);
    setState({ trackedMediaIds: newTracked });

    showToast('Now tracking!', 'success');

    // Swap button for checkmark
    const btn = el.querySelector('.js-ac-track');
    if (btn) {
        btn.outerHTML = `<span class="autocomplete-tracked-icon" title="Already tracked">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg></span>`;
    }

    // Reload tracked media in background
    window.dispatchEvent(new CustomEvent('reloadTrackedMedia'));
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement} dropdownEl
 * @param {function} onSelectItem - Called with the selected title; should open search modal
 */
export function initAutocomplete(inputEl, dropdownEl, onSelectItem) {
    if (!inputEl || !dropdownEl) return;

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const term = inputEl.value.trim();
            if (term.length === 0) {
                dropdownEl.classList.remove('active');
                return;
            }
            renderDropdown(filterMedia(term), dropdownEl, inputEl, onSelectItem);
        }, AUTOCOMPLETE_DEBOUNCE_MS);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdownEl.classList.remove('active');
    });

    inputEl.addEventListener('focus', () => {
        if (inputEl.value.trim().length > 0) {
            renderDropdown(filterMedia(inputEl.value.trim()), dropdownEl, inputEl, onSelectItem);
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!inputEl.closest('.autocomplete-container')?.contains(e.target)) {
            dropdownEl.classList.remove('active');
        }
    });
}
