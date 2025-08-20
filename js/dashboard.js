// Dashboard specific functionality
document.addEventListener('DOMContentLoaded', function() {
    // First ensure Firebase is initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Set up auth state observer
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            // Initialize Firestore
            const db = firebase.firestore();
            
            // Load dashboard data
            loadDashboardStats();
            loadRecentActivity();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
        }
    });
});

// Helper function to convert record data to Date object
function getDateFromRecord(record) {
    if (record.timestamp && record.timestamp.toDate) {
        return record.timestamp.toDate();
    } else if (record.date) {
        // If it's a Firestore timestamp
        if (record.date.seconds) {
            return new Date(record.date.seconds * 1000);
        }
        // If it's a string date
        return new Date(record.date);
    }
    // Fallback to current date if no valid date found
    return new Date();
}

// Load dashboard statistics
async function loadDashboardStats() {
    if (!currentUser) return;
    
    // Ensure Firestore is initialized
    const db = firebase.firestore();
    
    try {
        console.log('Loading dashboard stats...');
        
        // Get today's date at midnight in local time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get tomorrow's date at midnight
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log('Date range:', { today, tomorrow });
        
        // Get all employees count
        const employeesSnapshot = await db.collection('employees').get();
        const totalEmployees = employeesSnapshot.size;
        
        console.log('Total employees:', totalEmployees);
        
        // Get today's attendance - try multiple date field names and formats
        let attendanceSnapshot;
        
        // Try different field names for date
        const dateFields = ['date', 'timestamp', 'createdAt', 'attendanceDate'];
        
        for (const field of dateFields) {
            try {
                attendanceSnapshot = await db.collection('attendance')
                    .where(field, '>=', today)
                    .where(field, '<', tomorrow)
                    .get();
                    
                if (!attendanceSnapshot.empty) {
                    console.log(`Found ${attendanceSnapshot.size} records using field '${field}'`);
                    break;
                }
            } catch (e) {
                console.log(`Error querying with field '${field}':`, e.message);
            }
        }
        
        if (!attendanceSnapshot || attendanceSnapshot.empty) {
            console.log('No attendance records found for today. Trying to get all records...');
            // Fallback: Get all records and filter client-side
            attendanceSnapshot = await db.collection('attendance').get();
            
            // Filter records for today
            const todayRecords = [];
            attendanceSnapshot.forEach(doc => {
                const data = doc.data();
                const recordDate = this.getDateFromRecord(data);
                if (recordDate >= today && recordDate < tomorrow) {
                    todayRecords.push({ id: doc.id, ...data });
                }
            });
            
            console.log(`Found ${todayRecords.length} records for today after client-side filtering`);
            // Create a custom snapshot-like object
            attendanceSnapshot = {
                size: todayRecords.length,
                forEach: (callback) => todayRecords.forEach(doc => callback({ data: () => doc, id: doc.id })),
                empty: todayRecords.length === 0,
                docs: todayRecords.map(doc => ({
                    id: doc.id,
                    data: () => doc,
                    exists: true
                }))
            };
        }
        
        // Initialize counters
        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;
        let wfhCount = 0;
        let doCount = 0;
        
        // Helper function to get date from record
        const getDateFromRecord = (record) => {
            // Try different possible date fields
            const dateFields = ['date', 'timestamp', 'createdAt', 'attendanceDate'];
            
            for (const field of dateFields) {
                if (record[field]) {
                    // Convert Firestore Timestamp to Date if needed
                    return record[field].toDate ? record[field].toDate() : new Date(record[field]);
                }
            }
            
            // If no date field found, return current date as fallback
            console.warn('No date field found in record, using current date', record);
            return new Date();
        };
        
        // Count statuses
        attendanceSnapshot.forEach(doc => {
            const data = doc.data ? doc.data() : doc;
            const recordDate = getDateFromRecord(data);
            
            // Skip if record is not from today
            if (recordDate < today || recordDate >= tomorrow) {
                return;
            }
            
            console.log('Processing record:', { 
                id: doc.id, 
                data,
                recordDate,
                isToday: recordDate >= today && recordDate < tomorrow
            });
            
            // Check both 'status' and 'attendanceStatus' fields for compatibility
            const status = (data.status || data.attendanceStatus || '').toString().trim().toLowerCase();
            
            if (!status) {
                console.warn('Record has no status field:', data);
                return;
            }
            
            // Normalize status for comparison
            const normalizedStatus = status.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            
            // Count statuses with more flexible matching
            if (normalizedStatus.includes('present')) {
                presentCount++;
            } else if (normalizedStatus.includes('absent')) {
                absentCount++;
            } else if (normalizedStatus.includes('leave')) {
                leaveCount++;
            } else if (normalizedStatus.includes('wfh') || normalizedStatus.includes('workfromhome')) {
                wfhCount++;
            } else if (normalizedStatus.includes('dayoff') || 
                      normalizedStatus.includes('dayoff') || 
                      normalizedStatus.includes('do') ||
                      normalizedStatus.includes('offday') ||
                      normalizedStatus === 'off') {
                doCount++;
            } else {
                console.warn('Unknown status:', status, 'in record:', data);
            }
        });
        
        console.log('Counts:', { presentCount, absentCount, leaveCount, wfhCount, doCount });
        
        // Update the UI
        document.getElementById('total-employees').textContent = totalEmployees;
        document.getElementById('present-count').textContent = presentCount || '0';
        document.getElementById('absent-count').textContent = absentCount || '0';
        document.getElementById('leave-count').textContent = leaveCount || '0';
        document.getElementById('wfh-count').textContent = wfhCount || '0';
        document.getElementById('do-count').textContent = doCount || '0';
        
        // Update progress bars or any other UI elements if needed
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showMessage('Error loading dashboard statistics. Please try again.', 'danger');
    }
}

