// Firebase configuration - this should match your Firebase project settings
const firebaseConfig = {
    apiKey: "AIzaSyCYUR5x2QkwIWQnA0Lxx5CXYheQuzFK280",
    authDomain: "new-ams-bf23d.firebaseapp.com",
    projectId: "new-ams-bf23d",
    storageBucket: "new-ams-bf23d.appspot.com",
    messagingSenderId: "560293087629",
    appId: "1:560293087629:web:43a5a70b96d54d5b7155c4"
};

// Initialize Firebase if it hasn't been initialized yet
if (!window.firebaseApp) {
    try {
        // Initialize Firebase
        window.firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
        
        // Initialize services
        const auth = firebase.auth();
        
        // Initialize Firestore with settings including cache configuration
        const db = firebase.firestore();
        
        // Configure Firestore settings with cache configuration
        const firestoreSettings = {
            cache: {
                // Enable offline persistence with cache size of 100MB
                size: 100 * 1024 * 1024, // 100MB
                // Enable multi-tab synchronization
                synchronizeTabs: true
            }
        };
        
        // Apply the settings
        db.settings(firestoreSettings);
        
        // Set auth persistence
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                console.log('Auth persistence set to LOCAL');
            })
            .catch((error) => {
                console.error('Error setting auth persistence:', error);
            });
        
        // Make services available globally
        window.firebaseAuth = auth;
        window.firebaseDb = db;
        
        // Log cache configuration
        console.log('Firestore cache configuration:', firestoreSettings.cache);
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        // Show error to user
        if (typeof showMessage === 'function') {
            showMessage('Failed to initialize the application. Please refresh the page.', 'danger');
        } else {
            alert('Failed to initialize the application. Please refresh the page.');
        }
    }
} else {
    console.log('Firebase already initialized');
}
