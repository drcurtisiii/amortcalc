// Promissory Note Templates and Functionality

// Add event listener for Note button
document.addEventListener('DOMContentLoaded', function() {
    const noteBtn = document.getElementById('noteBtn');
    if (noteBtn) {
        noteBtn.addEventListener('click', openNoteModal);
    }
    
    // Add event listeners for note type buttons
    const noteTypeButtons = document.querySelectorAll('.note-type-btn');
    noteTypeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const noteType = this.dataset.type;
            generatePromissoryNote(noteType);
            
            // Update button states
            noteTypeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Add event listeners for action buttons
    const copyBtn = document.getElementById('copyNoteBtn');
    const selectAllBtn = document.getElementById('selectAllNoteBtn');
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copyNoteToClipboard);
    }
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllNoteText);
    }
});

function openNoteModal() {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'flex';
        // Clear any previous selection
        const noteTypeButtons = document.querySelectorAll('.note-type-btn');
        noteTypeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Hide language container initially
        const languageContainer = document.getElementById('noteLanguageContainer');
        if (languageContainer) {
            languageContainer.style.display = 'none';
        }
    }
}

function closeNoteModal() {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function generatePromissoryNote(noteType) {
    const values = getCurrentLoanValues();
    let noteText = '';
    let title = '';
    
    switch (noteType) {
        case 'standard':
            title = 'Standard Promissory Note';
            noteText = generateStandardNoteText(values);
            break;
        case 'recasting':
            title = 'Recasting Promissory Note';
            noteText = generateRecastingNoteText(values);
            break;
        case 'balloon':
            title = 'Balloon Promissory Note';
            noteText = generateBalloonNoteText(values);
            break;
        case 'arm':
            title = 'Adjustable Rate Promissory Note';
            noteText = generateARMNoteText(values);
            break;
        case 'desired-payment':
            title = 'Desired Payment Promissory Note';
            noteText = generateDesiredPaymentNoteText(values);
            break;
        default:
            noteText = 'Invalid note type selected.';
    }
    
    // Update the UI
    const titleElement = document.getElementById('noteLanguageTitle');
    const textElement = document.getElementById('noteLanguageText');
    const containerElement = document.getElementById('noteLanguageContainer');
    
    if (titleElement) titleElement.textContent = title;
    if (textElement) textElement.value = noteText;
    if (containerElement) containerElement.style.display = 'block';
}

function getCurrentLoanValues() {
    const caseName = document.getElementById('caseName')?.value || '[BORROWER NAME]';
    const loanAmount = getNumericValue('loanAmount') || 250000;
    const interestRate = parseFloat(document.getElementById('interestRate')?.value) || 6.5;
    const loanTermYears = parseInt(document.getElementById('loanTermYears')?.value) || 30;
    const loanTermMonths = parseInt(document.getElementById('loanTermMonths')?.value) || 0;
    const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
    const firstPaymentDate = document.getElementById('firstPaymentDate')?.value || '';
    
    // Calculate monthly payment for standard loan
    const totalMonths = (loanTermYears * 12) + loanTermMonths;
    const monthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, totalMonths);
    
    // Format first payment date
    let formattedFirstPaymentDate = '[FIRST PAYMENT DATE]';
    if (firstPaymentDate) {
        const fpDate = new Date(firstPaymentDate);
        formattedFirstPaymentDate = fpDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    return {
        borrowerName: caseName,
        principalAmount: loanAmount,
        interestRate: interestRate,
        loanTermYears: loanTermYears,
        loanTermMonths: loanTermMonths,
        totalMonths: totalMonths,
        monthlyPayment: monthlyPayment,
        startDate: startDate,
        firstPaymentDate: formattedFirstPaymentDate,
        maturityDate: calculateMaturityDate(startDate, loanTermYears, loanTermMonths)
    };
}

function calculateMaturityDate(startDate, years, months) {
    const date = new Date(startDate);
    date.setFullYear(date.getFullYear() + years);
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function generateStandardNoteText(values) {
    const paymentDueDay = document.getElementById('paymentDueDay')?.value || 'first';
    const paymentDayText = {
        'first': '1st',
        'fifth': '5th',
        'tenth': '10th',
        'fifteenth': '15th',
        'same': (values.firstPaymentDate !== '[FIRST PAYMENT DATE]') ? new Date(values.firstPaymentDate).getDate().toString() : '[DAY]'
    }[paymentDueDay] || '1st';

    return `PROMISSORY NOTE
(STANDARD LOAN)

Borrower: ${values.borrowerName}                                    ${new Date(values.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Principal Amount: ${formatCurrency(values.principalAmount)}          Made at: Perry, Taylor County, Florida

FOR VALUE RECEIVED, the undersigned ("Borrower"), whose address is 
__________________________________, promises to pay to the order of 
__________________________________ ("Lender"), whose address is 
__________________________________, the principal sum of ${numberToWords(values.principalAmount).toUpperCase()} DOLLARS (${formatCurrency(values.principalAmount)}), together with interest as set forth below.

1. TERMS OF REPAYMENT

☑ OPTION A: STANDARD LOAN

The Principal Balance shall accrue interest at ${values.interestRate} percent (${values.interestRate}%) per annum, amortized over ${values.totalMonths} months, with ${values.totalMonths} consecutive monthly installment payments of ${formatCurrency(values.monthlyPayment)}, each consisting of principal and interest, due on the ${paymentDayText} day of each month, beginning ${values.firstPaymentDate}, until the entire principal balance and all accrued interest is paid in full, with a maturity date of ${values.maturityDate}.

2. INTEREST CALCULATION

Interest shall be calculated on a 365-day year basis and shall accrue daily on the outstanding principal balance.

3. PREPAYMENT

This Note may be prepaid in whole or in part at any time without penalty.

4. LATE CHARGES

If any payment is not received within five (5) days after its due date, the Borrower agrees to pay a late charge of three percent (3%) of the overdue payment amount.

5. DEFAULT

The Borrower shall be in default under this Note upon the occurrence of any of the following events:
- Failure to make any payment when due under this Note
- Breach of any covenant or warranty made in this Note
- Filing of bankruptcy or insolvency proceedings by or against the Borrower
- Death, dissolution, or legal incapacity of the Borrower

6. ACCELERATION

Upon default, the Lender may, at its option, declare the entire unpaid principal balance and all accrued interest immediately due and payable without notice or demand.

7. COLLECTION COSTS

If this Note is placed in the hands of an attorney for collection or enforcement, or if suit is brought for collection or enforcement, the Borrower agrees to pay all reasonable attorneys' fees and costs of collection incurred by the Lender, whether or not suit is actually filed.

8. WAIVER

The Borrower waives presentment, demand, notice of dishonor, protest, and all other demands and notices in connection with the delivery, acceptance, performance, default, or enforcement of this Note.

9. GOVERNING LAW

This Note shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles.

10. SEVERABILITY

If any provision of this Note is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

11. ENTIRE AGREEMENT

This Note constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.

12. SECURITY

☐ This Note is unsecured.
☐ This Note is secured by a ☐ Deed of Trust ☐ Mortgage ☐ Security Agreement dated ______________ 
on the following property: __________________________________

13. SIGNATURES

BORROWER:


_____________________________________                    _______________________
${values.borrowerName}                                                          Dated


ACKNOWLEDGED AND ACCEPTED 
BY LENDER:


_____________________________________                    _______________________
Lender                                                                              Dated`;
}

function generateRecastingNoteText(values) {
    const paymentDueDay = document.getElementById('paymentDueDay')?.value || 'first';
    const paymentDayText = {
        'first': '1st',
        'fifth': '5th',
        'tenth': '10th',
        'fifteenth': '15th',
        'same': (values.firstPaymentDate !== '[FIRST PAYMENT DATE]') ? new Date(values.firstPaymentDate).getDate().toString() : '[DAY]'
    }[paymentDueDay] || '1st';

    const anniversaryDate = new Date(values.startDate);
    anniversaryDate.setFullYear(anniversaryDate.getFullYear() + 1);
    const anniversaryDateText = anniversaryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `PROMISSORY NOTE
(STANDARD LOAN WITH ANNUAL RECASTING)

Borrower: ${values.borrowerName}                                    ${new Date(values.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Principal Amount: ${formatCurrency(values.principalAmount)}          Made at: Perry, Taylor County, Florida

FOR VALUE RECEIVED, the undersigned ("Borrower"), whose address is 
__________________________________, promises to pay to the order of 
__________________________________ ("Lender"), whose address is 
__________________________________, the principal sum of ${numberToWords(values.principalAmount).toUpperCase()} DOLLARS (${formatCurrency(values.principalAmount)}), together with interest as set forth below.

1. TERMS OF REPAYMENT

☑ OPTION B: STANDARD LOAN WITH ANNUAL RECASTING

The Principal Balance shall accrue interest at ${values.interestRate} percent (${values.interestRate}%) per annum, with an initial monthly payment amount of ${formatCurrency(values.monthlyPayment)}, due on the ${paymentDayText} day of each month, beginning ${values.firstPaymentDate}. The payment amount shall be recalculated annually on ${anniversaryDateText} (the anniversary date) based on the then-remaining principal balance, the interest rate in effect, and the remaining term of ${values.totalMonths} months from origination. The Lender shall provide written notice of the new payment amount at least thirty (30) days before each annual recasting date. All payments shall continue until the entire principal balance and all accrued interest is paid in full, with a maturity date of ${values.maturityDate}.

2. INTEREST CALCULATION

Interest shall be calculated on a 365-day year basis and shall accrue daily on the outstanding principal balance.

3. PREPAYMENT

This Note may be prepaid in whole or in part at any time without penalty.

4. LATE CHARGES

If any payment is not received within five (5) days after its due date, the Borrower agrees to pay a late charge of three percent (3%) of the overdue payment amount.

5. DEFAULT

The Borrower shall be in default under this Note upon the occurrence of any of the following events:
- Failure to make any payment when due under this Note
- Breach of any covenant or warranty made in this Note
- Filing of bankruptcy or insolvency proceedings by or against the Borrower
- Death, dissolution, or legal incapacity of the Borrower

6. ACCELERATION

Upon default, the Lender may, at its option, declare the entire unpaid principal balance and all accrued interest immediately due and payable without notice or demand.

7. COLLECTION COSTS

If this Note is placed in the hands of an attorney for collection or enforcement, or if suit is brought for collection or enforcement, the Borrower agrees to pay all reasonable attorneys' fees and costs of collection incurred by the Lender, whether or not suit is actually filed.

8. WAIVER

The Borrower waives presentment, demand, notice of dishonor, protest, and all other demands and notices in connection with the delivery, acceptance, performance, default, or enforcement of this Note.

9. GOVERNING LAW

This Note shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles.

10. SEVERABILITY

If any provision of this Note is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

11. ENTIRE AGREEMENT

This Note constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.

12. SECURITY

☐ This Note is unsecured.
☐ This Note is secured by a ☐ Deed of Trust ☐ Mortgage ☐ Security Agreement dated ______________ 
on the following property: __________________________________

13. SIGNATURES

BORROWER:


_____________________________________                    _______________________
${values.borrowerName}                                                          Dated


ACKNOWLEDGED AND ACCEPTED 
BY LENDER:


_____________________________________                    _______________________
Lender                                                                              Dated`;
}

function generateBalloonNoteText(values) {
    // Get balloon-specific values
    const balloonTermYears = parseInt(document.getElementById('balloonTermYears')?.value) || 5;
    const balloonTermMonths = parseInt(document.getElementById('balloonTermMonths')?.value) || 0;
    const balloonTotalMonths = (balloonTermYears * 12) + balloonTermMonths;
    const isInterestOnly = document.getElementById('isInterestOnly')?.checked || false;
    
    const paymentDueDay = document.getElementById('paymentDueDay')?.value || 'first';
    const paymentDayText = {
        'first': '1st',
        'fifth': '5th',
        'tenth': '10th',
        'fifteenth': '15th',
        'same': (values.firstPaymentDate !== '[FIRST PAYMENT DATE]') ? new Date(values.firstPaymentDate).getDate().toString() : '[DAY]'
    }[paymentDueDay] || '1st';
    
    // Calculate balloon amount
    let balloonBalance = values.principalAmount;
    const monthlyRate = values.interestRate / 100 / 12;
    
    if (!isInterestOnly) {
        for (let i = 0; i < balloonTotalMonths; i++) {
            const interestPayment = balloonBalance * monthlyRate;
            const principalPayment = values.monthlyPayment - interestPayment;
            balloonBalance -= principalPayment;
            if (balloonBalance <= 0) break;
        }
    }
    
    const balloonDate = calculateMaturityDate(values.startDate, balloonTermYears, balloonTermMonths);
    const interestOnlyPayment = values.principalAmount * monthlyRate;
    
    return `PROMISSORY NOTE
(BALLOON LOAN)

Borrower: ${values.borrowerName}                                    ${new Date(values.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Principal Amount: ${formatCurrency(values.principalAmount)}          Made at: Perry, Taylor County, Florida

FOR VALUE RECEIVED, the undersigned ("Borrower"), whose address is 
__________________________________, promises to pay to the order of 
__________________________________ ("Lender"), whose address is 
__________________________________, the principal sum of ${numberToWords(values.principalAmount).toUpperCase()} DOLLARS (${formatCurrency(values.principalAmount)}), together with interest as set forth below.

1. TERMS OF REPAYMENT

☑ OPTION D: BALLOON LOAN

The Principal Balance shall accrue interest at ${values.interestRate} percent (${values.interestRate}%) per annum, with monthly payments of ${isInterestOnly ? '☑' : '☐'} interest only in the amount of ${formatCurrency(interestOnlyPayment)} ${!isInterestOnly ? '☑' : '☐'} principal and interest in the amount of ${formatCurrency(values.monthlyPayment)} based on an amortization schedule of ${values.totalMonths} months, due on the ${paymentDayText} day of each month, beginning ${values.firstPaymentDate}, until ${balloonDate}, at which time the entire remaining principal balance and all accrued interest shall be due and payable in full as a balloon payment.

2. INTEREST CALCULATION

Interest shall be calculated on a 365-day year basis and shall accrue daily on the outstanding principal balance.

3. PREPAYMENT

This Note may be prepaid in whole or in part at any time without penalty.

4. LATE CHARGES

If any payment is not received within five (5) days after its due date, the Borrower agrees to pay a late charge of three percent (3%) of the overdue payment amount.

5. DEFAULT

The Borrower shall be in default under this Note upon the occurrence of any of the following events:
- Failure to make any payment when due under this Note
- Breach of any covenant or warranty made in this Note
- Filing of bankruptcy or insolvency proceedings by or against the Borrower
- Death, dissolution, or legal incapacity of the Borrower

6. ACCELERATION

Upon default, the Lender may, at its option, declare the entire unpaid principal balance and all accrued interest immediately due and payable without notice or demand.

7. COLLECTION COSTS

If this Note is placed in the hands of an attorney for collection or enforcement, or if suit is brought for collection or enforcement, the Borrower agrees to pay all reasonable attorneys' fees and costs of collection incurred by the Lender, whether or not suit is actually filed.

8. WAIVER

The Borrower waives presentment, demand, notice of dishonor, protest, and all other demands and notices in connection with the delivery, acceptance, performance, default, or enforcement of this Note.

9. GOVERNING LAW

This Note shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles.

10. SEVERABILITY

If any provision of this Note is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

11. ENTIRE AGREEMENT

This Note constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.

12. SECURITY

☐ This Note is unsecured.
☐ This Note is secured by a ☐ Deed of Trust ☐ Mortgage ☐ Security Agreement dated ______________ 
on the following property: __________________________________

13. SIGNATURES

BORROWER:


_____________________________________                    _______________________
${values.borrowerName}                                                          Dated


ACKNOWLEDGED AND ACCEPTED 
BY LENDER:


_____________________________________                    _______________________
Lender                                                                              Dated`;
}

function generateARMNoteText(values) {
    // Get ARM-specific values
    const margin = parseFloat(document.getElementById('margin')?.value) || 2.5;
    const fixedPeriod = parseInt(document.getElementById('fixedPeriod')?.value) || 5;
    const lifetimeCap = parseFloat(document.getElementById('lifetimeCap')?.value) || 5;
    const adjustmentPeriod = parseInt(document.getElementById('adjustmentPeriod')?.value) || 12;
    const armIndex = document.getElementById('armIndex')?.value || 'SOFR';
    const perAdjustmentCap = parseFloat(document.getElementById('perAdjustmentCap')?.value) || 2;
    const floor = parseFloat(document.getElementById('floor')?.value) || 2;
    const maxRate = values.interestRate + lifetimeCap;
    
    const paymentDueDay = document.getElementById('paymentDueDay')?.value || 'first';
    const paymentDayText = {
        'first': '1st',
        'fifth': '5th',
        'tenth': '10th',
        'fifteenth': '15th',
        'same': (values.firstPaymentDate !== '[FIRST PAYMENT DATE]') ? new Date(values.firstPaymentDate).getDate().toString() : '[DAY]'
    }[paymentDueDay] || '1st';
    
    // Calculate first adjustment date
    const firstAdjustDate = new Date(values.startDate);
    firstAdjustDate.setFullYear(firstAdjustDate.getFullYear() + fixedPeriod);
    const firstAdjustDateText = firstAdjustDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const adjustmentFrequency = adjustmentPeriod === 6 ? 'six (6) months' : adjustmentPeriod === 3 ? 'three (3) months' : 'twelve (12) months';
    const adjustmentFrequencyShort = adjustmentPeriod === 6 ? 'monthly' : adjustmentPeriod === 3 ? 'quarterly' : 'annually';
    
    return `PROMISSORY NOTE
(ADJUSTABLE RATE LOAN)

Borrower: ${values.borrowerName}                                    ${new Date(values.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Principal Amount: ${formatCurrency(values.principalAmount)}          Made at: Perry, Taylor County, Florida

FOR VALUE RECEIVED, the undersigned ("Borrower"), whose address is 
__________________________________, promises to pay to the order of 
__________________________________ ("Lender"), whose address is 
__________________________________, the principal sum of ${numberToWords(values.principalAmount).toUpperCase()} DOLLARS (${formatCurrency(values.principalAmount)}), together with interest as set forth below.

1. TERMS OF REPAYMENT

☑ OPTION C: ADJUSTABLE RATE LOAN

The Principal Balance shall accrue interest at an initial rate of ${values.interestRate} percent (${values.interestRate}%) per annum, which rate shall adjust ☐ monthly ☐ quarterly ${adjustmentPeriod === 12 ? '☑' : '☐'} annually beginning on ${firstAdjustDateText} and every ${adjustmentFrequency} thereafter, based on the ${armIndex} Index plus a margin of ${margin} percent (${margin}%), subject to a per-adjustment cap of ${perAdjustmentCap} percent (${perAdjustmentCap}%), a lifetime cap of ${lifetimeCap} percent (${lifetimeCap}%), and a floor of ${floor} percent (${floor}%). The initial monthly payment amount of ${formatCurrency(values.monthlyPayment)} shall be recalculated at each adjustment date based on the new interest rate, remaining principal balance, and remaining term. The Lender shall provide written notice of rate and payment changes at least thirty (30) days before each adjustment date. Payments shall be due on the ${paymentDayText} day of each month, beginning ${values.firstPaymentDate}, and shall continue until the entire principal balance and all accrued interest is paid in full, with a maturity date of ${values.maturityDate}.

2. INTEREST CALCULATION

Interest shall be calculated on a 365-day year basis and shall accrue daily on the outstanding principal balance.

3. PREPAYMENT

This Note may be prepaid in whole or in part at any time without penalty.

4. LATE CHARGES

If any payment is not received within five (5) days after its due date, the Borrower agrees to pay a late charge of three percent (3%) of the overdue payment amount.

5. DEFAULT

The Borrower shall be in default under this Note upon the occurrence of any of the following events:
- Failure to make any payment when due under this Note
- Breach of any covenant or warranty made in this Note
- Filing of bankruptcy or insolvency proceedings by or against the Borrower
- Death, dissolution, or legal incapacity of the Borrower

6. ACCELERATION

Upon default, the Lender may, at its option, declare the entire unpaid principal balance and all accrued interest immediately due and payable without notice or demand.

7. COLLECTION COSTS

If this Note is placed in the hands of an attorney for collection or enforcement, or if suit is brought for collection or enforcement, the Borrower agrees to pay all reasonable attorneys' fees and costs of collection incurred by the Lender, whether or not suit is actually filed.

8. WAIVER

The Borrower waives presentment, demand, notice of dishonor, protest, and all other demands and notices in connection with the delivery, acceptance, performance, default, or enforcement of this Note.

9. GOVERNING LAW

This Note shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles.

10. SEVERABILITY

If any provision of this Note is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

11. ENTIRE AGREEMENT

This Note constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.

12. SECURITY

☐ This Note is unsecured.
☐ This Note is secured by a ☐ Deed of Trust ☐ Mortgage ☐ Security Agreement dated ______________ 
on the following property: __________________________________

13. SIGNATURES

BORROWER:


_____________________________________                    _______________________
${values.borrowerName}                                                          Dated


ACKNOWLEDGED AND ACCEPTED 
BY LENDER:


_____________________________________                    _______________________
Lender                                                                              Dated`;
}

function generateDesiredPaymentNoteText(values) {
    const desiredPayment = getNumericValue('desiredPayment') || values.monthlyPayment;
    
    const paymentDueDay = document.getElementById('paymentDueDay')?.value || 'first';
    const paymentDayText = {
        'first': '1st',
        'fifth': '5th',
        'tenth': '10th',
        'fifteenth': '15th',
        'same': (values.firstPaymentDate !== '[FIRST PAYMENT DATE]') ? new Date(values.firstPaymentDate).getDate().toString() : '[DAY]'
    }[paymentDueDay] || '1st';
    
    // Calculate term based on desired payment
    let calculatedMonths = values.totalMonths;
    if (desiredPayment !== values.monthlyPayment) {
        const monthlyRate = values.interestRate / 100 / 12;
        if (monthlyRate > 0) {
            calculatedMonths = Math.ceil(
                -Math.log(1 - (values.principalAmount * monthlyRate) / desiredPayment) / Math.log(1 + monthlyRate)
            );
        } else {
            calculatedMonths = Math.ceil(values.principalAmount / desiredPayment);
        }
    }
    
    return `PROMISSORY NOTE
(DESIRED PAYMENT STANDARD LOAN)

Borrower: ${values.borrowerName}                                    ${new Date(values.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Principal Amount: ${formatCurrency(values.principalAmount)}          Made at: Perry, Taylor County, Florida

FOR VALUE RECEIVED, the undersigned ("Borrower"), whose address is 
__________________________________, promises to pay to the order of 
__________________________________ ("Lender"), whose address is 
__________________________________, the principal sum of ${numberToWords(values.principalAmount).toUpperCase()} DOLLARS (${formatCurrency(values.principalAmount)}), together with interest as set forth below.

1. TERMS OF REPAYMENT

☑ OPTION E: DESIRED PAYMENT STANDARD LOAN

The Principal Balance shall accrue interest at ${values.interestRate} percent (${values.interestRate}%) per annum, amortized over ${calculatedMonths} months, with ${calculatedMonths} consecutive monthly installment payments of ${formatCurrency(desiredPayment)}, each consisting of principal and interest, due on the ${paymentDayText} day of each month, beginning ${values.firstPaymentDate}, until the entire principal balance and all accrued interest is paid in full, with a maturity date of ${values.maturityDate}.

2. INTEREST CALCULATION

Interest shall be calculated on a 365-day year basis and shall accrue daily on the outstanding principal balance.

3. PREPAYMENT

This Note may be prepaid in whole or in part at any time without penalty.

4. LATE CHARGES

If any payment is not received within five (5) days after its due date, the Borrower agrees to pay a late charge of three percent (3%) of the overdue payment amount.

5. DEFAULT

The Borrower shall be in default under this Note upon the occurrence of any of the following events:
- Failure to make any payment when due under this Note
- Breach of any covenant or warranty made in this Note
- Filing of bankruptcy or insolvency proceedings by or against the Borrower
- Death, dissolution, or legal incapacity of the Borrower

6. ACCELERATION

Upon default, the Lender may, at its option, declare the entire unpaid principal balance and all accrued interest immediately due and payable without notice or demand.

7. COLLECTION COSTS

If this Note is placed in the hands of an attorney for collection or enforcement, or if suit is brought for collection or enforcement, the Borrower agrees to pay all reasonable attorneys' fees and costs of collection incurred by the Lender, whether or not suit is actually filed.

8. WAIVER

The Borrower waives presentment, demand, notice of dishonor, protest, and all other demands and notices in connection with the delivery, acceptance, performance, default, or enforcement of this Note.

9. GOVERNING LAW

This Note shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles.

10. SEVERABILITY

If any provision of this Note is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

11. ENTIRE AGREEMENT

This Note constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.

12. SECURITY

☐ This Note is unsecured.
☐ This Note is secured by a ☐ Deed of Trust ☐ Mortgage ☐ Security Agreement dated ______________ 
on the following property: __________________________________

13. SIGNATURES

BORROWER:


_____________________________________                    _______________________
${values.borrowerName}                                                          Dated


ACKNOWLEDGED AND ACCEPTED 
BY LENDER:


_____________________________________                    _______________________
Lender                                                                              Dated`;
}

function copyNoteToClipboard() {
    const textArea = document.getElementById('noteLanguageText');
    if (textArea) {
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            
            // Show success feedback
            const copyBtn = document.getElementById('copyNoteBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#059669';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#3b82f6';
            }, 2000);
        } catch (err) {
            alert('Failed to copy to clipboard. Please select the text manually and copy with Ctrl+C.');
        }
    }
}

function selectAllNoteText() {
    const textArea = document.getElementById('noteLanguageText');
    if (textArea) {
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices
    }
}

function numberToWords(amount) {
    // Simple number to words conversion for dollar amounts
    const num = Math.floor(amount);
    if (num === 250000) return "TWO HUNDRED FIFTY THOUSAND";
    if (num === 500000) return "FIVE HUNDRED THOUSAND";
    if (num === 100000) return "ONE HUNDRED THOUSAND";
    if (num === 75000) return "SEVENTY-FIVE THOUSAND";
    if (num === 50000) return "FIFTY THOUSAND";
    if (num === 25000) return "TWENTY-FIVE THOUSAND";
    
    // For other amounts, return a placeholder
    return "[AMOUNT IN WORDS]";
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const modal = document.getElementById('noteModal');
    if (event.target === modal) {
        closeNoteModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeNoteModal();
    }
});