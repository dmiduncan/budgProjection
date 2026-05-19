// js/components/modal-manager.js
// Manages all three modals: update progress, search results, confirmation.
// Calls media-service.js for mutations. Calls setState() after changes.
// Never calls Supabase directly.

import { getState, setState } from '../app-state.js';
import {
    MediaStatus,
    updateMediaStatus,
    insertJournalEntry,
    trackMedia as trackMediaService,
    quickCompleteMedia,
    fetchTrackedMedia
} from '../services/media-service.js';
import { updateStreakForMediaType } from '../services/streak-service.js';
import { getUnitLabel, getMediaImageUrl } from './media-renderer.js';
import { showToast } from '../toast.js';

// ── State ─────────────────────────────────────────────────────────────────────

let currentModalMediaId   = null;
let currentConfirmAction  = null;
let saveInProgress = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculatePercentage(current, total) {
    if (!total || total === 0) return 0;
    return Math.round((current / total) * 100);
}

// ── Update Modal ──────────────────────────────────────────────────────────────

export function openUpdateModal(mediaId) {
    const { trackedMedia } = getState();
    const mediaItem = trackedMedia.find(m => m.id === mediaId);
    if (!mediaItem) return;

    currentModalMediaId = mediaId;

    const modal         = document.getElementById('update-modal');
    const progressLabel = document.getElementById('current-progress-label');
    const progressValue = document.getElementById('current-progress-value');
    const updateInput   = document.getElementById('modal-update-input');
    const updateLabel   = document.getElementById('modal-update-label');

    const label = getUnitLabel(mediaItem.mediaType);
    progressLabel.textContent = `Current ${label}:`;
    progressValue.textContent = `${mediaItem.currentPage || 0} / ${mediaItem.totalPages || 1}`;
    updateLabel.textContent   = `New ${label}:`;
    updateInput.value         = '';
    updateInput.placeholder   = `Enter new ${label.toLowerCase()}`;
    updateInput.min           = 0;
    updateInput.max           = mediaItem.totalPages || 1;

    modal?.classList.add('active');
    updateInput.focus();
}

export function closeUpdateModal() {
    document.getElementById('update-modal')?.classList.remove('active');
    currentModalMediaId = null;
}

export async function saveProgress(newValue) {
    // Prevent duplicate submission
    if (saveInProgress) {
        console.warn('Save already in progress');
        return;
    }

    if (currentModalMediaId === null) return;

    saveInProgress = true;

    try {
        const { trackedMedia, user } = getState();
        const mediaItem = trackedMedia.find(m => m.id === currentModalMediaId);

        if (!mediaItem || !mediaItem.statusId) {
            showToast('Media item not found.', 'error');
            return;
        }

        const newPage = parseInt(newValue, 10);
        if (isNaN(newPage) || newPage < 0 || newPage > (mediaItem.totalPages || 1)) {
            showToast(`Please enter a value between 0 and ${mediaItem.totalPages || 1}.`, 'error');
            return;
        }

        const journalUnits  = newPage - (mediaItem.currentPage || 0);
        const isAutoFinish  = newPage === (mediaItem.totalPages || 1);

        const updateData = {
            current_units:       newPage,
            percentage_complete: calculatePercentage(newPage, mediaItem.totalPages || 1)
        };

        if (isAutoFinish) {
            updateData.status        = MediaStatus.COMPLETED;
            updateData.date_finished = new Date().toISOString().split('T')[0];
        }

        const { error } = await updateMediaStatus(mediaItem.statusId, user.id, updateData);
        if (error) {
            showToast('Error updating progress: ' + error.message, 'error');
            return;
        }

        if (journalUnits !== 0) {
            const { error: jErr } = await insertJournalEntry(mediaItem.statusId, user.id, journalUnits);
            if (jErr) {
                console.warn('Journal entry failed (progress still saved):', jErr);
            } else {
                await updateStreakForMediaType(user.id, mediaItem.mediaType);
            }
        }

        if (isAutoFinish) {
            const { completedMediaIds } = getState();
            completedMediaIds.add(mediaItem.id);
            setState({ completedMediaIds });
            showToast(`"${mediaItem.title}" completed!`, 'success');
        } else {
            showToast('Progress saved.', 'success');
        }

        await reloadTrackedMedia();
        closeUpdateModal();
    } finally {
        saveInProgress = false;
    }
}

export async function finishMedia() {
    if (currentModalMediaId === null) return;

    const { trackedMedia, user } = getState();
    const mediaItem = trackedMedia.find(m => m.id === currentModalMediaId);
    if (!mediaItem || !mediaItem.statusId) return;

    const journalUnits = (mediaItem.totalPages || 1) - (mediaItem.currentPage || 0);

    const { error } = await updateMediaStatus(mediaItem.statusId, user.id, {
        current_units:       mediaItem.totalPages || 1,
        percentage_complete: 100,
        status:              MediaStatus.COMPLETED,
        date_finished:       new Date().toISOString().split('T')[0]
    });

    if (error) {
        showToast('Error finishing media: ' + error.message, 'error');
        return;
    }

    if (journalUnits > 0) {
        const { error: jErr } = await insertJournalEntry(mediaItem.statusId, user.id, journalUnits);
        if (!jErr) {
            await updateStreakForMediaType(user.id, mediaItem.mediaType);
        }
    }

    const { completedMediaIds } = getState();
    completedMediaIds.add(mediaItem.id);
    setState({ completedMediaIds });

    showToast(`"${mediaItem.title}" marked as finished!`, 'success');
    await reloadTrackedMedia();
    closeUpdateModal();
}

