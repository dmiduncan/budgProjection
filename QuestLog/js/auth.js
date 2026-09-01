// js/auth.js
// Authentication only — sign in, sign up, sign out, session restore.
// Does NOT touch the toolbar, navigation, or any task data.
// Communicates to the rest of the app via custom window events:
//   - 'userSignedIn'  { detail: { user: { id, email } } }
//   - 'userSignedOut'

import { supabase } from '../../shared/js/supabase-client.js';
import { setState, clearUserState } from './app-state.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────

const authContainer = document.getElementById('auth-container');
const appContainer  = document.getElementById('app-container');
const emailInput    = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const loginBtn      = document.getElementById('auth-login-btn');
const signupBtn     = document.getElementById('auth-signup-btn');
const authMessage   = document.getElementById('auth-message');

// ── Helpers ───────────────────────────────────────────────────────────────────

function showAuthForm() {
    if (authContainer) authContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function hideAuthForm() {
    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
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
        setMessage(`Error: ${error.message}`);
        loginBtn.disabled  = false;
        signupBtn.disabled = false;
        return;
    }

    setMessage('');
});

signupBtn?.addEventListener('click', async () => {
    const email    = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
        setMessage('Please enter an email and password.');
        return;
    }

    if (password.length < 6) {
        setMessage('Password must be at least 6 characters.');
        return;
    }

    loginBtn.disabled  = true;
    signupBtn.disabled = true;
    setMessage('Creating account…');

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        setMessage(`Error: ${error.message}`);
        loginBtn.disabled  = false;
        signupBtn.disabled = false;
        return;
    }

    setMessage('Account created! You can now log in.');
    emailInput.value = '';
    passwordInput.value = '';
    loginBtn.disabled  = false;
    signupBtn.disabled = false;
});

// ── Session management ────────────────────────────────────────────────────────

export async function signOut() {
    await supabase.auth.signOut();
}

async function handleSessionChange(session) {
    if (session?.user) {
        const user = {
            id: session.user.id,
            email: session.user.email
        };

        setState({ user });
        hideAuthForm();

        window.dispatchEvent(new CustomEvent('userSignedIn', { detail: { user } }));
    } else {
        clearUserState();
        showAuthForm();

        window.dispatchEvent(new CustomEvent('userSignedOut'));
    }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    handleSessionChange(session);
});

// Restore session on page load
(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        handleSessionChange(data.session);
    } else {
        showAuthForm();
    }
})();
