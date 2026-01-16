// Main application logic

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set up loan type button listeners
    const loanTypeButtons = document.querySelectorAll('.loan-type-btn');
    loanTypeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const loanType = e.target.dataset.type;
            switchLoanType(loanType);
        });
    });
    
    // Set up action button listeners
    document.getElementById('printBtn').addEventListener('click', generatePDF);
    document.getElementById('saveBtn').addEventListener('click', saveCalculationData);
    document.getElementById('loadFile').addEventListener('change', handleFileLoad);
    const downloadExcelBtn = document.getElementById('downloadExcelBtn');
    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', downloadScheduleToExcel);
        setScheduleDownloadEnabled([]);
    }
    
    // Initialize with standard loan
    switchLoanType('standard');
}

function switchLoanType(loanType) {
    // Save borrower field value before switching
    const borrowerInput = document.getElementById('caseName');
    const borrowerValue = borrowerInput ? borrowerInput.value : '';
    
    // Update current loan type
    currentLoanType = loanType;
    
    // Update button states
    document.querySelectorAll('.loan-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${loanType}"]`).classList.add('active');
    
    // Clear existing schedule and hide sections
    currentSchedule = [];
    document.getElementById('summarySection').style.display = 'none';
    document.getElementById('chartSection').style.display = 'none';
    setScheduleDownloadEnabled(currentSchedule);
    
    // Reset schedule table header (remove ARM rate column if it exists)
    const tableHeader = document.querySelector('#scheduleTable thead tr');
    const rateHeader = tableHeader.querySelector('.rate-header');
    if (rateHeader) {
        rateHeader.remove();
    }
    
    // Create appropriate input fields based on loan type
    switch (loanType) {
        case 'standard':
            createStandardLoanFields();
            break;
        case 'recasting':
            createRecastingLoanFields();
            break;
        case 'balloon':
            createBalloonLoanFields();
            break;
        case 'arm':
            createARMLoanFields();
            break;
        case 'desired-payment':
            createDesiredPaymentLoanFields();
            break;
        case 'payoff-calculator':
            createPayoffCalculatorFields();
            break;
        default:
            console.error('Unknown loan type:', loanType);
    }
    
    // Restore borrower field value after creating new fields
    setTimeout(() => {
        const restoredBorrowerInput = document.getElementById('caseName');
        if (restoredBorrowerInput && borrowerValue) {
            restoredBorrowerInput.value = borrowerValue;
        }
    }, 50);
}

function calculateCurrentLoanType() {
    switch (currentLoanType) {
        case 'standard':
            calculateStandardLoan();
            break;
        case 'recasting':
            calculateRecastingLoan();
            break;
        case 'balloon':
            calculateBalloonLoan();
            break;
        case 'arm':
            calculateARMLoan();
            break;
        case 'desired-payment':
            calculateDesiredPaymentLoan();
            break;
        case 'payoff-calculator':
            calculatePayoffCalculator();
            break;
    }
}

function downloadScheduleToExcel() {
    if (!Array.isArray(currentSchedule) || currentSchedule.length === 0) {
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded. Please try again.');
        return;
    }
    
    const includeRate = !!document.querySelector('#scheduleTable thead .rate-header');
    const headers = includeRate
        ? ['Month', 'Date', 'Payment', 'Principal', 'Interest', 'Balance', 'Rate (%)']
        : ['Month', 'Date', 'Payment', 'Principal', 'Interest', 'Balance'];
    
    const rows = currentSchedule.map(row => {
        const rowData = [
            row.month,
            row.date,
            toExcelNumber(row.payment, 2),
            toExcelNumber(row.principal, 2),
            toExcelNumber(row.interest, 2),
            toExcelNumber(row.balance, 2)
        ];
        
        if (includeRate) {
            rowData.push(toExcelNumber(row.rate, 3));
        }
        
        return rowData;
    });
    
    const tableData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);
    applySheetFormatting(worksheet, tableData, includeRate);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Amortization');
    XLSX.writeFile(workbook, getScheduleExportFilename(), { bookType: 'xlsx', cellStyles: true });
}

function applySheetFormatting(worksheet, tableData, includeRate) {
    applyColumnWidths(worksheet, tableData, includeRate);
    applyCellStyles(worksheet, includeRate);
}

