// Field Synchronization System
// Manages synchronization of common fields across all loan types

// Global storage for shared field values
window.sharedFieldValues = {
    loanAmount: 250000,
    interestRate: 6.5,
    loanTerm: 30,
    amortizationPeriod: 30, // Used by balloon loans
    extraPayment: 0,
    startDate: new Date().toISOString().split('T')[0]
};

// Common field definitions that are shared across loan types
const SHARED_FIELDS = {
    loanAmount: { id: 'loanAmount', type: 'number', label: 'Loan Amount ($)', min: 0, max: null, step: 1 },
    interestRate: { id: 'interestRate', type: 'number', label: 'Interest Rate (%)', min: 0, max: 50, step: 0.125 },
    loanTerm: { id: 'loanTerm', type: 'number', label: 'Loan Term (years)', min: 1, max: 50, step: 1 },
    amortizationPeriod: { id: 'amortizationPeriod', type: 'number', label: 'Amortization Period (years)', min: 1, max: 50, step: 1 },
    extraPayment: { id: 'extraPayment', type: 'number', label: 'Extra Monthly Payment ($)', min: 0, max: null, step: 1 },
    startDate: { id: 'startDate', type: 'date', label: 'Start Date' }
};

// Function to create a synchronized input element
function createSynchronizedInputElement(fieldKey, defaultValue = null, customLabel = null) {
    const fieldDef = SHARED_FIELDS[fieldKey];
    if (!fieldDef) {
        console.error(`Unknown shared field: ${fieldKey}`);
        return null;
    }
    
    const label = customLabel || fieldDef.label;
    const value = defaultValue !== null ? defaultValue : window.sharedFieldValues[fieldKey];
    
    const element = createInputElement(
        fieldDef.id,
        fieldDef.type,
        label,
        value,
        '',
        fieldDef.min,
        fieldDef.max,
        fieldDef.step
    );
    
    // Add synchronization listener
    const input = element.querySelector('input');
    input.addEventListener('input', function() {
        synchronizeField(fieldKey, this.value);
    });
    
    return element;
}

// Function to synchronize a field value across all loan types
function synchronizeField(fieldKey, newValue) {
    // Update the shared storage
    if (fieldKey === 'loanTerm' && window.sharedFieldValues.hasOwnProperty('amortizationPeriod')) {
        // Keep loanTerm and amortizationPeriod in sync
        window.sharedFieldValues.loanTerm = newValue;
        window.sharedFieldValues.amortizationPeriod = newValue;
    } else if (fieldKey === 'amortizationPeriod' && window.sharedFieldValues.hasOwnProperty('loanTerm')) {
        // Keep amortizationPeriod and loanTerm in sync
        window.sharedFieldValues.amortizationPeriod = newValue;
        window.sharedFieldValues.loanTerm = newValue;
    } else {
        window.sharedFieldValues[fieldKey] = newValue;
    }
    
    // Update all visible fields with the same ID
    const targetIds = [fieldKey];
    if (fieldKey === 'loanTerm') {
        targetIds.push('amortizationPeriod');
    } else if (fieldKey === 'amortizationPeriod') {
        targetIds.push('loanTerm');
    }
    
    targetIds.forEach(targetId => {
        const elements = document.querySelectorAll(`input[id="${targetId}"]`);
        elements.forEach(element => {
            if (element.value !== newValue) {
                element.value = newValue;
                // Trigger input event to update calculations
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });
}

// Function to get current shared field values
function getSharedFieldValues() {
    return { ...window.sharedFieldValues };
}

// Function to update shared values from borrower fields (which persist across tab changes)
function syncFromBorrowerFields() {
    const borrowers = document.getElementById('borrowers');
    if (borrowers && borrowers.value) {
        // Borrowers field is handled separately and doesn't need sync
    }
}

// Initialize field synchronization when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up borrower field to persist across tab changes
    const borrowerContainer = document.querySelector('.borrower-input');
    if (borrowerContainer) {
        const borrowerInput = borrowerContainer.querySelector('input');
        if (borrowerInput) {
            borrowerInput.addEventListener('input', function() {
                window.borrowerValue = this.value;
            });
        }
    }
});
