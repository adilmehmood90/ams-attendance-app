// Global variables
let currentUser = null;
let logoutTimer;
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 5 minutes in milliseconds
const WARNING_TIMEOUT = 14.30 * 60 * 1000; // 4.5 minutes in milliseconds

// Reset the inactivity timer
function resetInactivityTimer() {
    // Clear any existing timers
    clearTimeout(logoutTimer);
    
    // Hide warning if visible
    const warningElement = document.getElementById('inactivity-warning');
    if (warningElement) {
        warningElement.style.display = 'none';
    }
    
    // Set new timer for warning
    logoutTimer = setTimeout(showInactivityWarning, WARNING_TIMEOUT);
}

// Show warning before logout
function showInactivityWarning() {
    // Create or show warning element
    let warningElement = document.getElementById('inactivity-warning');
    if (!warningElement) {
        warningElement = document.createElement('div');
        warningElement.id = 'inactivity-warning';
        warningElement.style.position = 'fixed';
        warningElement.style.top = '20px';
        warningElement.style.left = '50%';
        warningElement.style.transform = 'translateX(-50%)';
        warningElement.style.backgroundColor = '#f8d7da';
        warningElement.style.color = '#721c24';
        warningElement.style.padding = '15px';
        warningElement.style.borderRadius = '5px';
        warningElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        warningElement.style.zIndex = '9999';
        warningElement.style.textAlign = 'center';
        warningElement.innerHTML = 'You will be logged out due to inactivity in 30 seconds. <a href="#" id="stay-logged-in" style="color: #721c24; font-weight: bold; margin-left: 10px;">Stay logged in</a>';
        document.body.appendChild(warningElement);
        
        // Add event listener to stay logged in button
        document.getElementById('stay-logged-in').addEventListener('click', function(e) {
            e.preventDefault();
            resetInactivityTimer();
        });
    } else {
        warningElement.style.display = 'block';
    }
    
    // Set final logout timer
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(logoutDueToInactivity, 30000); // 30 seconds after warning
}

// Logout due to inactivity
function logoutDueToInactivity() {
    if (currentUser) {
        firebase.auth().signOut().then(() => {
            // Redirect to login page
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            updateUIForUser(user);
            updateClock();
            setInterval(updateClock, 1000);
            
            // Initialize inactivity timer
            resetInactivityTimer();
            
            // Add event listeners for user activity
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            events.forEach(event => {
                document.addEventListener(event, resetInactivityTimer, true);
            });
            
            // Also track visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    resetInactivityTimer();
                }
            });
            
            // Load appropriate page content
            if (document.getElementById('dashboard-stats')) {
                loadDashboardStats();
            } else if (document.getElementById('employee-list')) {
                loadEmployees();
            } else if (document.getElementById('attendance-form')) {
                setupAttendanceForm();
            } else if (document.getElementById('attendance-report')) {
                setupAttendanceReport();
            }
        }
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// Update UI elements based on user authentication
function updateUIForUser(user) {
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
}

// Update digital clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const clockElement = document.getElementById('digital-clock');
    if (clockElement) {
        clockElement.innerHTML = `
            <div class="time">${timeString}</div>
            <div class="date">${dateString}</div>
        `;
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    if (!currentUser) return;
    
    try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Get total employees count
        const employeesSnapshot = await db.collection('employees').get();
        const totalEmployees = employeesSnapshot.size;
        
        // Get today's attendance
        const attendanceSnapshot = await db.collection('attendance')
            .where('date', '==', today)
            .get();
            
        let present = 0, absent = 0, onLeave = 0, off = 0, wfh = 0, doCount = 0;
        
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            switch(data.status) {
                case 'Present': present++; break;
                case 'Absent': absent++; break;
                case 'Leave': onLeave++; break;
                case 'OFF': off++; break;
                case 'WFH': wfh++; break;
                case 'DO': doCount++; break;
            }
        });
        
        // Update the UI
        document.getElementById('total-employees').textContent = totalEmployees;
        document.getElementById('present-count').textContent = present;
        document.getElementById('absent-count').textContent = absent;
        document.getElementById('leave-count').textContent = onLeave;
        document.getElementById('off-count').textContent = off;
        document.getElementById('wfh-count').textContent = wfh;
        document.getElementById('do-count').textContent = doCount;
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        alert('Error loading dashboard statistics');
    }
}

// Navigation function
function navigateTo(page) {
    window.location.href = `${page}.html`;
}

// Show success/error message
function showMessage(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Try different container selectors to find a suitable place for the message
    const containerSelectors = [
        'main', 
        '.container', 
        '.container-fluid',
        'body'
    ];
    
    let container = null;
    for (const selector of containerSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            container = element;
            break;
        }
    }
    
    if (container) {
        // Insert at the beginning of the container
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    } else {
        // Fallback to alert if no container found (shouldn't happen in normal usage)
        console.warn('Could not find a container for the message');
        alert(`${type.toUpperCase()}: ${message}`);
    }
}
