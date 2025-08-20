// Global variables
let dailyDataTable = null;
let employees = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let isInitialized = false;
let dataTableInitialized = false;

// Document ready
$(document).ready(function() {
    console.log('Document ready, initializing reports...');
    
    // Single initialization function
    function initializeApp() {
        try {
            console.log('Initializing reports app...');
            initializeDatePickers();
            setupEventListeners();
            
            // Initialize DataTable first
            const tableInitialized = initializeDataTable();
            if (!tableInitialized) {
                throw new Error('Failed to initialize DataTable');
            }
            
            // Then load initial data
            loadInitialData();
            isInitialized = true;
            console.log('Reports app initialized successfully');
        } catch (error) {
            console.error('Error initializing reports:', error);
            showMessage('Error initializing reports page: ' + (error.message || 'Unknown error'), 'danger');
            
            // Clean up and retry
            if (dailyDataTable) {
                try { dailyDataTable.destroy(); } catch (e) {}
                dailyDataTable = null;
                dataTableInitialized = false;
            }
            
            // Retry after delay
            setTimeout(initializeApp, 1000);
        }
    }
    
    // Start initialization
    initializeApp();
});

function initializeDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    $('#dailyDate').val(today);
    
    const currentMonthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    $('#monthSelector, #employeeMonth').val(currentMonthYear);
    
    flatpickr("#dailyDate", {
        dateFormat: "Y-m-d",
        defaultDate: today,
        onChange: (_, dateStr) => loadDailyReport(dateStr)
    });
}

function initializeDataTable() {
    try {
        const $table = $('#dailyTable');
        if (!$table.length) {
            console.error('Table element not found');
            return false;
        }
        
        // Only initialize if not already a DataTable
        if ($.fn.DataTable.isDataTable($table)) {
            // Already initialized, just return the existing instance
            dailyDataTable = $table.DataTable();
            dataTableInitialized = true;
            return true;
        }
        
        // Create the table structure
        $table.html(`
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Comment</th>
                </tr>
            </thead>
            <tbody></tbody>
        `);
        
        // Initialize new DataTable
        dailyDataTable = $table.DataTable({
            responsive: true,
            pageLength: 10,
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, width: '15%' },
                { targets: 1, width: '25%' },
                { targets: 2, width: '15%' },
                { targets: 3, width: '15%' },
                { targets: 4, width: '30%' }
            ],
            initComplete: function() {
                dataTableInitialized = true;
                $('[data-bs-toggle="tooltip"]').tooltip();
                console.log('DataTable initialized successfully');
            },
            error: function(e, settings, techNote, message) {
                console.error('DataTables error:', message);
                showMessage('Error initializing data table', 'danger');
            }
        });
        
        window.dailyDataTable = dailyDataTable;
        return true;
    } catch (error) {
        console.error('Error initializing DataTable:', error);
        showMessage('Error initializing data table: ' + (error.message || 'Unknown error'), 'danger');
        return false;
    }
}

async function loadInitialData() {
    await loadEmployeesForReports();
    loadDailyReport($('#dailyDate').val());
    loadMonthlyCalendar();
}

function setupEventListeners() {
    $('#monthSelector, #employeeMonth').on('change', () => {
        const [year, month] = $('#monthSelector').val().split('-').map(Number);
        currentYear = year;
        currentMonth = month - 1;
        loadMonthlyCalendar();
    });
    
    $('#employeeFilter').on('change', loadMonthlyCalendar);
    $('#dailyStatus').on('change', () => loadDailyReport($('#dailyDate').val()));
    $('#generateReport').on('click', generateEmployeeReport);
    $('#exportExcel').on('click', exportToExcel);
    $('#exportPdf').on('click', exportToPdf);
    
    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', (e) => {
        if ($(e.target).attr('href') === '#monthly') loadMonthlyCalendar();
    });
}

async function loadEmployeesForReports() {
    try {
        const snapshot = await db.collection('employees').orderBy('name').get();
        const $employeeSelect = $('#employeeSelect');
        const $employeeFilter = $('#employeeFilter');
        
        $employeeSelect.empty().append('<option value="" disabled selected>Select Employee</option>');
        $employeeFilter.empty().append('<option value="">All Employees</option>');
        
        employees = [];
        snapshot.forEach(doc => {
            const employee = { id: doc.id, ...doc.data() };
            employees.push(employee);
            const option = `<option value="${doc.id}">${employee.name} (${employee.empId})</option>`;
            $employeeSelect.append(option);
            $employeeFilter.append(option);
        });
    } catch (error) {
        console.error('Error loading employees:', error);
        showMessage('Error loading employees', 'danger');
    }
}

