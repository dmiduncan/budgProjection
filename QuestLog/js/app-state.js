// js/app-state.js
// Central state store — single source of truth for all app data.
// Rules:
//   - UI files read via getState()
//   - Only service files and auth call setState()
//   - Never mutate state directly

const state = {
    user: null,                   // { id, email } or null
    parentTasks: [],              // parent tasks for current user
    selectedTaskId: null,         // currently expanded/selected parent task
    loading: false
};

const listeners = new Set();

/**
 * Returns a shallow copy of the current state.
 * Note: Arrays and objects inside are references — treat them as read-only.
 */
export function getState() {
    return { ...state };
}

/**
 * Merges partial state and notifies all subscribers.
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
 */
export function clearUserState() {
    Object.assign(state, {
        user: null,
        parentTasks: [],
        selectedTaskId: null,
        loading: false
    });
    const snapshot = { ...state };
    listeners.forEach(fn => fn(snapshot));
}
