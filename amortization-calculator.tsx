import React, { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Upload, FileText, Calculator, DollarSign, Calendar, Percent } from 'lucide-react';

// Utility functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Calculate monthly payment
const calculateMonthlyPayment = (principal, rate, months) => {
  if (rate === 0) return principal / months;
  const monthlyRate = rate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
         (Math.pow(1 + monthlyRate, months) - 1);
};

// Generate amortization schedule
const generateAmortizationSchedule = (principal, annualRate, months, startDate, extraPayment = 0, loanType = 'standard', balloonTerm = 0, isInterestOnly = false, armSettings = null) => {
  const schedule = [];
  let balance = principal;
  const monthlyRate = annualRate / 100 / 12;
  let currentDate = new Date(startDate);
  let totalInterest = 0;
  let totalPrincipal = 0;
  
  // Calculate base monthly payment
  let basePayment = calculateMonthlyPayment(principal, annualRate, months);
  
  // For balloon mortgages with interest-only
  if (loanType === 'balloon' && isInterestOnly) {
    basePayment = principal * monthlyRate;
  }
  
  for (let month = 1; month <= months && balance > 0; month++) {
    let currentRate = annualRate;
    
    // Handle ARM rate adjustments
    if (loanType === 'arm' && armSettings && month > armSettings.fixedMonths) {
      const adjustmentPeriod = armSettings.adjustmentMonths;
      if ((month - armSettings.fixedMonths - 1) % adjustmentPeriod === 0) {
        // Simulate rate change (in real app, this would be based on index + margin)
        const rateChange = (Math.random() - 0.5) * 2; // Random change between -1% and +1%
        currentRate = Math.max(
          armSettings.initialRate - armSettings.lifetimeCap,
          Math.min(
            currentRate + rateChange,
            armSettings.initialRate + armSettings.lifetimeCap
          )
        );
      }
    }
    
    const interestPayment = balance * (currentRate / 100 / 12);
    let principalPayment = 0;
    
    if (loanType === 'balloon' && isInterestOnly && month < balloonTerm) {
      principalPayment = 0;
    } else if (loanType === 'balloon' && month === balloonTerm) {
      principalPayment = balance; // Balloon payment
    } else {
      principalPayment = Math.min(basePayment - interestPayment + extraPayment, balance);
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
      rate: currentRate
    });
    
    currentDate.setMonth(currentDate.getMonth() + 1);
    
    // Handle balloon payment
    if (loanType === 'balloon' && month === balloonTerm && balance > 0) {
      schedule[schedule.length - 1].payment += balance;
      schedule[schedule.length - 1].principal += balance;
      schedule[schedule.length - 1].balance = 0;
      balance = 0;
      break;
    }
  }
  
  return schedule;
};