async function loadDailyReport(date) {
    try {
        // Ensure we have a valid date
        if (!date) {
            console.error('No date provided to loadDailyReport');
            return;
        }
        
        // Ensure DataTable is initialized
        if (!dailyDataTable || !dataTableInitialized) {
            console.log('Initializing DataTable...');
            const initSuccess = initializeDataTable();
            if (!initSuccess) {
                console.error('Failed to initialize DataTable');
                showMessage('Error initializing data table. Please refresh the page.', 'danger');
                return;
            }
            // Small delay to let DataTable initialize
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Show loading state
        const $loading = $('<div class="text-center p-3">Loading...</div>');
        $('#dailyTable').parent().append($loading);
        
        try {
            // Clear existing data
            if (dailyDataTable) {
                dailyDataTable.clear().draw();
            } else {
                $('#dailyTable tbody').empty();
            }
        
        const statusFilter = $('#dailyStatus').val();
        let query = db.collection('attendance')
            .where('date', '==', date);
            
        if (statusFilter) {
            query = query.where('status', '==', statusFilter);
        }
        
        // Get all matching documents first
        let snapshot = await query.get();
        
        // Sort by employeeName in memory
        let docs = [];
        snapshot.forEach(doc => {
            docs.push(doc);
        });
        
        // Sort by employeeName
        docs.sort((a, b) => {
            const nameA = a.data().employeeName || '';
            const nameB = b.data().employeeName || '';
            return nameA.localeCompare(nameB);
        });
        
        // Create a new snapshot-like object
        snapshot = {
            empty: docs.length === 0,
            forEach: (callback) => docs.forEach(callback)
        };
        
        if (snapshot.empty) {
            dailyDataTable.draw();
            return;
        }
        
        const rows = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const time = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString() : 'N/A';
            const statusClass = getStatusClass(data.status || '');
            
            rows.push([
                data.employeeEmpId || 'N/A',
                data.employeeName || 'Unknown',
                `<span class="badge bg-${statusClass}">${data.status || 'N/A'}</span>`,
                time,
                data.comment || '—'
            ]);
        });
        
        // Add all rows at once for better performance
        if (rows.length > 0) {
            dailyDataTable.rows.add(rows).draw();
        } else {
            dailyDataTable.draw();
        }
        
        } finally {
            // Always remove loading indicator
            $loading.remove();
        }
    } catch (error) {
        console.error('Error in loadDailyReport:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Error loading daily report';
        if (error.message) {
            if (error.message.includes('permission-denied')) {
                errorMessage = 'You do not have permission to view this data';
            } else if (error.message.includes('unavailable')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else {
                errorMessage += ': ' + error.message;
            }
        }
        
        showMessage(errorMessage, 'danger');
        
        // Try to reinitialize the table on error
        if (error.message && (error.message.includes('DataTables') || error.message.includes('parentNode'))) {
            console.log('Attempting to reinitialize DataTable...');
            dataTableInitialized = false;
            setTimeout(() => {
                initializeDataTable().then(() => {
                    if (date) loadDailyReport(date);
                });
            }, 1000);
        }
    }
}

function getStatusClass(status) {
    const classes = {
        'Present': 'success',
        'Absent': 'danger',
        'Leave': 'warning',
        'WFH': 'info',
        'DO': 'dark',
        'OFF': 'secondary'
    };
    return classes[status] || 'secondary';
}

async function loadMonthlyCalendar() {
    try {
        console.log('Loading monthly calendar...');
        const calendarEl = $('#monthlyCalendar');
        calendarEl.html(loadingSpinner('Loading calendar...'));
        
        // Get the current month's start and end dates
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${daysInMonth}`;
        const selectedEmployeeId = $('#employeeFilter').val();
        
        console.log('Date range:', { startDate, endDate, currentMonth, currentYear });
        
        // First, get all attendance records for the date range
        console.log('Fetching attendance records...');
        let query = db.collection('attendance')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);
            
        const snapshot = await query.get();
        console.log('Total records found:', snapshot.size);
        
        // Process the results
        let attendanceData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // If an employee is selected, filter the results in memory
            if (!selectedEmployeeId || data.employeeId === selectedEmployeeId) {
                attendanceData.push(data);
            }
        });
        
        console.log('Filtered records:', attendanceData.length);
        
        // Group the filtered data by date
        const attendanceByDate = {};
        attendanceData.forEach(item => {
            if (!attendanceByDate[item.date]) {
                attendanceByDate[item.date] = [];
            }
            attendanceByDate[item.date].push(item);
        });
        
        console.log('Attendance by date:', attendanceByDate);
        
        // Generate and display the calendar
        const calendarHTML = generateCalendarHTML(daysInMonth, firstDay, attendanceByDate);
        calendarEl.html(calendarHTML);
        console.log('Calendar generated successfully');
        
    } catch (error) {
        console.error('Error in loadMonthlyCalendar:', error);
        const errorMsg = error.message || 'Unknown error occurred';
        console.error('Error details:', { error });
        $('#monthlyCalendar').html(`
            <div class="alert alert-danger">
                <h5>Error loading calendar</h5>
                <p>${errorMsg}</p>
                <p class="mb-0">Please check the console for more details.</p>
            </div>
        `);
    }
}

function loadingSpinner(message) {
    return `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">${message}</p>
        </div>
    `;
}

function groupAttendanceByDate(snapshot) {
    const attendanceByDate = {};
    console.log('Processing', snapshot.size, 'documents...');
    
    snapshot.forEach(doc => {
        try {
            const data = doc.data();
            console.log('Document data:', data);
            
            if (!data.date) {
                console.warn('Document missing date field:', doc.id);
                return;
            }
            
            if (!attendanceByDate[data.date]) {
                attendanceByDate[data.date] = [];
            }
            
            attendanceByDate[data.date].push(data);
        } catch (error) {
            console.error('Error processing document:', doc.id, error);
        }
    });
    
    console.log('Grouped attendance data:', attendanceByDate);
    return attendanceByDate;
}

function generateCalendarHTML(daysInMonth, firstDay, attendanceByDate) {
    let html = `
        <div class="mb-3 d-flex justify-content-between align-items-center">
            <h4 class="mb-0">${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="navigateMonth(-1)">
                    <i class="bi bi-chevron-left"></i> Previous
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="navigateMonth(1)">
                    Next <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead><tr>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<th class="text-center">${d}</th>`).join('')}</tr></thead>
                <tbody>
    `;
    
    // Calculate the total number of cells needed (days + empty cells at start)
    const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7;
    let dayCount = 1;
    
    // Generate calendar rows
    for (let i = 0; i < totalCells; i++) {
        // Start a new row for each week
        if (i % 7 === 0) {
            if (i > 0) html += '</tr>';
            html += '<tr>';
        }
        
        // Add empty cells for days before the 1st of the month
        if (i < firstDay || dayCount > daysInMonth) {
            html += '<td class="calendar-day bg-light"></td>';
            continue;
        }
        
        // Format the date as YYYY-MM-DD for comparison
        const currentDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
        const dayAttendances = attendanceByDate[currentDate] || [];
        
        // Get unique statuses for the day
        const statuses = [...new Set(dayAttendances.map(a => a.status))];
        
        // Add the day cell with attendance indicators
        const isToday = new Date().getDate() === dayCount && 
                        new Date().getMonth() === currentMonth && 
                        new Date().getFullYear() === currentYear;
        
        let dayClass = 'calendar-day';
        if (isToday) dayClass += ' today';
        
        html += `<td class="${dayClass}">
            <div class="calendar-day-number">${dayCount}</div>`;
        
        // Add status indicators
        if (statuses.length > 0) {
            html += '<div class="mt-1">';
            statuses.forEach(status => {
                const count = dayAttendances.filter(a => a.status === status).length;
                const statusClass = getStatusClass(status);
                html += `<span class="badge bg-${statusClass} me-1 mb-1" title="${status}: ${count}">
                    ${status.charAt(0)}${count > 1 ? `(${count})` : ''}
                </span>`;
            });
            html += '</div>';
        }
        
        html += '</td>';
        dayCount++;
    }
    
    // Close the last row if needed
    if (totalCells > 0) html += '</tr>';
    
    // Close the table and return the HTML
    return html + `</tbody></table></div>`;
}

// Navigation and other utility functions
function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    
    $('#monthSelector').val(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
    loadMonthlyCalendar();
}

// Export functions
async function exportToExcel() {
    try {
        // Get the current date for the filename
        const today = new Date().toISOString().split('T')[0];
        const filename = `attendance_report_${today}.xlsx`;
        
        // Get all the data from the table
        const data = [];
        const headers = [];
        
        // Get headers
        $('#dailyTable thead th').each(function() {
            headers.push($(this).text().trim());
        });
        
        // Get rows data
        $('#dailyTable tbody tr').each(function() {
            const row = [];
            $(this).find('td').each(function() {
                // Get text content, remove any HTML tags
                let text = $(this).text().trim();
                // Clean up the status (remove extra spaces and newlines)
                text = text.replace(/\s+/g, ' ').trim();
                row.push(text);
            });
            if (row.length > 0) {
                data.push(row);
            }
        });
        
        if (data.length === 0) {
            showMessage('No data to export', 'warning');
            return;
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Convert data to worksheet
        const ws_data = [
            headers,
            ...data
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
        
        // Generate Excel file and trigger download
        XLSX.writeFile(wb, filename);
        
        showMessage('Export to Excel completed successfully', 'success');
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showMessage('Error exporting to Excel: ' + error.message, 'danger');
    }
}

async function exportToPdf() {
    try {
        // Get the current date for the filename
        const today = new Date().toISOString().split('T')[0];
        const filename = `attendance_report_${today}.pdf`;
        
        // Get all the data from the table
        const headers = [];
        const rows = [];
        
        // Get headers
        $('#dailyTable thead th').each(function() {
            headers.push({
                header: $(this).text().trim(),
                dataKey: $(this).data('field') || $(this).text().trim().toLowerCase().replace(/\s+/g, '_')
            });
        });
        
        // Get rows data
        $('#dailyTable tbody tr').each(function() {
            const row = {};
            $(this).find('td').each(function(index) {
                const header = headers[index]?.header || `col_${index}`;
                // Get text content, remove any HTML tags
                let text = $(this).text().trim();
                // Clean up the text (remove extra spaces and newlines)
                text = text.replace(/\s+/g, ' ').trim();
                row[headers[index]?.dataKey || `col_${index}`] = text;
            });
            if (Object.keys(row).length > 0) {
                rows.push(row);
            }
        });
        
        if (rows.length === 0) {
            showMessage('No data to export', 'warning');
            return;
        }
        
        // Create a new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape'
        });
        
        // Add title
        doc.setFontSize(18);
        doc.text('Attendance Report', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        // Get current date and time
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        // Add date and time
        doc.text(`Generated on: ${dateStr} at ${timeStr}`, 14, 30);
        
        // Convert headers to autoTable format
        const columns = headers.map(h => ({
            header: h.header,
            dataKey: h.dataKey
        }));
        
        // Add the table
        doc.autoTable({
            head: [columns.map(col => col.header)],
            body: rows.map(row => columns.map(col => row[col.dataKey] || '')),
            startY: 40,
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak',
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                lineWidth: 0.1
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 40 }
        });
        
        // Add page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width - 30,
                doc.internal.pageSize.height - 10
            );
        }
        
        // Save the PDF
        doc.save(filename);
        
        showMessage('PDF exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        showMessage('Error exporting to PDF: ' + error.message, 'danger');
    }
}

async function generateEmployeeReport() {
    try {
        console.log('Starting employee report generation...');
        const employeeId = $('#employeeSelect').val();
        const monthYear = $('#employeeMonth').val();
        
        console.log('Selected values:', { employeeId, monthYear });
        
        if (!employeeId) {
            const errorMsg = 'Please select an employee';
            console.warn(errorMsg);
            showMessage(errorMsg, 'warning');
            return;
        }
        
        if (!monthYear) {
            const errorMsg = 'Please select a month and year';
            console.warn(errorMsg);
            showMessage(errorMsg, 'warning');
            return;
        }
        
        // Verify employee exists
        try {
            const employeeDoc = await db.collection('employees').doc(employeeId).get();
            if (!employeeDoc.exists) {
                const errorMsg = 'Selected employee not found';
                console.error(errorMsg);
                showMessage(errorMsg, 'danger');
                return;
            }
            console.log('Employee found:', employeeDoc.data().name);
        } catch (error) {
            console.error('Error verifying employee:', error);
            showMessage('Error verifying employee: ' + error.message, 'danger');
            return;
        }
        
        // Show loading state
        const reportContainer = $('#employeeReport');
        console.log('Report container found:', reportContainer.length > 0);
        reportContainer.html(loadingSpinner('Generating report...'));
        
        // Debug: Log the selected values
        console.log('Selected employee ID:', employeeId);
        console.log('Selected month/year:', monthYear);
        
        // Parse the selected month and year
        const [year, month] = monthYear.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        
        console.log('Generating report for:', { employeeId, startDate, endDate });
        
        // First, get all attendance records for the date range
        console.log('Fetching attendance records for date range:', { startDate, endDate });
        let query = db.collection('attendance')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);
            
        const snapshot = await query.get();
        console.log('Total documents found in date range:', snapshot.size);
        
        // Then filter by employee ID in memory
        let filteredDocs = [];
        let foundMatchingEmployee = false;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Processing document:', { 
                docId: doc.id, 
                employeeId: data.employeeId, 
                date: data.date,
                status: data.status
            });
            
            if (data.employeeId === employeeId) {
                console.log('Document matches employee filter');
                foundMatchingEmployee = true;
                filteredDocs.push({
                    id: doc.id,
                    ...data
                });
            }
        });
        
        console.log('Filtered documents count:', filteredDocs.length);
        console.log('Found matching employee in any document:', foundMatchingEmployee);
        
        // Sort by date
        filteredDocs.sort((a, b) => a.date.localeCompare(b.date));
        
        if (filteredDocs.length === 0) {
            console.log('No matching documents found for:', { 
                employeeId, 
                startDate, 
                endDate,
                totalDocsProcessed: snapshot.size,
                foundMatchingEmployee
            });
            
            let message = 'No attendance records found for the selected employee and period.';
            if (snapshot.size > 0 && !foundMatchingEmployee) {
                message += ' Found records for other employees, but none for the selected employee.';
            } else if (snapshot.size === 0) {
                message += ' No attendance records found for the selected date range.';
            }
            
            reportContainer.html(`
                <div class="alert alert-warning">
                    <h5>No Records Found</h5>
                    <p>${message}</p>
                    <p class="mb-0 small">Checked ${snapshot.size} records from ${startDate} to ${endDate}.</p>
                </div>
            `);
            return;
        }
        
        // Process the data
        const attendanceData = [];
        const summary = {
            present: 0,
            absent: 0,
            leave: 0,
            wfh: 0,
            do: 0,
            off: 0
        };
        
        filteredDocs.forEach(doc => {
            attendanceData.push({
                date: doc.date,
                status: doc.status || 'Absent',
                time: doc.timestamp ? (doc.timestamp.toDate ? doc.timestamp.toDate().toLocaleTimeString() : new Date(doc.timestamp).toLocaleTimeString()) : 'N/A',
                comment: doc.comment || ''
            });
            
            // Update summary
            const status = doc.status?.toLowerCase() || 'absent';
            if (status in summary) {
                summary[status]++;
            }
        });
        
        // Get employee details
        const employeeDoc = await db.collection('employees').doc(employeeId).get();
        const employee = employeeDoc.data();
        
        // Generate the report HTML
        const reportHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0">
                        ${employee?.name || 'Employee'}'s Attendance Report - 
                        ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h5>
                </div>
                <div class="card-body">
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h6 class="card-title text-muted">Present</h6>
                                    <h3 class="text-success">${summary.present}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h6 class="card-title text-muted">Absent</h6>
                                    <h3 class="text-danger">${summary.absent}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h6 class="card-title text-muted">Leave</h6>
                                    <h3 class="text-warning">${summary.leave}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h6 class="card-title text-muted">WFH</h6>
                                    <h3 class="text-info">${summary.wfh}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="table table-striped table-hover" id="employeeReportTable">
                            <thead class="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                    <th>Comments</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${attendanceData.map(record => `
                                    <tr>
                                        <td>${new Date(record.date).toLocaleDateString()}</td>
                                        <td><span class="badge bg-${getStatusClass(record.status)}">${record.status}</span></td>
                                        <td>${record.time}</td>
                                        <td>${record.comment || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-3 text-end">
                        <button class="btn btn-primary me-2" onclick="exportEmployeeReportToExcel()">
                            <i class="bi bi-file-earmark-excel"></i> Export to Excel
                        </button>
                        <button class="btn btn-danger" onclick="exportEmployeeReportToPdf()">
                            <i class="bi bi-file-earmark-pdf"></i> Export to PDF
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        reportContainer.html(reportHTML);
        
        // Initialize DataTable if not already initialized
        if (!$.fn.DataTable.isDataTable('#employeeReportTable')) {
            $('#employeeReportTable').DataTable({
                pageLength: 10,
                order: [[0, 'asc']],
                dom: 'Bfrtip',
                buttons: [
                    'copy', 'csv', 'excel', 'pdf', 'print'
                ]
            });
        }
        
    } catch (error) {
        console.error('Error generating employee report:', error);
        $('#employeeReportContainer').html(`
            <div class="alert alert-danger">
                <h5>Error generating report</h5>
                <p>${error.message || 'An error occurred while generating the report'}</p>
            </div>
        `);
    }
}

