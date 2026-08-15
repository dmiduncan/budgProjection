// js/auth.js
// Authentication only — sign in, sign up, sign out, session restore.
// Does NOT touch the toolbar, navigation, or any media data.
// Communicates to the rest of the app via custom window events:
//   - 'userSignedIn'  { detail: { user: { id, email } } }
//   - 'userSignedOut'

import { supabase } from '../../shared/js/supabase-client.js';
import { setState, clearUserState } from './app-state.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────

const authContainer = document.getElementById('auth-container');
const emailInput    = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const loginBtn      = document.getElementById('auth-login-btn');
const signupBtn     = document.getElementById('auth-signup-btn');
const authMessage   = document.getElementById('auth-message');

// ── Helpers ───────────────────────────────────────────────────────────────────

function showAuthForm() {
    if (authContainer) authContainer.style.display = 'flex';
}

function hideAuthForm() {
    if (authContainer) authContainer.style.display = 'none';
    if (authMessage)   authMessage.textContent = '';
}

function setMessage(text) {
    if (authMessage) authMessage.textContent = text;
}

// ── Event handlers ────────────────────────────────────────────────────────────

loginBtn?.addEventListener('click', async () => {
    const email    = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
        setMessage('Please enter your email and password.');
        return;
    }

    loginBtn.disabled  = true;
    signupBtn.disabled = true;
    setMessage('Signing in…');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        setMessage(error.message);
        loginBtn.disabled  = false;
        signupBtn.disabled = false;
    }
    // On success, onAuthStateChange fires and handles the rest
});

signupBtn?.addEventListener('click', async () => {
    const email    = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
        setMessage('Please enter your email and password.');
        return;
    }

    loginBtn.disabled  = true;
    signupBtn.disabled = true;
    setMessage('Creating account…');

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        setMessage(error.message);
        loginBtn.disabled  = false;
        signupBtn.disabled = false;
    } else {
        setMessage('Check your email for a confirmation link.');
        loginBtn.disabled  = false;
        signupBtn.disabled = false;
    }
});

// ── Auth state listener ───────────────────────────────────────────────────────

supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
        const user = { id: session.user.id, email: session.user.email };

        setState({ user });
        hideAuthForm();

        window.dispatchEvent(new CustomEvent('userSignedIn', { detail: { user } }));
    } else {
        clearUserState();
        showAuthForm();

        window.dispatchEvent(new CustomEvent('userSignedOut'));
    }
});

// ── Session restore on page load ──────────────────────────────────────────────
// Supabase persists the token in localStorage — getSession() restores it
// synchronously from cache, so no flicker on reload.

(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // No active session — show the auth form
        showAuthForm();
    }
    // If session exists, onAuthStateChange will have already fired
})();

// ── Logout (called by toolbar) ────────────────────────────────────────────────

export async function signOut() {
    await supabase.auth.signOut();
    // onAuthStateChange handles clearUserState and the userSignedOut event
}
