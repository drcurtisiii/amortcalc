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
    const values = getRecastingFormValues();
    
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
    // Use the same form values function as other loan types, but get correct field values
    const loanAmountValue = getNumericValue('loanAmount') || 0;
    const interestRateValue = parseFloat(document.getElementById('interestRate')?.value || 0);
    
    // Get loan term from years and months fields
    const loanTermYears = parseInt(document.getElementById('loanTermYears')?.value || 0);
    const loanTermMonths = parseInt(document.getElementById('loanTermMonths')?.value || 0);
    const totalLoanTerm = loanTermYears + (loanTermMonths / 12);
    
    return {
        loanAmount: loanAmountValue,
        interestRate: interestRateValue,
        loanTerm: totalLoanTerm,
        startDate: document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0],
        firstPaymentDate: document.getElementById('firstPaymentDate')?.value || (() => {
            const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
            const start = new Date(startDate);
            const firstPayment = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            return firstPayment.toISOString().split('T')[0];
        })(),
        paymentDueDay: document.getElementById('paymentDueDay')?.value || 'same',
        extraPayment: getNumericValue('extraPayment') || 0
    };
}

function generateRecastingAmortizationSchedule(principal, annualRate, months, startDate, firstPaymentDate, paymentDueDay, extraPayment = 0) {
    const schedule = [];
    let balance = principal;
    const monthlyRate = annualRate / 100 / 12;
    
    // Parse first payment date to avoid timezone issues
    const firstDateParts = firstPaymentDate.split('-');
    let currentDate = new Date(parseInt(firstDateParts[0]), parseInt(firstDateParts[1]) - 1, parseInt(firstDateParts[2]));
    // Preserve the original desired day-of-month from the first payment date
    const referenceDay = currentDate.getDate();
    
    // Track anniversary month and year for recasting
    const startDateParts = startDate.split('-');
    const startYear = parseInt(startDateParts[0]);
    const startMonth = parseInt(startDateParts[1]); // 1-based month
    
    let totalInterest = 0;
    let totalPrincipal = 0;
    let yearlyExtraPaymentTotal = 0;
    
    // Calculate initial base monthly payment
    let basePayment = calculateMonthlyPayment(principal, annualRate, months);
    let remainingMonths = months;
    
    for (let month = 1; month <= months && balance > 0; month++) {
        const interestPayment = balance * monthlyRate;
        
        // Check if this is an anniversary month for recasting
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // Convert to 1-based
        const isAnniversary = (currentMonth === startMonth) && (currentYear > startYear);
        
        let principalPayment;
        let isRecastMonth = false;
        
        // If it's an anniversary and we have extra payments from the previous year, recast
        if (isAnniversary && yearlyExtraPaymentTotal > 0) {
            // Apply the accumulated extra payments as a lump sum principal reduction
            const lumpSumReduction = Math.min(yearlyExtraPaymentTotal, balance);
            balance -= lumpSumReduction;
            
            // Recalculate monthly payment for remaining term
            remainingMonths = months - month + 1;
            if (remainingMonths > 0 && balance > 0) {
                basePayment = calculateMonthlyPayment(balance, annualRate, remainingMonths);
            }
            
            // Reset yearly extra payment counter
            yearlyExtraPaymentTotal = 0;
            isRecastMonth = true;
            
            // Regular payment calculation after recasting
            principalPayment = Math.min(basePayment - interestPayment, balance);
        } else {
            // Regular month - apply base payment plus extra payment
            principalPayment = Math.min(basePayment - interestPayment, balance);
            
            // Track extra payments for annual recasting
            if (extraPayment > 0) {
                const extraPrincipalPayment = Math.min(extraPayment, balance - principalPayment);
                principalPayment += extraPrincipalPayment;
                yearlyExtraPaymentTotal += extraPrincipalPayment;
            }
        }
        
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
            rate: annualRate,
            isRecastMonth: isRecastMonth
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
                    // Always target the original first-payment day; fallback handled below
                    dayOfMonth = referenceDay;
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
