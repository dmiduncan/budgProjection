// media-tracker.js
// Import Supabase from auth.js (which has the ShelfStack credentials)
import { supabase } from './auth.js';

let hasLoadedTrackedMedia = false;

// Helper function to get current user ID (cached)
async function getCurrentUserId() {
    // Return cached value if available
    if (cachedUserId !== null) {
        return cachedUserId;
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        console.error('Error getting user:', error);
        return null;
    }
    
    cachedUserId = user.id;
    return cachedUserId;
}

// Clear cached user ID (call on logout)
function clearCachedUserId() {
    cachedUserId = null;
}

// Media Status Enumeration
const MediaStatus = {
    PLANNED: 'planned',
    IN_PROGRESS: 'in progress',
    COMPLETED: 'completed',
    ABANDONED: 'abandoned',
    ON_HOLD: 'on hold'
};

// Calculate percentage helper
function calculatePercentage(current, total) {
    if (!total || total === 0) return 0;
    return Math.round((current / total) * 100);
}

// Get image URL for media item
function getMediaImageUrl(media) {
    // Prioritize cover_art_url from database if it exists
    if (media.imageUrl || media.cover_art_url) {
        return media.imageUrl || media.cover_art_url;
    }
    // Return null to trigger blank image
    return null;
}

let currentMediaData = []; // Will be loaded from lu_media_status
let currentModalMediaId = null;
let currentSearchResults = []; // Store current search results for tracking
let trackedMediaIds = new Set(); // Track which media_ids are already tracked as "in progress"
let allMediaItems = []; // Global list of all media for autocomplete
let cachedUserId = null; // Cache user ID to avoid repeated API calls

// Cache for frequently accessed DOM elements
const domCache = {
    searchInput: null,
    autocompleteDropdown: null,
    mediaList: null,
    updateModal: null,
    searchModal: null
};

// Initialize DOM cache
function initDOMCache() {
    domCache.searchInput = document.getElementById('search-input');
    domCache.autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    domCache.mediaList = document.getElementById('media-list');
    domCache.updateModal = document.getElementById('update-modal');
    domCache.searchModal = document.getElementById('search-modal');
}

async function loadStreaks(userId) {
    try {
        const { data, error } = await supabase.rpc('get_or_fix_user_streak', { p_user_id: userId });

        if (error) {
            console.error('Error running streak get or fix call.');
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            hideAllStreaks();
            return;
        }

        updateStreakBar(data);
    } catch (err) {
        console.error('Error in loadStreaks:', err);
        console.error('Error stack:', err.stack);
        hideAllStreaks();
    }
}

// Update the streak bar display with counts
function updateStreakBar(streaks) {
    console.log('Updating streak bar:', streaks);

    // Map media types to their element IDs
    const streakElements = {
        'book_streak_count': 'book-count',
        'manga_streak_count': 'manga-count',
        'anime_streak_count': 'anime-count',
        'tvshow_streak_count': 'tv-count',
        'movie_streak_count': 'movie-count'
    };

    // Update each streak count and hide/show based on value
    Object.entries(streakElements).forEach(([mediaType, elementId]) => {
        const countElement = document.getElementById(elementId);
        const streakItem = countElement?.closest('.streak-item');
        
        if (countElement && streakItem) {
            const count = streaks[mediaType] || 0;
            countElement.textContent = count;
            
            // Hide if count is 0, show if greater than 0
            if (count === 0) {
                streakItem.style.display = 'none';
            } else {
                streakItem.style.display = 'flex';
            }
        }
    });
}

// Hide all streak items
function hideAllStreaks() {
    const streakItems = document.querySelectorAll('.streak-item');
    streakItems.forEach(item => {
        item.style.display = 'none';
    });
}

