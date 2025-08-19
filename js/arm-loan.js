// Adjustable Rate Mortgage (ARM) Calculator

function createARMLoanFields() {
    const fieldsContainer = document.getElementById('inputFields');
    fieldsContainer.innerHTML = '';
    
    // Create synchronized input fields
    const marginInfoText = `
        <h4>What is "Margin" in ARM loans?</h4>
        <p><strong>Margin</strong> is a fixed percentage that the lender adds to an index rate to determine your adjustable interest rate after the initial fixed period ends.</p>
        
        <h4>Formula:</h4>
        <p><strong>New Rate = Index Rate + Margin</strong></p>
        
        <h4>Example:</h4>
        <ul>
            <li>Index rate (like 1-year Treasury): 3.5%</li>
            <li>Margin: 2.5%</li>
            <li>Your new rate: 3.5% + 2.5% = <strong>6.0%</strong></li>
        </ul>
        
        <h4>Key Points:</h4>
        <ul>
            <li>The margin <strong>never changes</strong> during the life of the loan</li>
            <li>It's set at closing and remains constant</li>
            <li>Only the <strong>index rate fluctuates</strong> with market conditions</li>
            <li>Your payment adjusts based on the new rate + remaining balance</li>
        </ul>
    `;
    
    const fields = [
        createSynchronizedInputElement('loanAmount'),
        createSynchronizedInputElement('interestRate', null, 'Fully Indexed Rate (%)'),
        createSynchronizedInputElement('loanTerm'),
        createInputElement('margin', 'number', 'Margin/Spread (%)', 2.5, '', 0, 10, 0.125, marginInfoText),
        createInputElement('lifetimeCap', 'number', 'Lifetime Cap (%)', 5, '', 0, 20, 0.5),
        createSynchronizedInputElement('startDate'),
        createSynchronizedInputElement('extraPayment')
    ];
    
    fields.forEach(field => {
        if (field) {
            fieldsContainer.appendChild(field);
            const input = field.querySelector('input');
            if (input.id === 'margin') {
                input.addEventListener('input', updateFullyIndexedRate);
            } else {
                input.addEventListener('input', calculateARMLoan);
            }
        }
    });
    
    // Create select fields - start with placeholder rates, will be updated by API
    const indexOptions = [
        { value: 'WSJ', text: 'WSJ Prime Rate', currentRate: 7.50 },
        { value: 'SOFR', text: 'SOFR', currentRate: 5.32 },
        { value: 'Treasury', text: 'US Treasury (1-Year)', currentRate: 4.85 },
        { value: 'LIBOR', text: 'LIBOR (Legacy)', currentRate: 5.75 },
        { value: 'Other', text: 'Other (Custom)', currentRate: 0 }
    ];
    const fixedPeriodOptions = [
        { value: 1, text: '1 Year' },
        { value: 2, text: '2 Years' },
        { value: 3, text: '3 Years' },
        { value: 5, text: '5 Years' },
        { value: 7, text: '7 Years' },
        { value: 10, text: '10 Years' }
    ];
    const fixedPeriodField = createSelectElement('fixedPeriod', 'Fixed Rate Period', fixedPeriodOptions, 5);
    fieldsContainer.appendChild(fixedPeriodField);
    document.getElementById('fixedPeriod').addEventListener('change', calculateARMLoan);
    
    const indexField = createSelectElement('armIndex', 'ARM Index', indexOptions, 'WSJ');
    fieldsContainer.appendChild(indexField);
    document.getElementById('armIndex').addEventListener('change', handleIndexChange);
    
    // Add index rate display field (read-only) - will show live rates
    const indexRateField = createInputElement('indexRate', 'number', 'Current Index Rate (%)', 7.50, '', 0, 50, 0.01);
    indexRateField.querySelector('input').readOnly = true;
    indexRateField.querySelector('input').style.backgroundColor = '#f1f5f9';
    fieldsContainer.appendChild(indexRateField);
    
    // Create custom index input field (initially hidden)
    const customIndexField = createInputElement('customIndex', 'text', 'Custom Index Name', '', 'e.g., CCBG Rate, ABC Bank LOC Rate, etc.');
    customIndexField.style.display = 'none';
    customIndexField.id = 'customIndexField';
    fieldsContainer.appendChild(customIndexField);
    document.getElementById('customIndex').addEventListener('input', calculateARMLoan);
    
    // Add custom index rate field (initially hidden)
    const customIndexRateField = createInputElement('customIndexRate', 'number', 'Custom Index Rate (%)', 6.0, '', 0, 50, 0.01);
    customIndexRateField.style.display = 'none';
    customIndexRateField.id = 'customIndexRateField';
    fieldsContainer.appendChild(customIndexRateField);
    document.getElementById('customIndexRate').addEventListener('input', updateFullyIndexedRate);
    
    const adjustmentOptions = [
        { value: 6, text: '6 Months' },
        { value: 12, text: '1 Year' }
    ];
    const adjustmentField = createSelectElement('adjustmentPeriod', 'Adjustment Period', adjustmentOptions, 12);
    fieldsContainer.appendChild(adjustmentField);
    document.getElementById('adjustmentPeriod').addEventListener('change', calculateARMLoan);
    
    // Add rate status indicator
    const rateStatusDiv = document.createElement('div');
    rateStatusDiv.id = 'rateStatus';
    rateStatusDiv.style.cssText = `
        margin-top: 10px;
        padding: 8px 12px;
        background-color: #f1f5f9;
        border-radius: 6px;
        font-size: 12px;
        color: #64748b;
        text-align: center;
        border: 1px solid #e2e8f0;
    `;
    rateStatusDiv.innerHTML = 'Loading current rates...';
    fieldsContainer.appendChild(rateStatusDiv);
    
    // Fetch live rates and initialize
    initializeWithLiveRates();
    
    // Calculate initial values
    setTimeout(() => {
        // Initialize index rate and fully indexed rate
        handleIndexChange();
        calculateARMLoan();
    }, 100);
}

