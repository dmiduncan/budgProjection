// media-tracker.js
// Import Supabase from auth.js (which has the ShelfStack credentials)
import { supabase } from './auth.js';

// Helper function to get current user ID
async function getCurrentUserId() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        console.error('Error getting user:', error);
        return null;
    }
    return user.id;
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

// Get OpenLibrary cover URL for books
function getOpenLibraryCoverUrl(isbn, size = 'M') {
    if (!isbn) return null;
    // Remove any dashes or spaces from ISBN
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-${size}.jpg`;
}

// Get image URL for media item
function getMediaImageUrl(media) {
    // Prioritize cover_art_url from database if it exists
    if (media.imageUrl || media.cover_art_url) {
        return media.imageUrl || media.cover_art_url;
    }
    // For books, try OpenLibrary if ISBN is available
    if (media.mediaType === "Book" && media.isbn) {
        return getOpenLibraryCoverUrl(media.isbn, 'M');
    }
    // Return null to trigger blank image
    return null;
}

let currentMediaData = []; // Will be loaded from lu_media_status
let currentModalMediaId = null;
let currentSearchResults = []; // Store current search results for tracking
let trackedMediaIds = new Set(); // Track which media_ids are already tracked as "in progress"

// Load tracked media from lu_media_status
async function loadTrackedMedia() {
    try {
        // Get current user ID
        const userId = await getCurrentUserId();
        if (!userId) {
            alert('You must be logged in to view tracked media.');
            return;
        }

        // Get all media_status records with status = "in progress" for current user
        const { data: statusData, error: statusError } = await supabase
            .from('lu_media_status')
            .select('*')
            .eq('status', MediaStatus.IN_PROGRESS)
            .eq('user_id', userId)
            .order('date_updated', { ascending: false });

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
        const mediaIds = statusData.map(s => s.media_id);
        trackedMediaIds = new Set(mediaIds);

        // Fetch media details from lu_media
        const { data: mediaData, error: mediaError } = await supabase
            .from('lu_media')
            .select('*')
            .in('id', mediaIds);

        if (mediaError) {
            console.error('Error loading media details:', mediaError);
            alert('Error loading media details: ' + mediaError.message);
            return;
        }

        // Combine status data with media data
        currentMediaData = statusData.map(statusItem => {
            const mediaItem = mediaData.find(m => m.id === statusItem.media_id);
            if (!mediaItem) {
                console.warn('Media not found for status item:', statusItem);
                return null;
            }

            // Map to our app structure
            return {
                id: mediaItem.id,
                statusId: statusItem.id, // Store the status record ID for updates
                title: mediaItem.text || mediaItem.title || mediaItem.name || '',
                writer: mediaItem.writer || '',
                mediaType: mediaItem.media_type || mediaItem.mediaType || '',
                totalPages: mediaItem.num_units || mediaItem.numUnits || 1,
                currentPage: statusItem.current_units || 0,
                percentageComplete: statusItem.percentage_complete || calculatePercentage(statusItem.current_units || 0, mediaItem.num_units || 1),
                status: MediaStatus.IN_PROGRESS,
                imageUrl: mediaItem.cover_art_url || mediaItem.coverArtUrl || null,
                format: mediaItem.format || null,
                rating: statusItem.rating || null,
                dateStarted: statusItem.date_started || null,
                dateFinished: statusItem.date_finished || null
            };
        }).filter(item => item !== null); // Remove any null entries

        console.log('Loaded tracked media:', currentMediaData);
        renderMediaItems(currentMediaData);
    } catch (err) {
        console.error('Error in loadTrackedMedia:', err);
        alert('Error loading tracked media: ' + (err.message || err));
    }
}

// Get progress label based on media type
function getProgressLabel(mediaType) {
    if (mediaType === "Book") {
        return "Page";
    } else if (mediaType === "TV Show") {
        return "Episode";
    } else {
        return "Progress";
    }
}


// Render media items
function renderMediaItems(mediaArray) {
    const mediaList = document.getElementById('media-list');
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

        const progressLabel = getProgressLabel(media.mediaType);
        const currentValue = media.currentPage || 0;
        const totalValue = media.totalPages || 1;
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
                    <div class="media-detail"><strong>Progress:</strong> ${media.percentageComplete}%</div>
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
                    <button type="button" class="button update-button" onclick="openUpdateModal(${media.id})">Update</button>
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
    const modal = document.getElementById('update-modal');
    const progressLabel = document.getElementById('current-progress-label');
    const progressValue = document.getElementById('current-progress-value');
    const updateInput = document.getElementById('modal-update-input');
    const updateLabel = document.getElementById('modal-update-label');

    const progressLabelText = getUnitLabel(mediaItem.mediaType);
    progressLabel.textContent = `Current ${progressLabelText}: `;
    progressValue.textContent = `${mediaItem.currentPage || 0} / ${mediaItem.totalPages || 1}`;
    updateLabel.textContent = `New ${progressLabelText}: `;
    updateInput.value = mediaItem.currentPage || 0;  // Set input value to current units
    updateInput.placeholder = `Enter new ${progressLabelText. toLowerCase()}`;
    updateInput.min = 0;
    updateInput.max = mediaItem.totalPages || 1;

    modal.classList.add('active');
    updateInput.focus();
}

// Close update modal
function closeUpdateModal() {
    const modal = document.getElementById('update-modal');
    modal.classList.remove('active');
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
            alert(`Please enter a valid value between 0 and ${mediaItem.totalPages || 1}. `);
            return;
        }
        
        // Calculate units difference for journal entry
        journalUnits = newPage - (mediaItem.currentPage || 0);
        
        updateData. current_units = newPage;
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
        updateData.status = MediaStatus. COMPLETED;
        updateData.date_finished = new Date().toISOString().split('T')[0];
        shouldFinish = true;
    } else if (action === 'dnf') {
        updateData.status = MediaStatus. ABANDONED;
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
            alert('Error updating progress:  ' + error.message);
            return;
        }

        // Add journal entry if units changed (for save or finish actions)
        if ((action === 'save' || action === 'finish') && journalUnits !== 0) {
            // Get current user ID
            const userId = await getCurrentUserId();
            if (!userId) {
                console.error('Cannot create journal entry: user not authenticated');
                return;
            }

            const { error:  journalError } = await supabase
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
        }

        // If status changed to completed or abandoned, reload to remove from in-progress list
        if (action === 'finish' || action === 'dnf' || shouldFinish) {
            await loadTrackedMedia();
        } else {
            // Just reload to refresh the display
            await loadTrackedMedia();
        }

        closeUpdateModal();
    } catch (err) {
        console.error('Error in updateMediaItem:', err);
        alert('Error updating progress: ' + (err.message || err));
    }
}

// Open search results modal
async function openSearchModal() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
        alert('Please enter a search term.');
        return;
    }

    try {
        // Query Supabase lu_media table
        // Get all records and filter in JavaScript to avoid column name issues
        console.log('Searching for:', searchTerm);
        console.log('Supabase client:', supabase);
        
        // Test the connection first
        const { data: testData, error: testError } = await supabase
            .from('lu_media')
            .select('*')
            .limit(1);

        if (testError) {
            console.error('Database connection error:', testError);
            console.error('Error details:', {
                message: testError.message,
                details: testError.details,
                hint: testError.hint,
                code: testError.code
            });
            alert(`Error connecting to database: ${testError.message}\n\nThis might be due to:\n- Row Level Security (RLS) policies\n- Table permissions\n- Authentication required\n\nCheck the console for more details.`);
            return;
        }

        console.log('Connection test successful. Test data:', testData);
        
        // Now get all records
        const { data, error } = await supabase
            .from('lu_media')
            .select('*');

        if (error) {
            console.error('Error fetching media:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            alert('Error fetching media: ' + error.message);
            return;
        }

        console.log('Total records fetched:', data?.length || 0);
        console.log('Raw data:', data);

        // Debug: Log first record to see actual column names
        if (data && data.length > 0) {
            console.log('Sample record from database:', data[0]);
            console.log('Available columns:', Object.keys(data[0]));
            
            // Log all column values for first record
            Object.keys(data[0]).forEach(key => {
                console.log(`  ${key}:`, data[0][key], `(type: ${typeof data[0][key]})`);
            });
        } else {
            console.warn('No data returned from database');
            displaySearchResults([], searchTerm);
            return;
        }

        // Filter results in JavaScript
        // Case-insensitive search with wildcards on either side (using includes)
        const searchLower = searchTerm.toLowerCase().trim();
        console.log('Search term (lowercase):', searchLower);
        
        const filteredData = (data || []).filter(dbItem => {
            // Try multiple possible column names for title
            const titleField = String(dbItem.text || dbItem.title || dbItem.name || dbItem.media_text || '').toLowerCase();
            const writerField = String(dbItem.writer || dbItem.author || '').toLowerCase();
            const mediaTypeField = String(dbItem.media_type || dbItem.mediaType || dbItem.type || '').toLowerCase();
            
            console.log('Checking item:', {
                id: dbItem.id,
                titleField,
                writerField,
                mediaTypeField,
                searchTerm: searchLower
            });
            
            // Case-insensitive matching (allows wildcards on either side via includes)
            const matches = titleField.includes(searchLower) ||
                          writerField.includes(searchLower) ||
                          mediaTypeField.includes(searchLower);
            
            if (matches) {
                console.log('Match found:', dbItem);
            }
            
            return matches;
        });

        console.log(`Search for "${searchTerm}" returned ${filteredData.length} results from ${data?.length || 0} total records`);

        // Map database columns to app structure
        // Try different possible column names for title/text
        const searchResults = filteredData.map(dbItem => ({
            id: dbItem.id,
            title: dbItem.text || dbItem.title || dbItem.name || '',
            writer: dbItem.writer || '',
            mediaType: dbItem.media_type || dbItem.mediaType || '',
            totalPages: dbItem.num_units || dbItem.numUnits || 1,
            imageUrl: dbItem.cover_art_url || dbItem.coverArtUrl || null,
            format: dbItem.format || null
        }));

        // Sort results by title ascending (case-insensitive)
        searchResults.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Store search results for tracking
        currentSearchResults = searchResults;
        
        // Update trackedMediaIds set for search results
        // Check which of these are already tracked
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

function formatUnitDisplay(mediaType, totalUnits) {
    const label = getUnitLabel(mediaType);
    return `${totalUnits} ${label}`;
}

// Display search results in modal
function displaySearchResults(results, searchTerm) {
    const modal = document. getElementById('search-modal');
    const resultsList = document.getElementById('search-results-list');
    if (!modal || !resultsList) return;

    resultsList.innerHTML = '';

    if (results. length === 0) {
        resultsList.innerHTML = `
            <div class="no-results">
                <p>No results found for "${searchTerm}"</p>
            </div>
        `;
    } else {
        results.forEach(media => {
            const isTracked = trackedMediaIds.has(media. id);
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            const unitLabel = getUnitLabel(media. mediaType);
            const capitalizedLabel = unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1);

            const imageUrl = getMediaImageUrl(media);
            const imgSrc = imageUrl || '';
            
            resultItem.innerHTML = `
                <img src="${imgSrc}" alt="${media.title}" class="media-image" onerror="this.style.display='none';" ${!imgSrc ? 'style="display:none;"' : ''}>
                <div class="search-result-info">
                    <div class="search-result-title">${media.title}</div>
                    <div class="search-result-details">
                        <strong>Writer:</strong> ${media.writer} | 
                        <strong>Type:</strong> ${media.mediaType} | 
                        <strong>${capitalizedLabel}:</strong> ${media.totalPages}
                        ${isTracked ? ' | <span style="color: #9bf1ff;">(Already Tracked)</span>' : ''}
                    </div>
                </div>
                <button type="button" 
                        class="button" 
                        ${isTracked ? 'disabled style="opacity: 0.5;"' : ''}
                        onclick="trackMedia(${media.id})">
                    ${isTracked ? 'Tracked' : 'Track'}
                </button>
            `;

            resultsList.appendChild(resultItem);
        });
    }

    modal.classList.add('active');
}

// Close search modal
function closeSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Track a media item (insert/update lu_media_status)
async function trackMedia(mediaId) {
    // Find the media item in current search results
    const mediaItem = currentSearchResults.find(m => m.id === mediaId);
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

        // Check if a status record exists for this media_id and user
        const { data: existingStatus, error: checkError } = await supabase
            .from('lu_media_status')
            .select('*')
            .eq('media_id', mediaId)
            .eq('user_id', userId)
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

        // Reload tracked media to refresh the display
        await loadTrackedMedia();

        // Update search results to show it's now tracked
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            openSearchModal(); // Refresh search results
        } else {
            closeSearchModal();
        }
    } catch (err) {
        console.error('Error in trackMedia:', err);
        alert('Error tracking media: ' + (err.message || err));
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

    // Search on Enter key
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                openSearchModal();
            }
        });
    }

    // Modal buttons
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalFinishBtn = document.getElementById('modal-finish-btn');
    const modalDnfBtn = document.getElementById('modal-dnf-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalUpdateInput = document.getElementById('modal-update-input');

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
            updateMediaItem(null, 'finish');
        });
    }

    if (modalDnfBtn) {
        modalDnfBtn.addEventListener('click', () => {
            updateMediaItem(null, 'dnf');
        });
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => {
            closeUpdateModal();
        });
    }

    // Close modal on overlay click
    const modal = document.getElementById('update-modal');
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
    const searchModal = document.getElementById('search-modal');
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