// Load all media items for autocomplete
async function loadAllMediaItems() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return; // User not authenticated yet
        }

        // Fetch all media from lu_media table
        const { data, error } = await supabase
            .from('lu_media')
            .select('*');

        if (error) {
            console.error('Error loading all media items:', error);
            return;
        }

        // Map database columns to app structure
        allMediaItems = (data || []).map(dbItem => ({
            id: dbItem.id,
            title: dbItem.text || dbItem.title || dbItem.name || '',
            writer: dbItem.writer || '',
            mediaType: dbItem.media_type || dbItem.mediaType || '',
            totalUnits: dbItem.num_units || dbItem.numUnits || 1,
            imageUrl: dbItem.cover_art_url || dbItem.coverArtUrl || null
        }));

        console.log(`Loaded ${allMediaItems.length} media items for autocomplete`);
    } catch (err) {
        console.error('Error in loadAllMediaItems:', err);
    }
}

// Load tracked media from lu_media_status
async function loadTrackedMedia(forceReload = false) {
    if (hasLoadedTrackedMedia && !forceReload) {
        return;
    }

    hasLoadedTrackedMedia = true;

    try {
        // TODO: Move this to a grabbed once global value and cleared on log out
        // Get current user ID
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to view tracked media.');
            return;
        }

        const { data: statusData, error: statusError } = await supabase.rpc('get_media_with_status_and_series', { 
            p_user_id: userId,
            p_status: MediaStatus.IN_PROGRESS
        });

        if (statusError) {
            console.error('Error loading media status:', statusError);
            alert('Error loading tracked media: ' + statusError.message);
            return;
        }

        if (!statusData || statusData.length === 0) {
            console.log('No in-progress media found');
            currentMediaData = [];
            trackedMediaIds.clear();
            renderMediaItems([]);
            return;
        }

        // Get media_ids to fetch from lu_media
        const mediaIds = statusData.map(s => s.id);
        trackedMediaIds = new Set(mediaIds);

        currentMediaData = statusData.map(item => ({
            id: item.id,
            statusId: item.status_id,
            title: item.title || '',
            writer: item.writer || '',
            mediaType: item.media_type || '',
            totalPages: item.total_pages || 1,
            currentPage: item.current_page || 0,
            percentageComplete: item.percentage_complete || 0,
            status: item.status,
            imageUrl: item.image_url || null,
            dateUpdated: item.date_updated,
            series: item.series_id ? {
                id: item.series_id,
                name: item.series_name,
                description: item.series_description,
                currentSeriesUnits: item.series_total_current_units,
                totalSeriesUnits: item.series_total_units
            } : null
        }));

        console.log('Loaded tracked media:', currentMediaData);
        renderMediaItems(currentMediaData);

        // Load streaks after loading media
        await loadStreaks(userId);
        
        // Load all media items for autocomplete if not already loaded
        if (allMediaItems.length === 0) {
            await loadAllMediaItems();
        }
    } catch (err) {
        console.error('Error in loadTrackedMedia:', err);
        alert('Error loading tracked media: ' + (err.message || err));
    }
}

// Render media items
function renderMediaItems(mediaArray) {
    const mediaList = domCache.mediaList || document.getElementById('media-list');
    if (!mediaList) return;

    mediaList.innerHTML = '';

    if (mediaArray.length === 0) {
        mediaList.innerHTML = '<p>No media found.</p>';
        return;
    }

    mediaArray.forEach(media => {
        const container = document.createElement('div');
        container.className = 'media-container';
        container.dataset.mediaId = media.id;

        const progressLabelText = getUnitLabel(media.mediaType);
        const seriesProgressLabelText = getSeriesLabel(media.mediaType);

        const imageUrl = getMediaImageUrl(media);
        const hasImage = imageUrl && imageUrl.trim() !== '';

        // Create image or placeholder
        let imageHtml = '';
        if (hasImage) {
            imageHtml = `<img src="${imageUrl}" alt="${media.title}" class="media-image" onerror="this.parentElement.innerHTML='<div class=\\'media-image-placeholder\\'>${media.title}</div>';">`;
        } else {
            imageHtml = `<div class="media-image-placeholder">${media.title}</div>`;
        }

        container.innerHTML = `
            <div class="media-top-section">
                <div class="media-image-row">
                    ${imageHtml}
                </div>
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
                            ${media.currentPage || 0}/${media.totalPages || 1} ${progressLabelText}
                            ${media.series ? `
                                <span class="series-tooltip">
                                    Series Completed: ${media.series.currentSeriesUnits || 0}/${media.series.totalSeriesUnits || 1}
                                    ${seriesProgressLabelText}
                                </span>
                            ` : ''}
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
                    <button type="button" class="button update-button" onclick="openUpdateModal(${media.id})">Details</button>
                </div>
            </div>
        `;

        mediaList.appendChild(container);
    });
}