// Load recent attendance activity
async function loadRecentActivity() {
    if (!currentUser) return;
    
    // Ensure Firestore is initialized
    const db = firebase.firestore();
    
    try {
        const activityList = document.getElementById('recent-activity');
        if (!activityList) return;
        
        // Clear loading message
        activityList.innerHTML = '';
        
        // Get recent attendance records (last 10)
        const attendanceSnapshot = await db.collection('attendance')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
            
        if (attendanceSnapshot.empty) {
            activityList.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No recent activity found</td>
                </tr>
            `;
            return;
        }
        
        // Process each attendance record
        const promises = [];
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Get employee details
            const promise = db.collection('employees').doc(data.employeeId).get()
                .then(employeeDoc => {
                    if (!employeeDoc.exists) return null;
                    
                    const employee = employeeDoc.data();
                    return {
                        id: doc.id,
                        ...data,
                        employeeName: employee.name
                    };
                });
                
            promises.push(promise);
        });
        
        // Wait for all employee data to be fetched
        const activities = await Promise.all(promises);
        
        // Filter out any null entries (where employee wasn't found)
        const validActivities = activities.filter(activity => activity !== null);
        
        // Sort by timestamp (most recent first)
        validActivities.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
        
        // Update the UI
        if (validActivities.length === 0) {
            activityList.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No recent activity found</td>
                </tr>
            `;
            return;
        }
        
        activityList.innerHTML = validActivities.map(activity => {
            const date = activity.timestamp.toDate();
            const timeString = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const dateString = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Determine badge class based on status
            let badgeClass = 'bg-secondary';
            switch(activity.status) {
                case 'Present': badgeClass = 'bg-success'; break;
                case 'Absent': badgeClass = 'bg-danger'; break;
                case 'Leave': badgeClass = 'bg-warning text-dark'; break;
                case 'WFH': badgeClass = 'bg-info'; break;
                case 'DO': badgeClass = 'bg-secondary'; break;
                case 'OFF': badgeClass = 'bg-dark'; break;
            }
            
            return `
                <tr>
                    <td>${activity.employeeName || 'Unknown'}</td>
                    <td><span class="badge ${badgeClass}">${activity.status}</span></td>
                    <td>${timeString}</td>
                    <td>${dateString}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        const activityList = document.getElementById('recent-activity');
        if (activityList) {
            activityList.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger">Error loading recent activity</td>
                </tr>
            `;
        }
    }
}

// Refresh dashboard data
function refreshDashboard() {
    loadDashboardStats();
    loadRecentActivity();
}

// Helper function to show toast messages
function showMessage(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.id = toastId;
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    
    bsToast.show();
    
    // Remove the toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function () {
        toast.remove();
    });
}