async function initializeWithLiveRates() {
    const rateStatusDiv = document.getElementById('rateStatus');
    
    // Check if rate fetching service is available
    if (!window.rateFetchingService || typeof window.rateFetchingService.getCurrentRates !== 'function') {
        console.warn('Rate fetching service not available, using fallback rates');
        if (rateStatusDiv) {
            rateStatusDiv.innerHTML = '⚠️ Rate service unavailable - using fallback rates';
            rateStatusDiv.style.backgroundColor = '#fef2f2';
            rateStatusDiv.style.borderColor = '#ef4444';
            rateStatusDiv.style.color = '#dc2626';
        }
        handleIndexChange(); // Use fallback rates
        return;
    }
    
    try {
        // Show loading indicator
        const indexRateField = document.getElementById('indexRate');
        if (indexRateField) {
            indexRateField.value = 'Loading...';
        }
        
        if (rateStatusDiv) {
            rateStatusDiv.innerHTML = '🔄 Fetching current rates from Federal Reserve...';
            rateStatusDiv.style.backgroundColor = '#fef3c7';
            rateStatusDiv.style.borderColor = '#f59e0b';
            rateStatusDiv.style.color = '#92400e';
        }
        
        // Fetch current rates
        const rates = await window.rateFetchingService.getCurrentRates();
        
        if (rates) {
            // Update the index options with live rates
            const armIndexSelect = document.getElementById('armIndex');
            if (armIndexSelect) {
                const options = armIndexSelect.querySelectorAll('option');
                options.forEach(option => {
                    const value = option.value;
                    let rate = null;
                    
                    switch(value) {
                        case 'WSJ':
                            rate = rates.wsjPrime;
                            break;
                        case 'SOFR':
                            rate = rates.sofr;
                            break;
                        case 'Treasury':
                            rate = rates.treasury1Year;
                            break;
                        case 'LIBOR':
                            rate = rates.libor;
                            break;
                    }
                    
                    if (rate !== null) {
                        option.textContent = option.textContent.replace(/\(.*?\)/, `(${rate.toFixed(2)}%)`);
                        if (!option.textContent.includes('(')) {
                            option.textContent += ` (${rate.toFixed(2)}%)`;
                        }
                    }
                });
            }
            
            // Update status indicator with success
            if (rateStatusDiv) {
                const lastUpdated = rates.lastUpdated ? new Date(rates.lastUpdated).toLocaleString() : 'just now';
                const source = rates.cached ? 'cached data' : 'live Federal Reserve data';
                rateStatusDiv.innerHTML = `✅ Rates updated from ${source} (as of ${lastUpdated})`;
                rateStatusDiv.style.backgroundColor = '#dcfce7';
                rateStatusDiv.style.borderColor = '#22c55e';
                rateStatusDiv.style.color = '#166534';
            }
        } else {
            throw new Error('No rate data received');
        }
        
        // Set initial index rate based on selected option
        handleIndexChange();
        
    } catch (error) {
        console.error('Failed to fetch live rates:', error);
        
        // Update status indicator with error
        if (rateStatusDiv) {
            rateStatusDiv.innerHTML = '⚠️ Using fallback rates - live data temporarily unavailable';
            rateStatusDiv.style.backgroundColor = '#fef2f2';
            rateStatusDiv.style.borderColor = '#ef4444';
            rateStatusDiv.style.color = '#dc2626';
        }
        
        // Fallback to hardcoded rates if API fails
        handleIndexChange();
    }
}

