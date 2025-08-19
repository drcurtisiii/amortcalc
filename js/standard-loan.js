// Standard Loan Calculator

function createStandardLoanFields() {
    const fieldsContainer = document.getElementById('inputFields');
    fieldsContainer.innerHTML = '';
    
    // Create synchronized input fields
    const fields = [
        createSynchronizedInputElement('loanAmount'),
        createSynchronizedInputElement('interestRate'),
        createSynchronizedInputElement('loanTerm'),
        createSynchronizedInputElement('startDate'),
        createSynchronizedInputElement('extraPayment')
    ];
    
    fields.forEach(field => {
        if (field) {
            fieldsContainer.appendChild(field);
            const input = field.querySelector('input');
            input.addEventListener('input', calculateStandardLoan);
        }
    });
    
    // Calculate initial values
    setTimeout(calculateStandardLoan, 100);
}

function calculateStandardLoan() {
    const values = getFormValues();
    
    if (!values.loanAmount || !values.interestRate || !values.loanTerm) {
        return;
    }
    
    const schedule = generateStandardAmortizationSchedule(
        values.loanAmount,
        values.interestRate,
        values.loanTerm * 12,
        values.startDate,
        values.extraPayment
    );
    
    currentSchedule = schedule;
    updateSummary(schedule);
    updateChart(schedule);
    updateScheduleTable(schedule);
}

function generateStandardAmortizationSchedule(principal, annualRate, months, startDate, extraPayment = 0) {
    const schedule = [];
    let balance = principal;
    const monthlyRate = annualRate / 100 / 12;
    let currentDate = new Date(startDate);
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
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        
        if (balance <= 0) break;
    }
    
    return schedule;
}