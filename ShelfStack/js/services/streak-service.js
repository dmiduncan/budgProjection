// js/services/streak-service.js
// Streak data fetching and DOM updates.

import { supabase } from '../../../shared/js/supabase-client.js';

/**
 * Fetch streak data for the current user.
 */
export async function fetchStreaks(userId) {
    const { data, error } = await supabase.rpc('get_or_fix_user_streak', {
        p_user_id: userId
    });
    return { data, error };
}

/**
 * Trigger a streak update after a journal entry is recorded.
 */
export async function updateStreakForMediaType(userId, mediaType) {
    const normalisedMediaType = mediaType.toLowerCase() === 'tv show' ? 'tvshow' : mediaType.toLowerCase();
    const { data, error } = await supabase.rpc('update_user_streak_for_media_type', {
        p_user_id:   userId,
        p_media_type: normalisedMediaType
    });
    return { data, error };
}

/**
 * Update the streak bar DOM elements from streak data.
 * Hides items with a count of 0, shows items with count > 0.
 */
export function renderStreakBar(streaks) {
    if (!streaks) {
        hideAllStreaks();
        return;
    }

    const streakElements = {
        book_streak_count:   'book-count',
        manga_streak_count:  'manga-count',
        anime_streak_count:  'anime-count',
        tvshow_streak_count: 'tv-count',
        movie_streak_count:  'movie-count',
        concert_streak_count: 'concert-count'
    };

    Object.entries(streakElements).forEach(([key, elementId]) => {
        const countEl   = document.getElementById(elementId);
        const streakItem = countEl?.closest('.streak-item');
        if (!countEl || !streakItem) return;

        const count = streaks[key] || 0;
        countEl.textContent = count;
        streakItem.style.display = count > 0 ? 'flex' : 'none';
    });
}

export function hideAllStreaks() {
    document.querySelectorAll('.streak-item').forEach(item => {
        item.style.display = 'none';
    });
}
