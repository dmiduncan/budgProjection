// js/app-state.js
// Central state store — single source of truth for all app data.
// Rules:
//   - UI files read via getState()
//   - Only service files and auth call setState()
//   - Never mutate state directly

const state = {
    user: null,                   // { id, email } or null
    trackedMedia: [],             // in-progress media items for the current user
    allMediaItems: [],            // full lu_media catalog (loaded once per session)
    completedMediaIds: new Set(), // media_ids the user has previously completed
    trackedMediaIds: new Set(),   // media_ids currently in-progress
    streaks: {}                   // streak counts keyed by media type
};

const listeners = new Set();

/**
 * Returns a shallow copy of the current state.
 * Note: Sets inside are references — treat them as read-only.
 */
export function getState() {
    return { ...state };
}

/**
 * Merges partial state and notifies all subscribers.
 * Pass Sets explicitly when updating completedMediaIds or trackedMediaIds.
 */
export function setState(partial) {
    Object.assign(state, partial);
    const snapshot = { ...state };
    listeners.forEach(fn => fn(snapshot));
}

/**
 * Subscribe to state changes.
 * Returns an unsubscribe function.
 *
 * @param {function} fn - Called with state snapshot on every setState call
 * @returns {function} unsubscribe
 */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Clears all user-specific state on sign-out.
 * Preserves allMediaItems — it's catalog data that doesn't belong to a user.
 */
export function clearUserState() {
    setState({
        user: null,
        trackedMedia: [],
        completedMediaIds: new Set(),
        trackedMediaIds: new Set(),
        streaks: {}
    });
}
