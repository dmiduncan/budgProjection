// js/app-state.js
// Central state store — single source of truth.

const state = {
    user: null,       // { id, email } or null
    transactions: [], // loaded from lu_transaction
    currentBalance: '',
    savingsBalance: 0
};

const listeners = new Set();

export function getState() {
    return { ...state };
}

export function setState(partial) {
    Object.assign(state, partial);
    const snapshot = { ...state };
    listeners.forEach(fn => fn(snapshot));
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function clearUserState() {
    setState({
        user: null,
        transactions: [],
        currentBalance:'',
        savingsBalance: 0
    });
}
