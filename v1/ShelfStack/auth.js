// auth.js for ShelfStack
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm'

// ShelfStack Supabase project credentials
const supabaseUrl = 'https://fscgyzqjjdwfzauzttek.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzY2d5enFqamR3ZnphdXp0dGVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NDE0NjYsImV4cCI6MjA4MzMxNzQ2Nn0.lKwSixf1KK6RWSZvZvHb-BSpQx2pZirkUKIBGpGsf6s';

export const supabase = createClient(supabaseUrl, supabaseKey)

// UI Elements
const authContainer = document.createElement('div')
authContainer.innerHTML = `\
  <div id="auth-message"></div>
  <div id="divEmail">
  <input type="email" id="email" placeholder="Email" style="width: 300px;" required>
  </div>
  <div id="divPassword">
  <input type="password" id="password" placeholder="Password" style="width: 300px;" required>
  </div>
  <button id="login-btn">Login</button>
  <button id="signup-btn">Sign Up</button>
  <button id="logout-btn" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
  </button>
  <button type="button" id="home-btn" onclick="window.location.href='../'">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
          <path d="M9 21V12h6v9"/>
      </svg>
  </button>
  <br><br>
`
document.body.prepend(authContainer)

const loginBtn = document.getElementById('login-btn')
const signupBtn = document.getElementById('signup-btn')
const logoutBtn = document.getElementById('logout-btn')
const authMessage = document.getElementById('auth-message')

// Login
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    authMessage.textContent = error.message
  }
})

// Sign up
signupBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    authMessage.textContent = error.message
  } else {
    authMessage.textContent = "Check your email for confirmation!"
  }
})

// Logout
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
})

// Auth state change
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    // Hide login form, show logout
    loginBtn.style.display = 'none'
    signupBtn.style.display = 'none'
    logoutBtn.style.display = 'inline-block'
    document.getElementById('divEmail').style.display = 'none'
    document.getElementById('divPassword').style.display = 'none'

    // Show the main app
    document.getElementById('app-container').style.display = 'block'
    
    // Initialize media tracker after authentication
    // Wait a bit for the script to load, then call loadTrackedMedia
    setTimeout(() => {
      if (window.loadTrackedMedia) {
        window.loadTrackedMedia();
      } else {
        // If not available yet, try importing
        import('./media-tracker.js').then(() => {
          if (window.loadTrackedMedia) {
            window.loadTrackedMedia();
          }
        }).catch(err => console.error('Error loading media tracker:', err));
      }
    }, 100);
  } else {
    // Show login form, hide logout
    loginBtn.style.display = 'inline-block'
    signupBtn.style.display = 'inline-block'
    logoutBtn.style.display = 'none'
    document.getElementById('divEmail').style.display = ''
    document.getElementById('divPassword').style.display = ''
    authMessage.textContent = ''

    // Hide the main app
    document.getElementById('app-container').style.display = 'none'
  }
})