function handleIndexChange() {
    const indexSelect = document.getElementById('armIndex');
    const indexRateField = document.getElementById('indexRate');
    const customIndexField = document.getElementById('customIndexField');
    const customIndexRateField = document.getElementById('customIndexRateField');
    
    if (!indexSelect || !indexRateField) return;
    
    const selectedIndex = indexSelect.value;
    
    if (selectedIndex === 'Other') {
        // Show custom fields
        customIndexField.style.display = 'block';
        customIndexRateField.style.display = 'block';
        indexRateField.value = document.getElementById('customIndexRate')?.value || 6.0;
    } else {
        // Hide custom fields
        customIndexField.style.display = 'none';
        customIndexRateField.style.display = 'none';
        
        // Check if rate fetching service is available
        if (window.rateFetchingService && typeof window.rateFetchingService.getCurrentRates === 'function') {
            // Get rate from the rate fetching service if available
            window.rateFetchingService.getCurrentRates().then(rates => {
                let rate = null;
                
                switch(selectedIndex) {
                    case 'WSJ':
                        rate = rates?.wsjPrime || 7.50;
                        break;
                    case 'SOFR':
                        rate = rates?.sofr || 5.32;
                        break;
                    case 'Treasury':
                        rate = rates?.treasury1Year || 4.85;
                        break;
                    case 'LIBOR':
                        rate = rates?.libor || 5.75;
                        break;
                    default:
                        rate = 5.00;
                }
                
                indexRateField.value = rate.toFixed(2);
                updateFullyIndexedRate();
            }).catch(error => {
                console.error('Failed to get current rate:', error);
                useFallbackRates();
            });
        } else {
            useFallbackRates();
        }
    }
    
    function useFallbackRates() {
        // Fallback to hardcoded rates
        const fallbackRates = {
            'WSJ': 7.50,
            'SOFR': 5.32,
            'Treasury': 4.85,
            'LIBOR': 5.75
        };
        
        indexRateField.value = (fallbackRates[selectedIndex] || 5.00).toFixed(2);
        updateFullyIndexedRate();
    }
}