// Main Component
export default function AmortizationCalculator() {
  const [loanType, setLoanType] = useState('standard');
  const [caseName, setCaseName] = useState('');
  
  // Standard loan fields
  const [loanAmount, setLoanAmount] = useState(250000);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [extraPayment, setExtraPayment] = useState(0);
  
  // Recasting fields
  const [remainingBalance, setRemainingBalance] = useState(200000);
  const [remainingTerm, setRemainingTerm] = useState(25);
  const [lumpSum, setLumpSum] = useState(50000);
  const [recastFee, setRecastFee] = useState(250);
  
  // Balloon fields
  const [balloonTerm, setBalloonTerm] = useState(5);
  const [amortizationPeriod, setAmortizationPeriod] = useState(30);
  const [isInterestOnly, setIsInterestOnly] = useState(false);
  
  // ARM fields
  const [fixedPeriod, setFixedPeriod] = useState(5);
  const [armIndex, setArmIndex] = useState('SOFR');
  const [margin, setMargin] = useState(2.5);
  const [adjustmentPeriod, setAdjustmentPeriod] = useState(12);
  const [initialCap, setInitialCap] = useState(2);
  const [periodicCap, setPeriodicCap] = useState(2);
  const [lifetimeCap, setLifetimeCap] = useState(5);
  
  const [schedule, setSchedule] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  
  const printRef = useRef();
  
  // Calculate schedule when inputs change
  useEffect(() => {
    calculateSchedule();
  }, [loanType, loanAmount, interestRate, loanTerm, startDate, extraPayment, 
      remainingBalance, remainingTerm, lumpSum, balloonTerm, amortizationPeriod, 
      isInterestOnly, fixedPeriod, armIndex, margin, adjustmentPeriod, initialCap, 
      periodicCap, lifetimeCap]);
  
  const calculateSchedule = () => {
    let newSchedule = [];
    
    switch (loanType) {
      case 'standard':
        newSchedule = generateAmortizationSchedule(
          loanAmount,
          interestRate,
          loanTerm * 12,
          startDate,
          extraPayment
        );
        break;
        
      case 'recasting':
        const newBalance = remainingBalance - lumpSum;
        newSchedule = generateAmortizationSchedule(
          newBalance,
          interestRate,
          remainingTerm * 12,
          startDate,
          extraPayment,
          'recasting'
        );
        break;
        
      case 'balloon':
        newSchedule = generateAmortizationSchedule(
          loanAmount,
          interestRate,
          amortizationPeriod * 12,
          startDate,
          extraPayment,
          'balloon',
          balloonTerm * 12,
          isInterestOnly
        );
        break;
        
      case 'arm':
        const armSettings = {
          fixedMonths: fixedPeriod * 12,
          adjustmentMonths: adjustmentPeriod,
          initialRate: interestRate,
          index: armIndex,
          margin: margin,
          initialCap,
          periodicCap,
          lifetimeCap
        };
        newSchedule = generateAmortizationSchedule(
          loanAmount,
          interestRate,
          loanTerm * 12,
          startDate,
          extraPayment,
          'arm',
          0,
          false,
          armSettings
        );
        break;
    }
    
    setSchedule(newSchedule);
  };
  
  // Generate chart data
  const getChartData = () => {
    return schedule.filter((item, index) => index % 12 === 0 || index === schedule.length - 1).map(item => ({
      year: Math.ceil(item.month / 12),
      balance: item.balance,
      totalInterest: item.totalInterest,
      totalPrincipal: item.totalPrincipal
    }));
  };
  
  // Save functionality
  const saveData = async () => {
    const data = {
      caseName,
      loanType,
      inputs: {
        loanAmount,
        interestRate,
        loanTerm,
        startDate,
        extraPayment,
        remainingBalance,
        remainingTerm,
        lumpSum,
        recastFee,
        balloonTerm,
        amortizationPeriod,
        isInterestOnly,
        fixedPeriod,
        armIndex,
        margin,
        adjustmentPeriod,
        initialCap,
        periodicCap,
        lifetimeCap
      },
      schedule
    };
    
    // Create JSON blob
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    
    // Generate PDF content
    const pdfContent = generatePDFContent();
    
    // Create ZIP file
    const zip = await createZipFile(jsonBlob, pdfContent);
    
    // Download ZIP
    const a = document.createElement('a');
    const saveDate = new Date().toISOString().split('T')[0];
    a.href = URL.createObjectURL(zip);
    a.download = `${caseName || 'Untitled'} Amortization ${saveDate}.zip`;
    a.click();
  };
  
  const generatePDFContent = () => {
    // Simple HTML representation for PDF
    const html = `
      <html>
        <head>
          <title>${caseName || 'Amortization Schedule'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f2f2f2; }
            .summary { margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${caseName || 'Amortization Schedule'}</h1>
          <div class="summary">
            <p><strong>Loan Type:</strong> ${loanType.charAt(0).toUpperCase() + loanType.slice(1)}</p>
            <p><strong>Loan Amount:</strong> ${formatCurrency(loanAmount)}</p>
            <p><strong>Interest Rate:</strong> ${interestRate}%</p>
            <p><strong>Term:</strong> ${loanTerm} years</p>
            ${extraPayment > 0 ? `<p><strong>Extra Payment:</strong> ${formatCurrency(extraPayment)}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${schedule.map(row => `
                <tr>
                  <td>${row.month}</td>
                  <td>${row.date}</td>
                  <td>${formatCurrency(row.payment)}</td>
                  <td>${formatCurrency(row.principal)}</td>
                  <td>${formatCurrency(row.interest)}</td>
                  <td>${formatCurrency(row.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    return html;
  };
  
  const createZipFile = async (jsonBlob, pdfContent) => {
    // For demo purposes, we'll create a simple ZIP-like structure
    // In a real app, you'd use a library like JSZip
    const boundary = '----=_Part_0_1234567890';
    const zipContent = `--${boundary}\r\nContent-Type: application/json\r\nContent-Disposition: attachment; filename="data.json"\r\n\r\n${await jsonBlob.text()}\r\n--${boundary}\r\nContent-Type: text/html\r\nContent-Disposition: attachment; filename="schedule.html"\r\n\r\n${pdfContent}\r\n--${boundary}--`;
    
    return new Blob([zipContent], { type: 'multipart/mixed; boundary=' + boundary });
  };
  
  // Load functionality
  const handleFileLoad = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      let data;
      
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
        // Handle ZIP file - extract JSON
        // In a real app, you'd use a proper ZIP library
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        }
      }
      
      if (data) {
        setCaseName(data.caseName || '');
        setLoanType(data.loanType || 'standard');
        
        const inputs = data.inputs;
        setLoanAmount(inputs.loanAmount || 250000);
        setInterestRate(inputs.interestRate || 6.5);
        setLoanTerm(inputs.loanTerm || 30);
        setStartDate(inputs.startDate || new Date().toISOString().split('T')[0]);
        setExtraPayment(inputs.extraPayment || 0);
        setRemainingBalance(inputs.remainingBalance || 200000);
        setRemainingTerm(inputs.remainingTerm || 25);
        setLumpSum(inputs.lumpSum || 50000);
        setRecastFee(inputs.recastFee || 250);
        setBalloonTerm(inputs.balloonTerm || 5);
        setAmortizationPeriod(inputs.amortizationPeriod || 30);
        setIsInterestOnly(inputs.isInterestOnly || false);
        setFixedPeriod(inputs.fixedPeriod || 5);
        setArmIndex(inputs.armIndex || 'SOFR');
        setMargin(inputs.margin || 2.5);
        setAdjustmentPeriod(inputs.adjustmentPeriod || 12);
        setInitialCap(inputs.initialCap || 2);
        setPeriodicCap(inputs.periodicCap || 2);
        setLifetimeCap(inputs.lifetimeCap || 5);
      }
    } catch (error) {
      alert('Error loading file: ' + error.message);
    }
  };
  
  // Print functionality
  const handlePrint = () => {
    window.print();
  };
  
  // Get summary statistics
  const getSummary = () => {
    if (schedule.length === 0) return {};
    
    const lastRow = schedule[schedule.length - 1];
    const monthlyPayment = schedule[0].payment;
    const totalPayments = schedule.reduce((sum, row) => sum + row.payment, 0);
    
    return {
      monthlyPayment,
      totalPayments,
      totalInterest: lastRow.totalInterest,
      totalPrincipal: lastRow.totalPrincipal,
      payoffDate: lastRow.date
    };
  };
  
  const summary = getSummary();
  
  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-2">
          <Calculator className="w-8 h-8 text-blue-600" />
          Amortization Calculator
        </h1>
        
        {/* Case Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Case Name
          </label>
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="e.g., File 2025-665 - Belcher to Ringgold"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Loan Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Loan Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['standard', 'recasting', 'balloon', 'arm'].map((type) => (
              <button
                key={type}
                onClick={() => setLoanType(type)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  loanType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {type === 'arm' ? 'Adjustable Rate' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Input Fields Based on Loan Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Standard Loan Fields */}
          {(loanType === 'standard' || loanType === 'balloon' || loanType === 'arm') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    step="0.125"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Term (years)
                </label>
                <input
                  type="number"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
          
          {/* Recasting Fields */}
          {loanType === 'recasting' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remaining Balance
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={remainingBalance}
                    onChange={(e) => setRemainingBalance(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    step="0.125"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remaining Term (years)
                </label>
                <input
                  type="number"
                  value={remainingTerm}
                  onChange={(e) => setRemainingTerm(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lump Sum Payment
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={lumpSum}
                    onChange={(e) => setLumpSum(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recasting Fee
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={recastFee}
                    onChange={(e) => setRecastFee(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}
          
          {/* Balloon Mortgage Fields */}
          {loanType === 'balloon' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Balloon Term (years)
                </label>
                <input
                  type="number"
                  value={balloonTerm}
                  onChange={(e) => setBalloonTerm(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amortization Period (years)
                </label>
                <input
                  type="number"
                  value={amortizationPeriod}
                  onChange={(e) => setAmortizationPeriod(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="interestOnly"
                  checked={isInterestOnly}
                  onChange={(e) => setIsInterestOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="interestOnly" className="ml-2 text-sm font-medium text-gray-700">
                  Interest Only Payments
                </label>
              </div>
            </>
          )}
          
          {/* ARM Fields */}
          {loanType === 'arm' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fixed Rate Period (years)
                </label>
                <select
                  value={fixedPeriod}
                  onChange={(e) => setFixedPeriod(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 Years</option>
                  <option value={5}>5 Years</option>
                  <option value={7}>7 Years</option>
                  <option value={10}>10 Years</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ARM Index
                </label>
                <select
                  value={armIndex}
                  onChange={(e) => setArmIndex(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SOFR">SOFR</option>
                  <option value="Treasury">US Treasury</option>
                  <option value="LIBOR">LIBOR (Legacy)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Margin (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    step="0.125"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Period
                </label>
                <select
                  value={adjustmentPeriod}
                  onChange={(e) => setAdjustmentPeriod(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value={6}>6 Months</option>
                  <option value={12}>1 Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lifetime Cap (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={lifetimeCap}
                    onChange={(e) => setLifetimeCap(Number(e.target.value))}
                    step="0.5"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}
          
          {/* Common Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extra Monthly Payment
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={extraPayment}
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Summary Section */}
        {schedule.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Loan Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Monthly Payment</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.monthlyPayment)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(summary.totalPayments)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Interest</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalInterest)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Principal</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPrincipal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payoff Date</p>
                <p className="text-2xl font-bold text-gray-800">{summary.payoffDate}</p>
              </div>
              {loanType === 'balloon' && (
                <div>
                  <p className="text-sm text-gray-600">Balloon Payment</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(schedule.find(row => row.month === balloonTerm * 12)?.balance || 0)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Chart Section */}
        {schedule.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment Breakdown Over Time</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="balance" stroke="#3B82F6" name="Balance" strokeWidth={2} />
                <Line type="monotone" dataKey="totalPrincipal" stroke="#10B981" name="Total Principal" strokeWidth={2} />
                <Line type="monotone" dataKey="totalInterest" stroke="#EF4444" name="Total Interest" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8 print:hidden">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            {showSchedule ? 'Hide' : 'Show'} Amortization Schedule
          </button>
          
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Print to PDF
          </button>
          
          <button
            onClick={saveData}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Save File
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors cursor-pointer">
            <Upload className="w-5 h-5" />
            Load File
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleFileLoad}
              className="hidden"
            />
          </label>
        </div>
        
        {/* Amortization Schedule Table */}
        {showSchedule && schedule.length > 0 && (
          <div className="overflow-x-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Amortization Schedule</h2>
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Month</th>
                  <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 border-b text-right text-sm font-medium text-gray-700">Payment</th>
                  <th className="px-4 py-2 border-b text-right text-sm font-medium text-gray-700">Principal</th>
                  <th className="px-4 py-2 border-b text-right text-sm font-medium text-gray-700">Interest</th>
                  <th className="px-4 py-2 border-b text-right text-sm font-medium text-gray-700">Balance</th>
                  {loanType === 'arm' && (
                    <th className="px-4 py-2 border-b text-right text-sm font-medium text-gray-700">Rate</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-2 border-b text-sm">{row.month}</td>
                    <td className="px-4 py-2 border-b text-sm">{row.date}</td>
                    <td className="px-4 py-2 border-b text-sm text-right">{formatCurrency(row.payment)}</td>
                    <td className="px-4 py-2 border-b text-sm text-right">{formatCurrency(row.principal)}</td>
                    <td className="px-4 py-2 border-b text-sm text-right">{formatCurrency(row.interest)}</td>
                    <td className="px-4 py-2 border-b text-sm text-right">{formatCurrency(row.balance)}</td>
                    {loanType === 'arm' && (
                      <td className="px-4 py-2 border-b text-sm text-right">{row.rate.toFixed(3)}%</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Print-specific styles */}
      <style jsx>{`
        @media print {
          body {
            margin: 0;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}