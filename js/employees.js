// Initialize DataTable
let employeesTable;

// Get Firestore database instance from global scope
const db = window.firebaseDb || firebase.firestore();

// Document ready
$(document).ready(function() {
    // Initialize input masks
    $('#empCnic').inputmask('99999-9999999-9', { placeholder: '_____-_______-_' });
    $('#empMobile').inputmask('0399-9999999', { placeholder: '____-_______' });
    
    // Initialize DataTable with empty data
    employeesTable = $('#employeesTable').DataTable({
        data: [],
        columns: [
            { 
                data: 'empId',
                defaultContent: ''
            },
            { 
                data: 'name',
                defaultContent: ''
            },
            { 
                data: 'cnic',
                defaultContent: ''
            },
            { 
                data: 'mobile',
                defaultContent: ''
            },
            { 
                data: 'status',
                defaultContent: 'N/A',
                render: function(data, type, row) {
                    if (!data) return '<span class="badge bg-secondary">N/A</span>';
                    const statusClass = data === 'Active' ? 'success' : 
                                     data === 'Inactive' ? 'danger' : 'warning';
                    return `<span class="badge bg-${statusClass}">${data}</span>`;
                }
            },
            {
                data: null,
                orderable: false,
                defaultContent: '',
                render: function(data, type, row) {
                    if (!row.id) return '';
                    return `
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-primary" 
                                onclick="editEmployee('${row.id}')" 
                                data-bs-toggle="tooltip" 
                                title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" 
                                onclick="showDeleteModal('${row.id}')" 
                                data-bs-toggle="tooltip" 
                                title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[0, 'asc']],
        responsive: true,
        pageLength: 10,
        lengthMenu: [5, 10, 25, 50, 100],
        language: {
            emptyTable: 'No employees found. Click "Add Employee" to get started.',
            loadingRecords: 'Loading employees...',
            zeroRecords: 'No matching employees found'
        },
        initComplete: function() {
            // Initialize tooltips after table is loaded
            $('[data-bs-toggle="tooltip"]').tooltip();
        }
    });
    
    // Load employees
    loadEmployees();
});

// Load employees from Firestore
async function loadEmployees() {
    try {
        // Show loading state
        const employeesTable = $('#employeesTable').DataTable();
        employeesTable.clear().draw();
        
        // Get employees from Firestore
        const employeesSnapshot = await db.collection('employees').get();
        
        if (employeesSnapshot.empty) {
            // No employees found
            employeesTable.clear().draw();
            return;
        }
        
        // Process employee data
        const employees = [];
        employeesSnapshot.forEach(doc => {
            const employee = doc.data();
            // Ensure all required fields exist
            employee.id = doc.id;
            employee.empId = employee.empId || '';
            employee.name = employee.name || '';
            employee.cnic = employee.cnic || '';
            employee.mobile = employee.mobile || '';
            employee.status = employee.status || 'Inactive';
            employees.push(employee);
        });
        
        // Sort by employee ID
        employees.sort((a, b) => {
            if (!a.empId) return 1;
            if (!b.empId) return -1;
            return a.empId.localeCompare(b.empId);
        });
        
        // Clear and redraw the table with new data
        employeesTable.clear().rows.add(employees).draw();
        
    } catch (error) {
        console.error('Error loading employees:', error);
        showMessage('Error loading employees. Please try again.', 'danger');
        
        // Try to reinitialize the table if there was an error
        if (!$.fn.DataTable.isDataTable('#employeesTable')) {
            $('#employeesTable').DataTable({
                language: {
                    emptyTable: 'Error loading employee data. Please refresh the page.'
                }
            });
        }
    }
}

// Reset employee form
function resetEmployeeForm() {
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeId').value = '';
    document.getElementById('employeeModalLabel').textContent = 'Add New Employee';
}

// Edit employee
async function editEmployee(employeeId) {
    try {
        const doc = await db.collection('employees').doc(employeeId).get();
        
        if (!doc.exists) {
            showMessage('Employee not found', 'danger');
            return;
        }
        
        const employee = doc.data();
        
        // Populate form
        document.getElementById('employeeId').value = doc.id;
        document.getElementById('empId').value = employee.empId;
        document.getElementById('empName').value = employee.name;
        document.getElementById('empCnic').value = employee.cnic;
        document.getElementById('empMobile').value = employee.mobile;
        document.getElementById('empStatus').value = employee.status || 'Active';
        
        // Update modal title
        document.getElementById('employeeModalLabel').textContent = 'Edit Employee';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error editing employee:', error);
        showMessage('Error loading employee data', 'danger');
    }
}

// Save employee (add or update)
async function saveEmployee(event) {
    event.preventDefault();
    
    // Get the save button and disable it to prevent double submission
    const saveButton = document.querySelector('#employeeForm button[type="submit"]');
    const originalButtonText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    
    try {
        const employeeId = document.getElementById('employeeId').value;
        const empId = document.getElementById('empId').value.trim();
        const name = document.getElementById('empName').value.trim();
        const cnic = document.getElementById('empCnic').value.trim();
        const mobile = document.getElementById('empMobile').value.trim();
        const status = document.getElementById('empStatus').value;
        
        // Basic validation
        if (!empId || !name || !cnic || !mobile) {
            showMessage('Please fill in all required fields', 'warning');
            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonText;
            return;
        }
        
        // Check if employee ID already exists (for new employees)
        if (!employeeId) {
            const existingEmployee = await db.collection('employees')
                .where('empId', '==', empId)
                .limit(1)
                .get();
                
            if (!existingEmployee.empty) {
                showMessage('Employee ID already exists', 'warning');
                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonText;
                return;
            }
        }
        
        const employeeData = {
            empId,
            name,
            cnic,
            mobile,
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add or update employee
        if (employeeId) {
            await db.collection('employees').doc(employeeId).update(employeeData);
            showMessage('Employee updated successfully', 'success');
        } else {
            employeeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('employees').add(employeeData);
            showMessage('Employee added successfully', 'success');
        }
        
        // Reset form and close modal
        document.getElementById('employeeForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        // Refresh the employees table
        await loadEmployees();
        
    } catch (error) {
        console.error('Error saving employee:', error);
        showMessage('Error saving employee: ' + (error.message || 'Please try again.'), 'danger');
    } finally {
        // Re-enable the save button
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonText;
        }
    }
}

// Show delete confirmation modal
function showDeleteModal(employeeId) {
    document.getElementById('deleteEmployeeId').value = employeeId;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// Confirm and delete employee
async function confirmDelete() {
    const employeeId = document.getElementById('deleteEmployeeId').value;
    
    if (!employeeId) {
        showMessage('Invalid employee', 'danger');
        return;
    }
    
    try {
        // Check if employee has attendance records
        const attendanceSnapshot = await db.collection('attendance')
            .where('employeeId', '==', employeeId)
            .limit(1)
            .get();
            
        if (!attendanceSnapshot.empty) {
            showMessage('Cannot delete employee with attendance records', 'warning');
            return;
        }
        
        // Delete employee
        await db.collection('employees').doc(employeeId).delete();
        
        // Close modal and refresh table
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        
        showMessage('Employee deleted successfully', 'success');
        loadEmployees();
        
    } catch (error) {
        console.error('Error deleting employee:', error);
        showMessage('Error deleting employee. Please try again.', 'danger');
    }
}
