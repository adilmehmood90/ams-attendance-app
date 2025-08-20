// Global variables
let employees = [];
let attendanceRecords = [];
let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Get Firestore database instance from global scope
const db = window.db || window.firebaseDb || firebase.firestore();

// Document ready
$(document).ready(function() {
    // Set default date to today
    $('#attendanceDate').val(selectedDate);
    $('#updateDate').val(selectedDate);
    
    // Load employees for the dropdown
    loadEmployeesForDropdown();
    
    // Load attendance for the selected date
    loadAttendanceForDate();
    
    // Initialize tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();
});

// Load employees for the update dropdown
async function loadEmployeesForDropdown() {
    try {
        // First get all active employees
        const activeEmployees = [];
        const snapshot = await db.collection('employees')
            .where('status', '==', 'Active')
            .get();
            
        // Process and sort in memory
        snapshot.forEach(doc => {
            const employee = { id: doc.id, ...doc.data() };
            activeEmployees.push(employee);
        });
        
        // Sort by name
        activeEmployees.sort((a, b) => a.name.localeCompare(b.name));
        
        const dropdown = $('#updateEmployee');
        dropdown.empty().append('<option value="" selected disabled>Select Employee</option>');
        
        // Add sorted employees to dropdown
        activeEmployees.forEach(employee => {
            dropdown.append(`<option value="${employee.id}">${employee.name} (${employee.empId || 'N/A'})</option>`);
        });
        
    } catch (error) {
        console.error('Error loading employees:', error);
        showMessage('Error loading employees. ' + error.message, 'danger');
    }
}

