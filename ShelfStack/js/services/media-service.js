// js/services/media-service.js
// All Supabase calls related to media data.
// Every function returns { data, error } — never touches the DOM or calls alert().

import { supabase } from '../supabase-client.js';

const MediaStatus = {
    IN_PROGRESS: 'in progress',
    COMPLETED:   'completed',
    ABANDONED:   'abandoned'
};

export { MediaStatus };

/**
 * Fetch all in-progress media for the current user via RPC.
 */
export async function fetchTrackedMedia(userId) {
    const { data, error } = await supabase.rpc('get_media_with_status_and_series', {
        p_user_id: userId,
        p_status:  MediaStatus.IN_PROGRESS
    });
    return { data, error };
}

/**
 * Fetch all media catalog items plus the user's completed media IDs.
 * Returns { data: { allItems, completedIds }, error }.
 */
export async function fetchAllMediaItems(userId) {
    const [mediaResult, completedResult] = await Promise.all([
        supabase.from('lu_media').select('*'),
        supabase
            .from('lu_media_status')
            .select('media_id')
            .eq('user_id', userId)
            .eq('status', MediaStatus.COMPLETED)
    ]);

    if (mediaResult.error) {
        return { data: null, error: mediaResult.error };
    }

    const completedIds = new Set(
        (completedResult.data || []).map(item => item.media_id)
    );

    const allItems = (mediaResult.data || []).map(dbItem => ({
        id:                  dbItem.id,
        title:               dbItem.text || dbItem.title || dbItem.name || '',
        writer:              dbItem.writer || '',
        mediaType:           dbItem.media_type || dbItem.mediaType || '',
        totalUnits:          dbItem.num_units || dbItem.numUnits || 1,
        imageUrl:            dbItem.cover_art_url || dbItem.coverArtUrl || null,
        previouslyCompleted: completedIds.has(dbItem.id)
    }));

    return { data: { allItems, completedIds }, error: null };
}

/**
 * Update a row in lu_media_status.
 */
export async function updateMediaStatus(statusId, userId, updateData) {
    const { data, error } = await supabase
        .from('lu_media_status')
        .update(updateData)
        .eq('id', statusId)
        .eq('user_id', userId);
    return { data, error };
}

/**
 * Insert a journal entry for progress tracking.
 */
export async function insertJournalEntry(mediaStatusId, userId, units) {
    const { data, error } = await supabase
        .from('lu_journal_entry')
        .insert([{ media_status_id: mediaStatusId, units, user_id: userId }]);
    return { data, error };
}

/**
 * Start tracking a media item (insert or update lu_media_status as in-progress).
 */
export async function trackMedia(mediaId, userId) {
    // Check for an existing in-progress record first
    const { data: existing, error: checkError } = await supabase
        .from('lu_media_status')
        .select('*')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .eq('status', MediaStatus.IN_PROGRESS)
        .maybeSingle();

    const statusData = {
        media_id:            mediaId,
        user_id:             userId,
        status:              MediaStatus.IN_PROGRESS,
        current_units:       0,
        percentage_complete: 0,
        date_started:        new Date().toISOString().split('T')[0]
    };

    if (existing && !checkError) {
        const { data, error } = await supabase
            .from('lu_media_status')
            .update(statusData)
            .eq('id', existing.id)
            .select()
            .single();
        return { data, error };
    } else {
        const { data, error } = await supabase
            .from('lu_media_status')
            .insert([statusData])
            .select()
            .single();
        return { data, error };
    }
}

/**
 * Quick-complete a media item without tracking progress history.
 */
export async function quickCompleteMedia(mediaId, userId, totalUnits) {
    const { data, error } = await supabase
        .from('lu_media_status')
        .insert([{
            media_id:            mediaId,
            user_id:             userId,
            status:              MediaStatus.COMPLETED,
            current_units:       totalUnits,
            percentage_complete: 100,
            date_started:        '2000-01-01'
        }])
        .select()
        .single();
    return { data, error };
}