function updateFullyIndexedRate() {
    const indexSelect = document.getElementById('armIndex');
    const marginInput = document.getElementById('margin');
    const interestRateInput = document.getElementById('interestRate');
    
    let indexRate = 0;
    if (indexSelect.value === 'Other') {
        indexRate = parseFloat(document.getElementById('customIndexRate')?.value || 0);
    } else {
        indexRate = parseFloat(document.getElementById('indexRate')?.value || 0);
    }
    
    const margin = parseFloat(marginInput?.value || 0);
    const fullyIndexedRate = indexRate + margin;
    
    if (interestRateInput) {
        interestRateInput.value = fullyIndexedRate.toFixed(3);
        // Trigger synchronization
        interestRateInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Recalculate after rate change
    calculateARMLoan();
}

function calculateARMLoan() {
    const values = getARMFormValues();
    
    if (!values.loanAmount || !values.interestRate || !values.loanTerm) {
        return;
    }
    
    const armSettings = {
        fixedMonths: values.fixedPeriod * 12,
        adjustmentMonths: values.adjustmentPeriod,
        initialRate: values.interestRate,
        index: values.armIndex,
        margin: values.margin,
        lifetimeCap: values.lifetimeCap
    };
    
    const schedule = generateARMAmortizationSchedule(
        values.loanAmount,
        values.interestRate,
        values.loanTerm * 12,
        values.startDate,
        values.extraPayment,
        armSettings
    );
    
    currentSchedule = schedule;
    updateSummary(schedule);
    updateChart(schedule);
    updateScheduleTable(schedule);
    
    // Update table header to include rate column for ARM
    const tableHeader = document.querySelector('#scheduleTable thead tr');
    if (tableHeader && !tableHeader.querySelector('.rate-header')) {
        const rateHeader = document.createElement('th');
        rateHeader.textContent = 'Rate';
        rateHeader.className = 'rate-header';
        tableHeader.appendChild(rateHeader);
    }
}

function getARMFormValues() {
    const selectedIndex = document.getElementById('armIndex')?.value || 'SOFR';
    const customIndexName = document.getElementById('customIndex')?.value || '';
    
    return {
        loanAmount: getNumericValue('loanAmount'),
        interestRate: parseFloat(document.getElementById('interestRate')?.value || 0),
        loanTerm: parseInt(document.getElementById('loanTerm')?.value || 0),
        fixedPeriod: parseInt(document.getElementById('fixedPeriod')?.value || 5),
        armIndex: selectedIndex === 'Other' ? customIndexName : selectedIndex,
        margin: parseFloat(document.getElementById('margin')?.value || 2.5),
        adjustmentPeriod: parseInt(document.getElementById('adjustmentPeriod')?.value || 12),
        lifetimeCap: parseFloat(document.getElementById('lifetimeCap')?.value || 5),
        startDate: document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0],
        extraPayment: getNumericValue('extraPayment')
    };
}

function generateARMAmortizationSchedule(principal, initialRate, months, startDate, extraPayment = 0, armSettings) {
    const schedule = [];
    let balance = principal;
    let currentDate = new Date(startDate);
    let totalInterest = 0;
    let totalPrincipal = 0;
    let currentRate = initialRate;
    
    // Calculate base monthly payment using initial rate
    let basePayment = calculateMonthlyPayment(principal, initialRate, months);
    
    for (let month = 1; month <= months && balance > 0; month++) {
        // Handle ARM rate adjustments
        if (month > armSettings.fixedMonths) {
            const adjustmentPeriod = armSettings.adjustmentMonths;
            if ((month - armSettings.fixedMonths - 1) % adjustmentPeriod === 0) {
                // Simulate rate change (in real app, this would be based on index + margin)
                const rateChange = (Math.random() - 0.5) * 2; // Random change between -1% and +1%
                currentRate = Math.max(
                    0.25, // Minimum rate
                    Math.min(
                        currentRate + rateChange,
                        armSettings.initialRate + armSettings.lifetimeCap
                    )
                );
                
                // Recalculate payment with new rate and remaining balance/term
                const remainingMonths = months - month + 1;
                basePayment = calculateMonthlyPayment(balance, currentRate, remainingMonths);
            }
        }
        
        const monthlyRate = currentRate / 100 / 12;
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
            rate: currentRate
        });
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        
        if (balance <= 0) break;
    }
    
    return schedule;
}

// Override updateScheduleTable for ARM to include rate column
function updateARMScheduleTable(schedule) {
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
            <td class="text-right">${row.rate.toFixed(3)}%</td>
        `;
        tbody.appendChild(tr);
    });
}