// Export functions for employee report
async function exportEmployeeReportToExcel() {
    try {
        const table = $('#employeeReportTable').DataTable();
        const data = table.data().toArray();
        
        // Prepare data for Excel
        const excelData = [
            ['Date', 'Status', 'Time', 'Comments']
        ];
        
        data.forEach(row => {
            excelData.push([
                row[0], // Date
                row[1].replace(/<[^>]*>/g, ''), // Status (remove HTML tags)
                row[2], // Time
                row[3]  // Comments
            ]);
        });
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
        
        // Generate Excel file
        const employeeName = $('.card-header h5').text().split("'")[0].trim();
        const monthYear = $('.card-header h5').text().split('-')[1].trim();
        XLSX.writeFile(wb, `${employeeName} Attendance Report - ${monthYear}.xlsx`);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showMessage('Error exporting to Excel: ' + error.message, 'danger');
    }
}

async function exportEmployeeReportToPdf() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape'
        });
        
        // Add title
        const title = $('.card-header h5').text();
        doc.setFontSize(16);
        doc.text(title, 15, 15);
        
        // Add generation date
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 25);
        
        // Get table data
        const table = $('#employeeReportTable').DataTable();
        const data = table.data().toArray();
        
        // Prepare data for PDF
        const pdfData = [
            ['Date', 'Status', 'Time', 'Comments']
        ];
        
        data.forEach(row => {
            pdfData.push([
                row[0], // Date
                row[1].replace(/<[^>]*>/g, ''), // Status (remove HTML tags)
                row[2], // Time
                row[3]  // Comments
            ]);
        });
        
        // Add table to PDF
        doc.autoTable({
            head: [pdfData[0]],
            body: pdfData.slice(1),
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { top: 35 }
        });
        
        // Add page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width - 30,
                doc.internal.pageSize.height - 10
            );
        }
        
        // Save the PDF
        const employeeName = title.split("'")[0].trim();
        const monthYear = title.split('-')[1].trim();
        doc.save(`${employeeName} Attendance Report - ${monthYear}.pdf`);
        
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        showMessage('Error exporting to PDF: ' + error.message, 'danger');
    }
}