// Load attendance for the selected date
async function loadAttendanceForDate() {
    try {
        selectedDate = $('#attendanceDate').val() || selectedDate;
        
        // Clear previous data
        const tbody = $('#attendance-list');
        tbody.html('<tr><td colspan="5" class="text-center">Loading attendance data...</td></tr>');
        
        // Load employees first (without ordering to avoid index)
        const employeesSnapshot = await db.collection('employees')
            .where('status', '==', 'Active')
            .get();
            
        employees = [];
        employeesSnapshot.forEach(doc => {
            employees.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort employees by name in memory
        employees.sort((a, b) => a.name.localeCompare(b.name));
        
        // Load all attendance records for the selected date
        const attendanceSnapshot = await db.collection('attendance')
            .where('date', '==', selectedDate)
            .get();
            
        attendanceRecords = [];
        attendanceSnapshot.forEach(doc => {
            attendanceRecords.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Create a map of employeeId to attendance record for quick lookup
        const attendanceMap = new Map();
        attendanceRecords.forEach(record => {
            attendanceMap.set(record.employeeId, record);
        });
        
        // Build the attendance table HTML
        let html = '';
        
        if (employees.length === 0) {
            html = '<tr><td colspan="5" class="text-center">No active employees found</td></tr>';
        } else {
            employees.forEach(employee => {
                const attendance = attendanceMap.get(employee.id) || {};
                
                html += `
                    <tr data-employee-id="${employee.id}">
                        <td>${employee.empId || 'N/A'}</td>
                        <td>${employee.name}</td>
                        <td>
                            <select class="form-select form-select-sm status-select" 
                                    data-employee-id="${employee.id}" 
                                    ${attendance.id ? `data-attendance-id="${attendance.id}"` : ''}
                                    ${attendance.id ? 'data-updated="true"' : ''}>
                                <option value="" ${!attendance.status ? 'selected' : ''}>Select Status</option>
                                <option value="Present" ${attendance.status === 'Present' ? 'selected' : ''}>Present</option>
                                <option value="Absent" ${attendance.status === 'Absent' ? 'selected' : ''}>Absent</option>
                                <option value="Leave" ${attendance.status === 'Leave' ? 'selected' : ''}>Leave</option>
                                <option value="OFF" ${attendance.status === 'OFF' ? 'selected' : ''}>OFF</option>
                                <option value="WFH" ${attendance.status === 'WFH' ? 'selected' : ''}>WFH</option>
                                <option value="DO" ${attendance.status === 'DO' ? 'selected' : ''}>DO</option>
                            </select>
                        </td>
                        <td>
                            <input type="text" 
                                   class="form-control form-control-sm comment-input" 
                                   data-employee-id="${employee.id}"
                                   value="${attendance.comment || ''}"
                                   placeholder="Comment (for Leave/DO)" 
                                   ${(attendance.status === 'Leave' || attendance.status === 'DO') ? '' : 'disabled'}>
                        </td>
                        <td>
                            <button type="button" 
                                    class="btn btn-sm btn-outline-primary save-btn" 
                                    data-employee-id="${employee.id}"
                                    ${attendance.id ? 'data-attendance-id="' + attendance.id + '"' : ''}
                                    ${attendance.status ? '' : 'disabled'}>
                                <i class="bi bi-save"></i> Save
                            </button>
                        </td>
                    </tr>`;
            });
        }
        
        tbody.html(html);
        
        // Add event listeners
        $('.status-select').on('change', function() {
            const employeeId = $(this).data('employee-id');
            const status = $(this).val();
            const commentInput = $(`.comment-input[data-employee-id="${employeeId}"]`);
            const saveBtn = $(`.save-btn[data-employee-id="${employeeId}"]`);
            
            // Enable/disable comment field based on status
            if (status === 'Leave' || status === 'DO') {
                commentInput.prop('disabled', false);
            } else {
                commentInput.prop('disabled', true).val('');
            }
            
            // Enable/disable save button
            saveBtn.prop('disabled', !status);
            
            // Mark as updated
            $(this).data('updated', true);
        });
        
        $('.save-btn').on('click', function() {
            const employeeId = $(this).data('employee-id');
            saveSingleAttendance(employeeId);
        });
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        showMessage('Error loading attendance data', 'danger');
    }
}

// Mark all employees as present
function markAllPresent() {
    if (!confirm('Mark all employees as present for ' + selectedDate + '?')) {
        return;
    }
    
    $('.status-select').each(function() {
        $(this).val('Present').trigger('change');
    });
    
    showMessage('All employees marked as present. Click "Save Attendance" to confirm.', 'info');
}

// Save attendance for all employees
async function saveAttendance() {
    try {
        const updates = [];
        let count = 0;
        
        // Collect all updates
        $('.status-select').each(function() {
            const employeeId = $(this).data('employee-id');
            const status = $(this).val();
            const comment = $(`.comment-input[data-employee-id="${employeeId}"]`).val() || '';
            const attendanceId = $(this).data('attendance-id');
            
            if (!status) return; // Skip if no status selected
            
            const attendanceData = {
                employeeId,
                status,
                date: selectedDate,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.uid
            };
            
            if (comment) {
                attendanceData.comment = comment;
            }
            
            // Add employee details for reference
            const employee = employees.find(e => e.id === employeeId);
            if (employee) {
                attendanceData.employeeName = employee.name;
                attendanceData.employeeEmpId = employee.empId;
            }
            
            if (attendanceId) {
                // Update existing record
                updates.push(
                    db.collection('attendance').doc(attendanceId).update(attendanceData)
                );
            } else {
                // Add new record
                attendanceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                updates.push(
                    db.collection('attendance').add(attendanceData)
                );
            }
            
            count++;
        });
        
        if (count === 0) {
            showMessage('No changes to save', 'info');
            return;
        }
        
        // Execute all updates
        await Promise.all(updates);
        
        showMessage(`Attendance saved successfully for ${count} employees`, 'success');
        loadAttendanceForDate(); // Refresh the view
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        showMessage('Error saving attendance. Please try again.', 'danger');
    }
}

// Save attendance for a single employee
async function saveSingleAttendance(employeeId) {
    try {
        const status = $(`.status-select[data-employee-id="${employeeId}"]`).val();
        const comment = $(`.comment-input[data-employee-id="${employeeId}"]`).val() || '';
        const attendanceId = $(`.status-select[data-employee-id="${employeeId}"]`).data('attendance-id');
        
        if (!status) {
            showMessage('Please select a status', 'warning');
            return;
        }
        
        const attendanceData = {
            employeeId,
            status,
            date: selectedDate,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid
        };
        
        if (comment) {
            attendanceData.comment = comment;
        }
        
        // Add employee details for reference
        const employee = employees.find(e => e.id === employeeId);
        if (employee) {
            attendanceData.employeeName = employee.name;
            attendanceData.employeeEmpId = employee.empId;
        }
        
        if (attendanceId) {
            // Update existing record
            await db.collection('attendance').doc(attendanceId).update(attendanceData);
        } else {
            // Add new record
            attendanceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('attendance').add(attendanceData);
        }
        
        // Update the UI
        const saveBtn = $(`.save-btn[data-employee-id="${employeeId}"]`);
        saveBtn.html('<i class="bi bi-check"></i> Saved').prop('disabled', true);
        
        // Reset the button after 2 seconds
        setTimeout(() => {
            saveBtn.html('<i class="bi bi-save"></i> Save').prop('disabled', false);
        }, 2000);
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        showMessage('Error saving attendance. Please try again.', 'danger');
    }
}

// Update a previous attendance record
async function updateAttendanceRecord() {
    try {
        const employeeId = $('#updateEmployee').val();
        const date = $('#updateDate').val();
        const status = $('#updateStatus').val();
        const comment = $('#updateComment').val() || '';
        
        if (!employeeId || !date || !status) {
            showMessage('Please fill in all required fields', 'warning');
            return;
        }
        
        // Check if the date is in the future
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            showMessage('Cannot update attendance for future dates', 'warning');
            return;
        }
        
        // Check if record exists
        const snapshot = await db.collection('attendance')
            .where('employeeId', '==', employeeId)
            .where('date', '==', date)
            .limit(1)
            .get();
        
        const attendanceData = {
            employeeId,
            status,
            date,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid,
            comment: comment || firebase.firestore.FieldValue.delete()
        };
        
        // Add employee details for reference
        const employeeDoc = await db.collection('employees').doc(employeeId).get();
        if (employeeDoc.exists) {
            const employee = employeeDoc.data();
            attendanceData.employeeName = employee.name;
            attendanceData.employeeEmpId = employee.empId;
        }
        
        if (!snapshot.empty) {
            // Update existing record
            const docId = snapshot.docs[0].id;
            await db.collection('attendance').doc(docId).update(attendanceData);
            showMessage('Attendance record updated successfully', 'success');
        } else {
            // Add new record
            attendanceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('attendance').add(attendanceData);
            showMessage('Attendance record added successfully', 'success');
        }
        
        // Refresh the view if we're on the same date
        if (date === selectedDate) {
            loadAttendanceForDate();
        }
        
        // Clear the form
        $('#updateComment').val('');
        
    } catch (error) {
        console.error('Error updating attendance:', error);
        showMessage('Error updating attendance record. Please try again.', 'danger');
    }
}
