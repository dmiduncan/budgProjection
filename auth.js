// auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm'
// Replace with your own Supabase credentials
const supabaseUrl = 'https://ljisujkxmbijleyhmxab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaXN1amt4bWJpamxleWhteGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMyOTYsImV4cCI6MjA3MDEwOTI5Nn0.9CbNfvI5VlUUQ4bbHd18pGR9ft-tHz2FLKAF_4yQJsg';
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
  <button id="shelf-stack-btn" style="display:none; vertical-align: bottom; " onclick="window.location.href='./ShelfStack'">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 20 18"
     fill="none" stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">

      <rect x="2.5"  y="3" width="3"   height="12" rx="0.3"/> <!-- tall -->
      <rect x="7"    y="8" width="3"   height="7"  rx="0.3"/> <!-- short -->
      <rect x="11.5" y="5" width="3"   height="10" rx="0.3"/> <!-- medium -->

      <g transform="rotate(-15, 18.5, 15)">
        <rect x="16" y="7" width="2.5" height="8" rx="0.3"/>  <!-- leaning -->
      </g>

    </svg>
  </button>
  <br><br>
`
document.body.prepend(authContainer)

const loginBtn = document.getElementById('login-btn')
const signupBtn = document.getElementById('signup-btn')
const logoutBtn = document.getElementById('logout-btn')
const btnNavShelfStack = document.getElementById('shelf-stack-btn')
const authMessage = document.getElementById('auth-message')

// Login
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const { error } = await supabase.auth. signInWithPassword({ email, password })
  if (error) {
    authMessage.textContent = error.message
  }
})

// Sign up
signupBtn.addEventListener('click', async () => {
  const email = document. getElementById('email').value
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
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // Hide login form, show logout and shelf stack
    loginBtn.style.display = 'none'
    signupBtn.style.display = 'none'
    logoutBtn.style.display = 'inline-block'
    btnNavShelfStack.style.display = 'inline-block'
    document.getElementById('divEmail').style.display = 'none'
    document.getElementById('divPassword').style.display = 'none'

    // Show the main app
    document.getElementById('app-container').style.display = 'block'
    import('./main.js').then(mod => {
    mod.initApp(supabase);
  }).catch(err => console.error('Failed to load main.js', err));
  } else {
    // Show login form, hide logout and shelf stack
    loginBtn.style.display = 'inline-block'
    signupBtn.style.display = 'inline-block'
    logoutBtn.style.display = 'none'
    btnNavShelfStack.style.display = 'none'
    document.getElementById('divEmail').style.display = ''
    document.getElementById('divPassword').style.display = ''
    authMessage.textContent = ''

    // Hide the main app
    document.getElementById('app-container').style.display = 'none'
  }
})