// Open update modal
function openUpdateModal(mediaId) {
    const mediaItem = currentMediaData.find(m => m.id === mediaId);
    if (!mediaItem) return;

    currentModalMediaId = mediaId;
    const modal = domCache.updateModal || document.getElementById('update-modal');
    const progressLabel = document.getElementById('current-progress-label');
    const progressValue = document.getElementById('current-progress-value');
    const updateInput = document.getElementById('modal-update-input');
    const updateLabel = document.getElementById('modal-update-label');

    const progressLabelText = getUnitLabel(mediaItem.mediaType);
    progressLabel.textContent = `Current ${progressLabelText}: `;
    progressValue.textContent = `${mediaItem.currentPage || 0} / ${mediaItem.totalPages || 1}`;
    updateLabel.textContent = `New ${progressLabelText}: `;
    updateInput.value = '';  
    updateInput.placeholder = `Enter new ${progressLabelText.toLowerCase()}`;
    updateInput.min = 0;
    updateInput.max = mediaItem.totalPages || 1;

    modal.classList.add('active');
    updateInput.focus();
}

// Close update modal
function closeUpdateModal() {
    const modal = domCache.updateModal || document.getElementById('update-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentModalMediaId = null;
}

// Update media item with new value
async function updateMediaItem(newValue, action = 'save') {
    if (currentModalMediaId === null) return;

    const mediaItem = currentMediaData.find(m => m.id === currentModalMediaId);
    if (!mediaItem || !mediaItem.statusId) {
        alert('Media item not found or not properly tracked.');
        return;
    }

    let updateData = {};
    let journalUnits = 0;
    let shouldFinish = false;

    if (action === 'save') {
        const newPage = parseInt(newValue, 10);
        if (isNaN(newPage) || newPage < 0 || newPage > (mediaItem.totalPages || 1)) {
            alert(`Please enter a valid value between 0 and ${mediaItem.totalPages || 1}.`);
            return;
        }
        
        // Calculate units difference for journal entry
        journalUnits = newPage - (mediaItem.currentPage || 0);
        
        updateData.current_units = newPage;
        updateData.percentage_complete = calculatePercentage(newPage, mediaItem.totalPages || 1);
        
        // Check if units entered equals total units (auto-finish)
        if (newPage === (mediaItem.totalPages || 1)) {
            shouldFinish = true;
            updateData.status = MediaStatus.COMPLETED;
            updateData.date_finished = new Date().toISOString().split('T')[0];
        }
    } else if (action === 'finish') {
        // Calculate units difference for journal entry
        journalUnits = (mediaItem.totalPages || 1) - (mediaItem.currentPage || 0);
        
        updateData.current_units = mediaItem.totalPages || 1;
        updateData.percentage_complete = 100;
        updateData.status = MediaStatus.COMPLETED;
        updateData.date_finished = new Date().toISOString().split('T')[0];
        shouldFinish = true;
    } else if (action === 'dnf') {
        updateData.status = MediaStatus.ABANDONED;
        // Keep current progress, no journal entry for DNF
    }

    try {
        // Get current user ID to ensure we're updating the correct user's record
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to update media progress.');
            return;
        }

        // Update lu_media_status table (filtered by user_id for security)
        const { error } = await supabase
            .from('lu_media_status')
            .update(updateData)
            .eq('id', mediaItem.statusId)
            .eq('user_id', userId); // Ensure user can only update their own records

        if (error) {
            console.error('Error updating media status:', error);
            alert('Error updating progress: ' + error.message);
            return;
        }

        // Add journal entry if units changed (for save or finish actions)
        if ((action === 'save' || action === 'finish') && journalUnits !== 0) {
            // Use already fetched userId instead of calling getCurrentUserId again
            if (!userId) {
                console.error('Cannot create journal entry: user not authenticated');
                return;
            }

            const { error: journalError } = await supabase
                .from('lu_journal_entry')
                .insert([{
                    media_status_id: mediaItem.statusId,
                    units: journalUnits,
                    user_id: userId
                }]);

            if (journalError) {
                console.error('Error creating journal entry:', journalError);
                // Don't alert here - the update was successful, this is just logging progress
                console.warn('Journal entry creation failed, but media status was updated');
            }
            else {
                await supabase.rpc('update_user_streak_for_media_type', {
                    p_user_id: userId,
                    p_media_type: mediaItem.mediaType
                    });

                hasLoadedTrackedMedia = false;
            }
        }

        // If status changed to completed or abandoned, reload to remove from in-progress list
        // Otherwise, just refresh the display
        await loadTrackedMedia(true); // Force reload to get updated data

        closeUpdateModal();
    } catch (err) {
        console.error('Error in updateMediaItem:', err);
        alert('Error updating progress: ' + (err.message || err));
    }
}

