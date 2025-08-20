// Get Firebase services from window object
function getFirebaseServices() {
    if (!window.firebaseAuth || !window.firebaseDb) {
        console.error('Firebase services not properly initialized');
        return { auth: null, db: null };
    }
    return {
        auth: window.firebaseAuth,
        db: window.firebaseDb
    };
}

// Toggle between login and register forms
function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// Register new user
function register() {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Basic validation
    if (!email || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    // Show loading state
    const registerBtn = document.querySelector('#register-form button[onclick="register()"]');
    const originalBtnText = registerBtn.innerHTML;
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...';

    const { auth, db } = getFirebaseServices();
    if (!auth || !db) {
        showMessage('Application not properly initialized. Please refresh the page.', 'danger');
        return;
    }

    // Create user with email and password
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // User registered successfully
            const user = userCredential.user;
            // Create user document in Firestore
            return db.collection('users').doc(user.uid).set({
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            showMessage('Registration successful! Please login with your new account.', 'success');
            // Clear form
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('confirm-password').value = '';
            showLogin();
        })
        .catch((error) => {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed: ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'This email is already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Please enter a valid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Password is too weak. Please use at least 6 characters.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your internet connection.';
                    break;
                default:
                    errorMessage += error.message;
            }
            showMessage(errorMessage, 'danger');
        })
        .finally(() => {
            // Reset button state
            registerBtn.disabled = false;
            registerBtn.innerHTML = originalBtnText;
        });
}

// Login user
function login() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (!email || !password) {
        showMessage('Please enter both email and password', 'warning');
        return;
    }

    // Show loading state
    const loginBtn = document.querySelector('#login-form button[onclick="login()"]');
    const originalBtnText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';

    const { auth, db } = getFirebaseServices();
    if (!auth || !db) {
        showMessage('Application not properly initialized. Please refresh the page.', 'danger');
        return;
    }

    // Sign in with email and password
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Update last login time
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Redirect to dashboard on successful login
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Login error:', error);
            let errorMessage = 'Login failed: ';
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage += 'Invalid email or password.';
                    break;
                case 'auth/user-disabled':
                    errorMessage += 'This account has been disabled.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage += 'Too many failed login attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your internet connection.';
                    break;
                default:
                    errorMessage += error.message;
            }
            showMessage(errorMessage, 'danger');
        })
        .finally(() => {
            // Reset button state
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnText;
        });
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Create and show new alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to the form
    const form = document.getElementById('login-form') || document.getElementById('register-form');
    if (form) {
        form.prepend(alertDiv);
    } else {
        // If no form is found, show as a toast notification
        const toastContainer = document.createElement('div');
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
        toastContainer.appendChild(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 5000);
    }
}

// Check auth state when Firebase is ready
function initializeAuthState() {
    const { auth } = getFirebaseServices();
    if (!auth) return;
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
                window.location.href = 'dashboard.html';
            }
        } else {
            // User is signed out
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            }
        }
    });
}

// Initialize auth state when Firebase is ready
if (window.firebaseApp) {
    initializeAuthState();
} else {
    // If Firebase isn't ready yet, wait for it
    const checkAuthReady = setInterval(() => {
        if (window.firebaseApp) {
            clearInterval(checkAuthReady);
            initializeAuthState();
        }
    }, 100);
}

// Logout function with confirmation
function logout() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to sign out?')) {
        const { auth } = getFirebaseServices();
        if (!auth) {
            console.error('Auth service not available');
            return;
        }
        
        // Show loading state
        const signOutBtn = document.querySelector('[onclick="logout()"]');
        const originalText = signOutBtn ? signOutBtn.innerHTML : 'Sign out';
        if (signOutBtn) {
            signOutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing out...';
            signOutBtn.onclick = null; // Prevent multiple clicks
        }
        
        // Sign out
        auth.signOut().then(() => {
            // Show success message on index page
            sessionStorage.setItem('logoutMessage', 'You have been successfully signed out.');
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout error:', error);
            showMessage('Failed to sign out. Please try again.', 'danger');
            // Reset button if exists
            if (signOutBtn) {
                signOutBtn.innerHTML = originalText;
                signOutBtn.onclick = () => logout();
            }
        });
    }
}