function applyColumnWidths(worksheet, tableData, includeRate) {
    const columnWidths = tableData[0].map((header, columnIndex) => {
        let maxLength = String(header || '').length;
        
        for (let rowIndex = 1; rowIndex < tableData.length; rowIndex++) {
            const value = tableData[rowIndex][columnIndex];
            const displayValue = getExcelDisplayValue(value, columnIndex, includeRate);
            maxLength = Math.max(maxLength, displayValue.length);
        }
        
        return Math.min(Math.max(maxLength + 2, 10), 40);
    });
    
    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
}

function getExcelDisplayValue(value, columnIndex, includeRate) {
    if (value === null || value === undefined) {
        return '';
    }
    
    if (columnIndex >= 2 && columnIndex <= 5 && Number.isFinite(value)) {
        return formatCurrency(value);
    }
    
    if (includeRate && columnIndex === 6 && Number.isFinite(value)) {
        return value.toFixed(3);
    }
    
    return String(value);
}

function applyCellStyles(worksheet, includeRate) {
    if (!worksheet['!ref']) {
        return;
    }
    
    const font = { name: 'Work Sans', sz: 11 };
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const address = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[address];
            if (!cell) {
                continue;
            }
            
            cell.s = cell.s ? { ...cell.s, font } : { font };
            
            if (row > 0 && col >= 2 && col <= 5 && typeof cell.v === 'number') {
                cell.z = '$#,##0.00';
            }
        }
    }
}

function setScheduleDownloadEnabled(schedule) {
    const downloadBtn = document.getElementById('downloadExcelBtn');
    if (!downloadBtn) {
        return;
    }
    
    const hasRows = Array.isArray(schedule) && schedule.length > 0;
    downloadBtn.disabled = !hasRows;
}

function toExcelNumber(value, decimals) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return '';
    }
    
    return Number(numberValue.toFixed(decimals));
}

function getScheduleExportFilename() {
    const caseName = document.getElementById('caseName')?.value || '';
    const dateStamp = new Date().toISOString().split('T')[0];
    const baseName = caseName ? `Amortization Schedule - ${caseName}` : 'Amortization Schedule';
    return `${sanitizeFileName(baseName)} ${dateStamp}.xlsx`;
}

function sanitizeFileName(value) {
    return value.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim();
}

// Override updateScheduleTable for ARM and Recasting loans
function updateScheduleTable(schedule) {
    if (currentLoanType === 'arm') {
        updateARMScheduleTable(schedule);
        setScheduleDownloadEnabled(schedule);
    } else if (currentLoanType === 'recasting') {
        updateRecastingScheduleTable(schedule);
        setScheduleDownloadEnabled(schedule);
    } else {
        // Standard schedule table update
        const tbody = document.getElementById('scheduleBody');
        tbody.innerHTML = '';
        
        schedule.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.month}</td>
                <td>${row.date}</td>
                <td class="text-right">${formatCurrency(row.payment)}</td>
                <td class="text-right">${formatCurrency(row.principal)}</td>
                <td class="text-right">${formatCurrency(row.interest)}</td>
                <td class="text-right">${formatCurrency(row.balance)}</td>
            `;
            tbody.appendChild(tr);
        });
        setScheduleDownloadEnabled(schedule);
    }
}

// Update schedule table with recasting month highlighting
function updateRecastingScheduleTable(schedule) {
    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';
    
    schedule.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        // Check if this is a recast month (anniversary month)
        const isRecastMonth = row.isRecastMonth || false;
        
        // Apply recast-month class for highlighting
        if (isRecastMonth) {
            tr.classList.add('recast-month');
        }
        
        tr.innerHTML = `
            <td>${row.month}</td>
            <td>${row.date}</td>
            <td class="text-right">${formatCurrency(row.payment)}</td>
            <td class="text-right">${formatCurrency(row.principal)}</td>
            <td class="text-right">${formatCurrency(row.interest)}</td>
            <td class="text-right">${formatCurrency(row.balance)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    loadCalculationData(file);
    
    // Clear the input so the same file can be loaded again
    event.target.value = '';
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+P or Cmd+P for print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        generatePDF();
    }
    
    // Ctrl+S or Cmd+S for save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCalculationData();
    }
});

// Initialize with default values
currentLoanType = 'standard';
currentSchedule = [];