export async function dnfMedia() {
    if (currentModalMediaId === null) return;

    const { trackedMedia, user } = getState();
    const mediaItem = trackedMedia.find(m => m.id === currentModalMediaId);
    if (!mediaItem || !mediaItem.statusId) return;

    const { error } = await updateMediaStatus(mediaItem.statusId, user.id, {
        status: MediaStatus.ABANDONED
    });

    if (error) {
        showToast('Error updating status: ' + error.message, 'error');
        return;
    }

    showToast(`"${mediaItem.title}" marked as DNF.`, 'info');
    await reloadTrackedMedia();
    closeUpdateModal();
}

// ── Confirmation Modal ────────────────────────────────────────────────────────

export function openConfirmationModal(action) {
    currentConfirmAction = action;
    const modal = document.getElementById('confirmation-modal');
    const label = document.getElementById('modal-confirmation-label');

    if (label) {
        label.textContent = action === 'finish'
            ? 'Mark this as finished?'
            : 'Mark this as DNF (did not finish)?';
    }

    modal?.classList.add('active');
}

export function closeConfirmationModal() {
    document.getElementById('confirmation-modal')?.classList.remove('active');
    currentConfirmAction = null;
}

export async function confirmAction() {
    const action = currentConfirmAction;
    closeConfirmationModal();

    if (action === 'finish') await finishMedia();
    else if (action === 'dnf') await dnfMedia();
}

// ── Search Modal ──────────────────────────────────────────────────────────────

const ICON_PREVIOUSLY_COMPLETED = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="#9bf1ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="5 8 9 12 17 4" stroke-width="2.4"/>
        <path d="M12 22 C10 21 5 20 2 20 L3 16 C6 16 10 17 12 19Z"/>
        <path d="M12 22 C14 21 19 20 22 20 L21 16 C18 16 14 17 12 19Z"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>`;

const ICON_QUICK_COMPLETE = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5 C9 3 10 2 12 2 C14 2 15 3 15 5 C15 7 13 7.5 12 9"/>
        <circle cx="12" cy="11.5" r="0.8" fill="currentColor"/>
        <path d="M12 22 C10 21 5 20 2 20 L3 16 C6 16 10 17 12 19Z"/>
        <path d="M12 22 C14 21 19 20 22 20 L21 16 C18 16 14 17 12 19Z"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>`;