// Open confirmation modal
async function openConfirmationModal(action) {
    const modal = document.getElementById('confirmation-modal');
    if (!modal) return;

    const confirmationLabel = document.getElementById('modal-confirmation-label');
    let customLabelAction = action === 'finish' ? 'Finished' : 'DNF';
    confirmationLabel.textContent = `Are you sure you want to mark this media as ${customLabelAction}?`;

    modal.dataset.action = action; 

    modal.classList.add('active');
}

// Close search modal
function closeConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Open search results modal
async function openSearchModal() {
    const searchInput = domCache.searchInput || document.getElementById('search-input');
    if (!searchInput) return;

    // Hide autocomplete dropdown when opening search modal
    const dropdown = domCache.autocompleteDropdown || document.getElementById('autocomplete-dropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }

    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
        alert('Please enter a search term.');
        return;
    }

    try {
        // Get current user ID first
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to search media.');
            return;
        }

        // Ensure allMediaItems is loaded
        if (allMediaItems.length === 0) {
            await loadAllMediaItems();
        }

        if (allMediaItems.length === 0) {
            alert('No media items available. Please try again later.');
            return;
        }

        // Filter results using the global allMediaItems array
        // Pre-compute lowercase search term once
        const searchLower = searchTerm.toLowerCase().trim();
        
        const filteredData = allMediaItems.filter(item => {
            // Use includes() directly on lowercase strings for better performance
            const title = item.title || '';
            const writer = item.writer || '';
            const mediaType = item.mediaType || '';
            
            return title.toLowerCase().includes(searchLower) ||
                   writer.toLowerCase().includes(searchLower) ||
                   mediaType.toLowerCase().includes(searchLower);
        });

        if (filteredData.length === 0) {
            displaySearchResults([], searchTerm);
            return;
        }

        // Get completed status records for the current user
        const mediaIds = filteredData.map(item => item.id);
        const { data: completedStatusData, error: completedError } = await supabase
            .from('lu_media_status')
            .select('media_id')
            .eq('user_id', userId)
            .eq('status', MediaStatus.COMPLETED)
            .in('media_id', mediaIds);

        if (completedError) {
            console.error('Error fetching completed status:', completedError);
            // Continue without completed status info rather than failing
        }

        // Create a Set of completed media IDs for fast lookup
        const completedMediaIds = new Set(
            (completedStatusData || []).map(item => item.media_id)
        );

        // Map to search results structure (already in correct format from allMediaItems)
        const searchResults = filteredData.map(item => ({
            id: item.id,
            title: item.title,
            writer: item.writer,
            mediaType: item.mediaType,
            totalUnits: item.totalUnits,
            imageUrl: item.imageUrl,
            format: null, // Not stored in allMediaItems, but not critical
            previouslyCompleted: completedMediaIds.has(item.id)
        }));

        // Sort results by title ascending (case-insensitive, with numeric sorting)
        searchResults.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Store search results for tracking
        currentSearchResults = searchResults;
        
        // Update trackedMediaIds set for search results
        const trackedIds = new Set();
        if (trackedMediaIds.size > 0) {
            searchResults.forEach(item => {
                if (trackedMediaIds.has(item.id)) {
                    trackedIds.add(item.id);
                }
            });
        }

        // Display results in modal
        displaySearchResults(searchResults, searchTerm);
    } catch (err) {
        console.error('Error in search:', err);
        alert('Error searching media: ' + (err.message || err));
    }
}