// Load employees for the employee dropdown
async function loadEmployeesForReport() {
    try {
        const employeeSelect = $('#employeeSelect');
        console.log('Loading employees for dropdown...');
        employeeSelect.html('<option value="" disabled selected>Select Employee</option>');
        
        const snapshot = await db.collection('employees').orderBy('name').get();
        console.log('Total employees found:', snapshot.size);
        
        if (snapshot.empty) {
            console.warn('No employees found in the database');
            showMessage('No employees found. Please add employees first.', 'warning');
            return;
        }
        
        snapshot.forEach(doc => {
            const employee = doc.data();
            console.log('Adding employee to dropdown:', { id: doc.id, name: employee.name });
            employeeSelect.append(`<option value="${doc.id}">${employee.name} (${employee.employeeId || 'N/A'})</option>`);
        });
        
        // Set current month as default
        const now = new Date();
        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        $('#employeeMonth').val(defaultMonth);
        console.log('Set default month to:', defaultMonth);
        
        // Connect the generate button
        console.log('Connecting generate button...');
        $('#generateReport').off('click').on('click', function() {
            console.log('Generate button clicked');
            generateEmployeeReport().catch(console.error);
        });
        
        console.log('Employee dropdown initialized');
        
    } catch (error) {
        console.error('Error loading employees:', error);
        showMessage('Error loading employee list: ' + error.message, 'danger');
    }
}

// Initialize the report page when the tab is shown
$('a[data-bs-toggle="tab"][href="#employee"]').on('shown.bs.tab', function () {
    loadEmployeesForReport();
});

// Make functions available globally
window.navigateMonth = navigateMonth;
window.exportEmployeeReportToExcel = exportEmployeeReportToExcel;
window.exportEmployeeReportToPdf = exportEmployeeReportToPdf;
