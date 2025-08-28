// Recasting Loan Calculator

function createRecastingLoanFields() {
    // Create common fields container
    createCommonFieldsContainer('recasting');
    
    // Create tab-specific fields container
    const tabContainer = document.getElementById('tabSpecificFieldsContainer');
    tabContainer.innerHTML = '';
    
    // Recasting loan has extra payment as tab-specific field
    const extraPaymentField = createSynchronizedInputElement('extraPayment');
    if (extraPaymentField) {
        tabContainer.appendChild(extraPaymentField);
        const inputElement = extraPaymentField.querySelector('input');
        if (inputElement) {
            inputElement.addEventListener('input', calculateRecastingLoan);
        }
    }
    
    // Add event listeners to common fields
    addCommonFieldEventListeners(calculateRecastingLoan);
    
    // Calculate initial values
    setTimeout(calculateRecastingLoan, 100);
}

function calculateRecastingLoan() {
    const values = getFormValues(); // Use standard form values function
    
    if (!values.loanAmount || !values.interestRate || !values.loanTerm) {
        return;
    }

    const schedule = generateRecastingAmortizationSchedule(
        values.loanAmount,
        values.interestRate,
        values.loanTerm * 12,
        values.startDate,
        values.firstPaymentDate,
        values.paymentDueDay,
        values.extraPayment
    );
    
    currentSchedule = schedule;
    updateSummary(schedule);
    updateChart(schedule);
    updateScheduleTable(schedule);
}

function getRecastingFormValues() {
    return {
        remainingBalance: getNumericValue('remainingBalance'),
        interestRate: parseFloat(document.getElementById('interestRate')?.value || 0),
        remainingTerm: parseInt(document.getElementById('remainingTerm')?.value || 0),
        lumpSum: getNumericValue('lumpSum'),
        recastFee: getNumericValue('recastFee'),
        startDate: document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0],
        firstPaymentDate: document.getElementById('firstPaymentDate')?.value || (() => {
            const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
            const start = new Date(startDate);
            const firstPayment = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            return firstPayment.toISOString().split('T')[0];
        })(),
        extraPayment: getNumericValue('extraPayment')
    };
}

function generateRecastingAmortizationSchedule(principal, annualRate, months, startDate, firstPaymentDate, paymentDueDay, extraPayment = 0) {
    const schedule = [];
    let balance = principal;
    const monthlyRate = annualRate / 100 / 12;
    
    // Parse first payment date to avoid timezone issues
    const firstDateParts = firstPaymentDate.split('-');
    let currentDate = new Date(parseInt(firstDateParts[0]), parseInt(firstDateParts[1]) - 1, parseInt(firstDateParts[2]));
    
    const startDateDay = new Date(startDate).getDate();
    let totalInterest = 0;
    let totalPrincipal = 0;
    
    // Calculate base monthly payment
    const basePayment = calculateMonthlyPayment(principal, annualRate, months);
    
    for (let month = 1; month <= months && balance > 0; month++) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = Math.min(basePayment - interestPayment + extraPayment, balance);
        
        const totalPayment = interestPayment + principalPayment;
        balance -= principalPayment;
        
        totalInterest += interestPayment;
        totalPrincipal += principalPayment;
        
        schedule.push({
            month,
            date: formatDate(currentDate),
            payment: totalPayment,
            principal: principalPayment,
            interest: interestPayment,
            balance: Math.max(0, balance),
            totalInterest,
            totalPrincipal,
            rate: annualRate
        });
        
        // Calculate next payment date based on payment due day setting
        if (month < months && balance > 0) {
            // Use the same parsed first date to avoid timezone issues
            let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            
            // Set the day based on payment due day setting
            let dayOfMonth;
            switch (paymentDueDay) {
                case 'first':
                    dayOfMonth = 1;
                    break;
                case 'fifth':
                    dayOfMonth = 5;
                    break;
                case 'tenth':
                    dayOfMonth = 10;
                    break;
                case 'fifteenth':
                    dayOfMonth = 15;
                    break;
                case 'same':
                default:
                    dayOfMonth = currentDate.getDate();
                    break;
            }
            
            // Ensure the day doesn't exceed the month's days
            const daysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            dayOfMonth = Math.min(dayOfMonth, daysInMonth);
            
            nextDate.setDate(dayOfMonth);
            currentDate = nextDate;
        }
        
        if (balance <= 0) break;
    }
    
    return schedule;
}