// Add this helper function to get unit label and display
function getUnitLabel(mediaType) {
    const typeMap = {
        'book':  'pages',
        'manga': 'chapters',
        'tv show': 'episodes',
        'anime': 'episodes',
        'movie': 'minutes'
    };
    const normalizedType = (mediaType || '').toLowerCase().trim();
    return typeMap[normalizedType] || 'units';
}

function getSeriesLabel(mediaType) {
    const typeMap = {
        'book':  'books',
        'manga': 'chapters',
        'tv show': 'episodes',
        'anime': 'episodes',
        'movie': 'movies'
    };
    const normalizedType = (mediaType || '').toLowerCase().trim();
    return typeMap[normalizedType] || 'units';
}

// Display search results in modal
function displaySearchResults(results, searchTerm) {
    const modal = document.getElementById('search-modal');
    const resultsList = document.getElementById('search-results-list');
    if (!modal || !resultsList) return;

    resultsList.innerHTML = '';

    if (results.length === 0) {
        resultsList.innerHTML = `
            <div class="no-results">
                <p>No results found for "${searchTerm}"</p>
            </div>
        `;
    } else {
        results.forEach(media => {
            const isTracked = trackedMediaIds.has(media.id);
            const canQuickComplete = media.previouslyCompleted || isTracked;
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            const unitLabel = getUnitLabel(media.mediaType);
            const capitalizedLabel = unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1);

            const imageUrl = getMediaImageUrl(media);
            const hasImage = imageUrl && imageUrl.trim() !== '';

            // Create image or placeholder
            let imageHtml = '';
            if (hasImage) {
                imageHtml = `<img src="${imageUrl}" alt="${media.title}" class="media-image" onerror="this.parentElement.innerHTML='<div class=\\'media-image-placeholder\\'>${media.title}</div>';">`;
            } else {
                imageHtml = `<div class="media-image-placeholder">${media.title}</div>`;
            }
                
            resultItem.innerHTML = `
                <div class="media-top-section">
                    <div class="media-image-row">
                        ${imageHtml}
                    </div>
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
                    <div class="media-info-row">
                        ${isTracked ? `<span class="search-tracked-icon" title="Already Tracked - This media is being tracked">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </span>` : ''}
                        ${!isTracked ? `<button type="button" 
                                class="button search-track-btn" 
                                onclick="trackMedia(${media.id})"
                                title="Track - Start tracking this media">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>` : ''}
                    </div>
                    <div class="media-info-row">
                        ${!canQuickComplete ? `<button type="button" 
                                class="button search-mark-done-btn"
                                onclick="quickComplete(${media.id})"
                                title="Mark Done - Quick complete without tracking progress">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                <line x1="4" y1="22" x2="4" y2="15"/>
                            </svg>
                        </button>` : ''}
                    </div>
                </div>
            `;

            resultsList.appendChild(resultItem);
        });
    }

    modal.classList.add('active');
}

