// js/components/media-renderer.js
// Pure rendering — takes data, produces DOM. No Supabase calls, no state writes.

// ── Unit label helpers ────────────────────────────────────────────────────────

export function getUnitLabel(mediaType) {
    const map = {
        'book':     'pages',
        'manga':    'chapters',
        'tv show':  'episodes',
        'anime':    'episodes',
        'movie':    'minutes',
        'concert':  'attended'
    };
    return map[(mediaType || '').toLowerCase().trim()] || 'units';
}

export function getSeriesLabel(mediaType) {
    const map = {
        'book':     'books',
        'manga':    'volumes',
        'tv show':  'seasons',
        'anime':    'seasons',
        'movie':    'movies',
        'concert':  'concerts'
    };
    return map[(mediaType || '').toLowerCase().trim()] || 'units';
}

export function getMediaImageUrl(media) {
    return media.imageUrl || media.cover_art_url || null;
}

const ZERO_PROGRESS_MEDIA_TYPES = [
    { key: 'book',    label: 'Books' },
    { key: 'manga',   label: 'Manga' },
    { key: 'anime',   label: 'Anime' },
    { key: 'tvshow',  label: 'TV Shows' },
    { key: 'movie',   label: 'Movies' },
    { key: 'concert', label: 'Concerts' }
];

function normaliseMediaType(mediaType) {
    const type = (mediaType || '').toLowerCase().trim();
    if (type === 'tv show' || type === 'tv shows' || type === 'tv_show' || type === 'tvshow') {
        return 'tvshow';
    }
    return type;
}

function renderMediaTypeDivider(label) {
    const divider = document.createElement('div');
    divider.className = 'media-type-divider';
    divider.setAttribute('role', 'heading');
    divider.setAttribute('aria-level', '2');
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    divider.appendChild(labelElement);
    return divider;
}

// ── Card builder ──────────────────────────────────────────────────────────────

/**
 * Build a single media card DOM element.
 * The "Details" button calls window.openUpdateModal (set by modal-manager).
 */
export function renderMediaCard(media) {
    const container = document.createElement('div');
    container.className = 'media-container';
    container.dataset.mediaId = media.id;

    const unitLabel   = getUnitLabel(media.mediaType);
    const seriesLabel = getSeriesLabel(media.mediaType);
    const imageUrl    = getMediaImageUrl(media);
    const hasImage    = imageUrl && imageUrl.trim() !== '';

    const imageHtml = hasImage
        ? `<img src="${imageUrl}" alt="${media.title}" class="media-image"
               onerror="this.parentElement.innerHTML='<div class=\\'media-image-placeholder\\'>${media.title}</div>'">`
        : `<div class="media-image-placeholder">${media.title}</div>`;

    const seriesHtml = media.series
        ? `<span class="series-tooltip">
               Series: ${media.series.currentSeriesUnits || 0} / ${media.series.totalSeriesUnits || 1} ${seriesLabel}
           </span>`
        : '';

    container.innerHTML = `
        <div class="media-top-section">
            <div class="media-image-row">${imageHtml}</div>
            <div class="media-info-row">
                <div class="media-title">${media.title}</div>
            </div>
        </div>
        <div class="media-info">
            <div class="media-info-row">
                <div class="media-writer">${media.writer}</div>
            </div>
            <div class="media-info-row">
                <div class="media-detail"><strong>Status:</strong> ${media.status}</div>
            </div>
            <div class="media-info-row">
                <div class="media-detail"><strong>Type:</strong> ${media.mediaType}</div>
            </div>
            <div class="media-info-row">
                <div class="media-detail">
                    <strong>Progress:</strong>
                    <span class="progress-with-tooltip">
                        ${media.currentPage || 0} / ${media.totalPages || 1} ${unitLabel}
                        ${seriesHtml}
                    </span>
                </div>
            </div>
            <div class="media-info-row">
                <div class="progress-container">
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar" style="width: ${media.percentageComplete}%"></div>
                        <div class="progress-text">${media.percentageComplete}%</div>
                    </div>
                </div>
            </div>
            <div class="media-info-row">
                <button type="button" class="button update-button" data-media-id="${media.id}">Details</button>
            </div>
        </div>
    `;

    // Attach event listener instead of inline onclick
    container.querySelector('.update-button').addEventListener('click', () => {
        window.openUpdateModal?.(media.id);
    });

    return container;
}

// ── List renderer ─────────────────────────────────────────────────────────────

/**
 * Render all media cards into #media-list.
 */
export function renderMediaItems(mediaArray) {
    const mediaList = document.getElementById('media-list');
    if (!mediaList) return;

    mediaList.innerHTML = '';

    if (!mediaArray || mediaArray.length === 0) {
        mediaList.innerHTML = '<p style="text-align:center; color: rgba(244,244,255,0.6);">No media currently in progress. Search above to start tracking.</p>';
        return;
    }

    const inProgress = mediaArray.filter(media => Number(media.currentPage || 0) > 0);
    const notStarted = mediaArray
        .filter(media => Number(media.currentPage || 0) <= 0)
        .map((media, index) => ({ media, index }))
        .sort((a, b) => {
            const aOrder = ZERO_PROGRESS_MEDIA_TYPES.findIndex(type => type.key === normaliseMediaType(a.media.mediaType));
            const bOrder = ZERO_PROGRESS_MEDIA_TYPES.findIndex(type => type.key === normaliseMediaType(b.media.mediaType));
            return (aOrder === -1 ? ZERO_PROGRESS_MEDIA_TYPES.length : aOrder)
                - (bOrder === -1 ? ZERO_PROGRESS_MEDIA_TYPES.length : bOrder)
                || a.index - b.index;
        })
        .map(entry => entry.media);

    inProgress.forEach(media => mediaList.appendChild(renderMediaCard(media)));

    let previousType = null;
    notStarted.forEach(media => {
        const mediaType = normaliseMediaType(media.mediaType);
        if (mediaType !== previousType) {
            const typeConfig = ZERO_PROGRESS_MEDIA_TYPES.find(type => type.key === mediaType);
            mediaList.appendChild(renderMediaTypeDivider(typeConfig?.label || media.mediaType || 'Other'));
            previousType = mediaType;
        }
        mediaList.appendChild(renderMediaCard(media));
    });
}

/**
 * Show a loading placeholder while data is being fetched.
 */
export function renderLoadingState() {
    const mediaList = document.getElementById('media-list');
    if (!mediaList) return;
    mediaList.innerHTML = '<p style="text-align:center; color: rgba(244,244,255,0.4);">Loading…</p>';
}
