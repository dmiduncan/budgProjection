// auth.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Replace with your own Supabase credentials
const supabaseUrl = 'https://ljisujkxmbijleyhmxab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaXN1amt4bWJpamxleWhteGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMyOTYsImV4cCI6MjA3MDEwOTI5Nn0.9CbNfvI5VlUUQ4bbHd18pGR9ft-tHz2FLKAF_4yQJsg';
export const supabase = createClient(supabaseUrl, supabaseKey)

// UI Elements
const authContainer = document.createElement('div')
authContainer.innerHTML = `
  <h2>Login or Sign Up</h2>
  <div id="auth-message"></div>
  <div id="divEmail">
  <input type="email" id="email" placeholder="Email" style="width: 300px;" required>
  </div>
  <div id="divPassword">
  <input type="password" id="password" placeholder="Password" style="width: 300px;" required>
  </div>
  <button id="login-btn">Login</button>
  <button id="signup-btn">Sign Up</button>
  <button id="logout-btn" style="display:none;">Logout</button>
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
  } else {
    authMessage.textContent = "Logged in!"
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
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // Hide login form, show logout
    loginBtn.style.display = 'none'
    signupBtn.style.display = 'none'
    logoutBtn.style.display = 'inline-block'
    document.getElementById('divEmail').style.display = 'none'
    document.getElementById('divPassword').style.display = 'none'
    authMessage.textContent = `Logged in as ${session.user.email}`

    // Show the main app
    document.getElementById('app-container').style.display = 'block'
    import('./main.js').then(mod => {
    mod.initApp(supabase);
  }).catch(err => console.error('Failed to load main.js', err));
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