// Close search modal
function closeSearchModal() {
    const modal = domCache.searchModal || document.getElementById('search-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Filter media items for autocomplete
function filterMediaForAutocomplete(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        return [];
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const maxResults = 10; // Limit to 10 suggestions

    const filtered = allMediaItems
        .filter(item => {
            // Optimize: only call toLowerCase() when needed, not on every field
            const title = item.title || '';
            const writer = item.writer || '';
            const mediaType = item.mediaType || '';
            
            return title.toLowerCase().includes(searchLower) ||
                   writer.toLowerCase().includes(searchLower) ||
                   mediaType.toLowerCase().includes(searchLower);
        });

    // Sort results by title ascending (case-insensitive, with numeric sorting)
    filtered.sort((a, b) => {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return filtered.slice(0, maxResults);
}

// Display autocomplete suggestions
function displayAutocompleteSuggestions(suggestions) {
    const dropdown = domCache.autocompleteDropdown || document.getElementById('autocomplete-dropdown');
    if (!dropdown) return;

    if (suggestions.length === 0) {
        dropdown.classList.remove('active');
        return;
    }

    dropdown.innerHTML = '';
    
    suggestions.forEach(item => {
        const isTracked = trackedMediaIds.has(item.id);
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'autocomplete-item';
        suggestionItem.dataset.mediaId = item.id;
        
        suggestionItem.innerHTML = `
            <div class="autocomplete-item-content">
                <div class="autocomplete-item-title">${item.title}</div>
                <div class="autocomplete-item-details">
                    ${item.writer ? `<strong>Writer:</strong> ${item.writer} • ` : ''}
                    <strong>Type:</strong> ${item.mediaType}
                </div>
            </div>
            <div class="autocomplete-item-track">
                ${isTracked ? `<span class="autocomplete-tracked-icon" title="Already Tracked - This media is being tracked">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </span>` : ''}
                ${!isTracked ? `<button type="button" 
                        class="button autocomplete-track-btn" 
                        data-media-id="${item.id}"
                        title="Track - Start tracking this media">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>` : ''}
            </div>
        `;

        // Handle click on track button
        const trackButton = suggestionItem.querySelector('.autocomplete-track-btn');
        if (trackButton) {
            trackButton.addEventListener('click', (e) => {
                e.stopPropagation();
                trackMedia(item.id);
            });
        }

        // Handle click on suggestion (but not on the track button)
        suggestionItem.addEventListener('click', (e) => {
            // Don't open modal if clicking on the track button
            if (e.target.closest('.autocomplete-track-btn')) {
                return;
            }
            const searchInput = domCache.searchInput || document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = item.title;
                dropdown.classList.remove('active');
                // Trigger search
                openSearchModal();
            }
        });

        dropdown.appendChild(suggestionItem);
    });

    // Reset scroll to top when dropdown becomes active
    dropdown.scrollTop = 0;
    dropdown.classList.add('active');
}

// Debounce function for autocomplete
let autocompleteDebounceTimer = null;
const AUTOCOMPLETE_DEBOUNCE_MS = 150; // Delay before showing autocomplete

// Handle autocomplete input with debouncing
function handleAutocompleteInput() {
    const searchInput = domCache.searchInput || document.getElementById('search-input');
    if (!searchInput) return;

    // Clear existing timer
    if (autocompleteDebounceTimer) {
        clearTimeout(autocompleteDebounceTimer);
    }

    // Set new timer
    autocompleteDebounceTimer = setTimeout(() => {
        const searchTerm = searchInput.value.trim();
        
        if (searchTerm.length === 0) {
            const dropdown = domCache.autocompleteDropdown || document.getElementById('autocomplete-dropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
            return;
        }

        const suggestions = filterMediaForAutocomplete(searchTerm);
        displayAutocompleteSuggestions(suggestions);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
}


// Track a media item (insert/update lu_media_status)
async function trackMedia(mediaId) {
    // Find the media item in current search results or allMediaItems
    let mediaItem = currentSearchResults.find(m => m.id === mediaId);
    if (!mediaItem) {
        mediaItem = allMediaItems.find(m => m.id === mediaId);
    }
    if (!mediaItem) {
        alert('Media item not found. Please search again.');
        return;
    }

    // Check if already tracked as "in progress"
    if (trackedMediaIds.has(mediaId)) {
        alert('This media is already being tracked as in progress.');
        return;
    }

    try {
        // Get current user ID
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to track media.');
            return;
        }

        // Check if an in progress status record exists for this media_id and user
        const { data: existingStatus, error: checkError } = await supabase
            .from('lu_media_status')
            .select('*')
            .eq('media_id', mediaId)
            .eq('user_id', userId)
            .eq('status', 'in progress')
            .single();

        const statusData = {
            media_id: mediaId,
            user_id: userId,
            status: MediaStatus.IN_PROGRESS,
            current_units: 0,
            percentage_complete: 0,
            date_started: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
        };

        let result;
        if (existingStatus && !checkError) {
            // Update existing record
            const { data, error } = await supabase
                .from('lu_media_status')
                .update(statusData)
                .eq('id', existingStatus.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating media status:', error);
                alert('Error updating media status: ' + error.message);
                return;
            }
            result = data;
        } else {
            // Insert new record
            const { data, error } = await supabase
                .from('lu_media_status')
                .insert([statusData])
                .select()
                .single();

            if (error) {
                console.error('Error inserting media status:', error);
                alert('Error tracking media: ' + error.message);
                return;
            }
            result = data;
        }

        // Add to tracked set
        trackedMediaIds.add(mediaId);
        hasLoadedTrackedMedia = false;
        // Reload tracked media to refresh the display
        await loadTrackedMedia();

        // Update search results or autocomplete dropdown to show it's now tracked
        const searchInput = domCache.searchInput || document.getElementById('search-input');
        const dropdown = domCache.autocompleteDropdown || document.getElementById('autocomplete-dropdown');
        
        if (searchInput && searchInput.value.trim() !== '') {
            // Check if autocomplete dropdown is open
            if (dropdown && dropdown.classList.contains('active')) {
                // Refresh autocomplete dropdown
                const suggestions = filterMediaForAutocomplete(searchInput.value.trim());
                displayAutocompleteSuggestions(suggestions);
            } else {
                // Refresh search results modal
                openSearchModal();
            }
        } else {
            closeSearchModal();
        }
    } catch (err) {
        console.error('Error in trackMedia:', err);
        alert('Error tracking media: ' + (err.message || err));
    }
}

// Add lu_media_status entry without adding journal entries
async function quickComplete(mediaId) {
    // Find the media item in current search results
    const mediaItem = currentSearchResults.find(m => m.id === mediaId);
    if (!mediaItem) {
        alert('Media item not found. Please search again.');
        return;
    }

    try {
        // Get current user ID
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to track media.');
            return;
        }

        const statusData = {
            media_id: mediaId,
            user_id: userId,
            status: MediaStatus.COMPLETED,
            current_units: mediaItem.totalUnits,
            percentage_complete: 100,
            date_started: '2000-01-01' // default date in the past
        };

        // Insert new record
        const { data, error } = await supabase
            .from('lu_media_status')
            .insert([statusData])
            .select()
            .single();

        if (error) {
            console.error('Error inserting media status:', error);
            alert('Error tracking media: ' + error.message);
            return;
        }
        
        // Update search results to show it's now tracked
        const searchInput = domCache.searchInput || document.getElementById('search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            openSearchModal(); // Refresh search results
        } else {
            closeSearchModal();
        }
    } catch (err) {
        console.error('Error in quickComplete:', err);
        alert('Error during quick complete: ' + (err.message || err));
    }
}

// Initialize the page
function initMediaTracker() {
    // Add Media button
    const addMediaBtn = document.getElementById('add-media-btn');
    if (addMediaBtn) {
        addMediaBtn.addEventListener('click', () => {
            alert('Add Media functionality will be implemented in a future version.');
        });
    }

    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', openSearchModal);
    }

    // Initialize DOM cache
    initDOMCache();

    // Search on Enter key and autocomplete
    const searchInput = domCache.searchInput;
    if (searchInput) {
        // Handle Enter key to open search modal
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const dropdown = domCache.autocompleteDropdown;
                if (dropdown) {
                    dropdown.classList.remove('active');
                }
                openSearchModal();
            }
        });

        // Handle input for autocomplete (with debouncing)
        searchInput.addEventListener('input', handleAutocompleteInput);

        // Handle Escape key to close autocomplete
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dropdown = domCache.autocompleteDropdown;
                if (dropdown) {
                    dropdown.classList.remove('active');
                }
            }
        });

        // Handle focus to show autocomplete if there's text
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0) {
                handleAutocompleteInput();
            }
        });
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = domCache.autocompleteDropdown;
        const searchWrapper = document.querySelector('.search-input-wrapper');
        
        if (dropdown && searchWrapper && !searchWrapper.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Modal buttons
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalFinishBtn = document.getElementById('modal-finish-btn');
    const modalDnfBtn = document.getElementById('modal-dnf-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalUpdateInput = document.getElementById('modal-update-input');
    const modalConfirmationNo = document.getElementById('modal-confirm-no');
    const modalConfirmationYes = document.getElementById('modal-confirm-yes');

    if (modalConfirmationNo) {
        modalConfirmationNo.addEventListener('click', () => {
            closeConfirmationModal();
        })
    }

    if (modalConfirmationYes) {
        modalConfirmationYes.addEventListener("click", () => {
            const modal = document.getElementById("confirmation-modal");
            const action = modal.dataset.action; 
            updateMediaItem(null, action);
            closeConfirmationModal();
        });
    }

    if (modalSaveBtn) {
        modalSaveBtn.addEventListener('click', () => {
            const value = modalUpdateInput.value;
            if (!value || value.trim() === '') {
                alert('Please enter a value.');
                return;
            }
            updateMediaItem(value, 'save');
        });
    }

    if (modalFinishBtn) {
        modalFinishBtn.addEventListener('click', () => {
            openConfirmationModal('finish');
        });
    }

    if (modalDnfBtn) {
        modalDnfBtn.addEventListener('click', () => {
            openConfirmationModal('dnf');
        });
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => {
            closeUpdateModal();
        });
    }

    // Close modal on overlay click
    const modal = domCache.updateModal || document.getElementById('update-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeUpdateModal();
            }
        });
    }

    // Allow Enter key in modal input to save
    if (modalUpdateInput) {
        modalUpdateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                modalSaveBtn.click();
            }
        });
    }

    // Search modal close button
    const searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    if (searchModalCloseBtn) {
        searchModalCloseBtn.addEventListener('click', closeSearchModal);
    }

    // Close search modal on overlay click
    const searchModal = domCache.searchModal || document.getElementById('search-modal');
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeSearchModal();
            }
        });
    }

    // Don't load tracked media here - wait for auth.js to call it after authentication
    // This prevents loading data before user is authenticated
}

// Make functions available globally for onclick handlers
window.openUpdateModal = openUpdateModal;
window.trackMedia = trackMedia;
window.quickComplete = quickComplete;
window.loadStreaks = loadStreaks;
window.loadTrackedMedia = loadTrackedMedia; // Export for auth.js to call

// Initialize when DOM is ready, but only if app-container is visible (user is authenticated)
// Otherwise, wait for auth.js to call loadTrackedMedia after authentication
function checkAndInit() {
    const appContainer = document.getElementById('app-container');
    if (appContainer && appContainer.style.display !== 'none') {
        // User is authenticated, initialize
        initMediaTracker();
    } else {
        // Not authenticated yet, just set up the init function but don't load data
        // Auth.js will call loadTrackedMedia after login
        initMediaTracker();
        // Don't call loadTrackedMedia here - wait for auth
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
} else {
    checkAndInit();
}