export function openSearchModal(results) {
    const modal       = document.getElementById('search-modal');
    const resultsList = document.getElementById('search-results-list');
    if (!modal || !resultsList) return;

    resultsList.innerHTML = '';

    if (!results || results.length === 0) {
        resultsList.innerHTML = `<div class="no-results"><p>No results found.</p></div>`;
    } else {
        const { trackedMediaIds, completedMediaIds } = getState();

        results.forEach(media => {
            const isTracked        = trackedMediaIds.has(media.id);
            const prevCompleted    = completedMediaIds.has(media.id);
            const canQuickComplete = prevCompleted || isTracked;

            const unitLabel        = getUnitLabel(media.mediaType);
            const capitalizedLabel = unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1);
            const imageUrl         = getMediaImageUrl(media);
            const hasImage         = imageUrl && imageUrl.trim() !== '';

            const imageHtml = hasImage
                ? `<img src="${imageUrl}" alt="${media.title}" class="media-image"
                       onerror="this.parentElement.innerHTML='<div class=\\'media-image-placeholder\\'>${media.title}</div>'">`
                : `<div class="media-image-placeholder">${media.title}</div>`;

            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <div class="media-top-section">
                    <div class="media-image-row">${imageHtml}</div>
                </div>
                <div class="media-info">
                    <div class="media-info-row">
                        <div class="media-title">${media.title}</div>
                    </div>
                    <div class="media-info-row">
                        <div class="media-writer">${media.writer}</div>
                    </div>
                    <div class="media-info-row">
                        <div class="media-detail"><strong>Type:</strong> ${media.mediaType}</div>
                    </div>
                    <div class="media-info-row">
                        <div class="media-detail"><strong>${capitalizedLabel}:</strong> ${media.totalUnits}</div>
                    </div>
                    <div class="media-info-row" style="gap: 0.5em;">
                        ${isTracked
                            ? `<span class="search-tracked-icon" title="Already tracked">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg></span>`
                            : `<button type="button" class="button search-track-btn js-track-btn"
                                   data-media-id="${media.id}" title="Start tracking">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg></button>`
                        }
                        ${prevCompleted
                            ? `<span class="search-tracked-icon" title="Previously completed">
                                ${ICON_PREVIOUSLY_COMPLETED}</span>`
                            : ''
                        }
                        ${!canQuickComplete
                            ? `<button type="button" class="button search-mark-done-btn js-quick-complete-btn"
                                   data-media-id="${media.id}" data-total-units="${media.totalUnits}"
                                   title="Mark done without tracking">
                                ${ICON_QUICK_COMPLETE}</button>`
                            : ''
                        }
                    </div>
                </div>
            `;

            // Wire track button
            resultItem.querySelector('.js-track-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleTrackFromSearch(media.id, resultItem);
            });

            // Wire quick complete button
            resultItem.querySelector('.js-quick-complete-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleQuickComplete(media.id, media.totalUnits, resultItem);
            });

            resultsList.appendChild(resultItem);
        });
    }

    modal.classList.add('active');
}

export function closeSearchModal() {
    document.getElementById('search-modal')?.classList.remove('active');
}

async function handleTrackFromSearch(mediaId, resultItemEl) {
    const { user, trackedMediaIds } = getState();
    if (!user) return;

    if (trackedMediaIds.has(mediaId)) {
        showToast('Already tracking this item.', 'info');
        return;
    }

    const { error } = await trackMediaService(mediaId, user.id);
    if (error) {
        showToast('Error tracking media: ' + error.message, 'error');
        return;
    }

    const newTracked = new Set(trackedMediaIds);
    newTracked.add(mediaId);
    setState({ trackedMediaIds: newTracked });

    showToast('Now tracking!', 'success');
    await reloadTrackedMedia();

    // Swap track button for checkmark in place
    const trackBtn = resultItemEl.querySelector('.js-track-btn');
    if (trackBtn) {
        trackBtn.outerHTML = `<span class="search-tracked-icon" title="Already tracked">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg></span>`;
    }
}

async function handleQuickComplete(mediaId, totalUnits, resultItemEl) {
    const { user, completedMediaIds } = getState();
    if (!user) return;

    const { error } = await quickCompleteMedia(mediaId, user.id, totalUnits);
    if (error) {
        showToast('Error completing media: ' + error.message, 'error');
        return;
    }

    const newCompleted = new Set(completedMediaIds);
    newCompleted.add(mediaId);
    setState({ completedMediaIds: newCompleted });

    showToast('Marked as completed!', 'success');

    // Swap quick complete button for previously-completed icon
    const qcBtn = resultItemEl.querySelector('.js-quick-complete-btn');
    if (qcBtn) {
        qcBtn.outerHTML = `<span class="search-tracked-icon" title="Previously completed">
            ${ICON_PREVIOUSLY_COMPLETED}</span>`;
    }
}

// ── Shared reload helper ──────────────────────────────────────────────────────

async function reloadTrackedMedia() {
    const { user } = getState();
    if (!user) return;

    const { data, error } = await fetchTrackedMedia(user.id);
    if (error) {
        console.error('Error reloading tracked media:', error);
        return;
    }

    const trackedMedia = (data || []).map(item => ({
        id:                item.id,
        statusId:          item.status_id,
        title:             item.title || '',
        writer:            item.writer || '',
        mediaType:         item.media_type || '',
        totalPages:        item.total_pages || 1,
        currentPage:       item.current_page || 0,
        percentageComplete: item.percentage_complete || 0,
        status:            item.status,
        imageUrl:          item.image_url || null,
        dateUpdated:       item.date_updated,
        series:            item.series_id ? {
            id:                   item.series_id,
            name:                 item.series_name,
            currentSeriesUnits:   item.series_total_current_units,
            totalSeriesUnits:     item.series_total_units
        } : null
    }));

    const trackedMediaIds = new Set(trackedMedia.map(m => m.id));
    setState({ trackedMedia, trackedMediaIds });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initModals() {
    // Update modal buttons
    document.getElementById('modal-save-btn')?.addEventListener('click', () => {
        const val = document.getElementById('modal-update-input')?.value;
        if (!val || val.trim() === '') {
            showToast('Please enter a value.', 'error');
            return;
        }
        saveProgress(val);
    });

    document.getElementById('modal-finish-btn')?.addEventListener('click', () => {
        openConfirmationModal('finish');
    });

    document.getElementById('modal-dnf-btn')?.addEventListener('click', () => {
        openConfirmationModal('dnf');
    });

    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeUpdateModal);

    // Allow Enter in the progress input to save
    document.getElementById('modal-update-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('modal-save-btn')?.click();
        }
    });

    // Update modal overlay click
    const updateModal = document.getElementById('update-modal');
    updateModal?.addEventListener('click', (e) => {
        if (e.target === updateModal) closeUpdateModal();
    });

    // Confirmation modal buttons
    document.getElementById('modal-confirm-yes')?.addEventListener('click', confirmAction);
    document.getElementById('modal-confirm-no')?.addEventListener('click', closeConfirmationModal);

    // Search modal close
    document.getElementById('search-modal-close-btn')?.addEventListener('click', closeSearchModal);

    const searchModal = document.getElementById('search-modal');
    searchModal?.addEventListener('click', (e) => {
        if (e.target === searchModal) closeSearchModal();
    });

    // Expose openUpdateModal globally for media-renderer button clicks
    window.openUpdateModal = openUpdateModal;
}
