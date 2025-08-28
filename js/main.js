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

// Override updateScheduleTable for ARM loans
function updateScheduleTable(schedule) {
    if (currentLoanType === 'arm') {
        updateARMScheduleTable(schedule);
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
    }
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