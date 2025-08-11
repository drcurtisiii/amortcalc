import { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Upload, FileText, Calculator, DollarSign, Calendar, Percent } from 'lucide-react';

// Utility functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
};

const calculateMonthlyPayment = (principal: number, rate: number, months: number): number => {
  if (rate === 0) return principal / months;
  const monthlyRate = rate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
};

type ArmSettings = {
  fixedMonths: number;
  adjustmentMonths: number;
  initialRate: number;
  index: string;
  margin: number;
  initialCap: number;
  periodicCap: number;
  lifetimeCap: number;
};

const generateAmortizationSchedule = (
  principal: number,
  annualRate: number,
  months: number,
  startDate: string,
  extraPayment: number = 0,
  loanType: string = 'standard',
  balloonTerm: number = 0,
  isInterestOnly: boolean = false,
  armSettings: ArmSettings | null = null
): any[] => {
  const schedule = [];
  let balance = principal;
  const monthlyRate = annualRate / 100 / 12;
  let currentDate = new Date(startDate);
  let totalInterest = 0;
  let totalPrincipal = 0;

  let basePayment = calculateMonthlyPayment(principal, annualRate, months);
  if (loanType === 'balloon' && isInterestOnly) {
    basePayment = principal * monthlyRate;
  }

  for (let month = 1; month <= months && balance > 0; month++) {
    let currentRate = annualRate;
    if (loanType === 'arm' && armSettings && month > armSettings.fixedMonths) {
      const adjustmentPeriod = armSettings.adjustmentMonths;
      if ((month - armSettings.fixedMonths - 1) % adjustmentPeriod === 0) {
        const rateChange = (Math.random() - 0.5) * 2;
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
      principalPayment = balance;
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

export default function App() {
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
  const [schedule, setSchedule] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calculateSchedule();
    // eslint-disable-next-line
  }, [loanType, loanAmount, interestRate, loanTerm, startDate, extraPayment,
    remainingBalance, remainingTerm, lumpSum, balloonTerm, amortizationPeriod,
    isInterestOnly, fixedPeriod, armIndex, margin, adjustmentPeriod, initialCap,
    periodicCap, lifetimeCap]);

  const calculateSchedule = () => {
    let newSchedule: any[] = [];
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
        const armSettings: ArmSettings = {
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

  const getChartData = () => {
    return schedule.filter((item, index) => index % 12 === 0 || index === schedule.length - 1).map(item => ({
      year: Math.ceil(item.month / 12),
      balance: item.balance,
      totalInterest: item.totalInterest,
      totalPrincipal: item.totalPrincipal
    }));
  };

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
    
    // Create and download JSON file
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const saveDate = new Date().toISOString().split('T')[0];
    a.href = URL.createObjectURL(jsonBlob);
    a.download = `${caseName || 'Untitled'}_Amortization_${saveDate}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFileLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
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
    } catch (error: any) {
      alert('Error loading file: ' + error.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
        <div className="mb-6 print:hidden">
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
        <div className="mb-6 print:hidden">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 print:hidden">
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
                  {loanType === 'balloon' ? 'Loan Term (years)' : 'Loan Term (years)'}
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

          {/* Balloon Mortgage Fields */}
          {loanType === 'balloon' && (
            <>
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
                <p className="text-xs text-gray-500 mt-1">Payment calculated over this period</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Balloon Payment Due (years)
                </label>
                <input
                  type="number"
                  value={balloonTerm}
                  onChange={(e) => setBalloonTerm(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">When remaining balance is due</p>
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
                  {loanType === 'balloon' ? 'Loan Term (years)' : 'Loan Term (years)'}
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

          {/* Balloon Mortgage Fields */}
          {loanType === 'balloon' && (
            <>
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
                <p className="text-xs text-gray-500 mt-1">Payment calculated over this period</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Balloon Payment Due (years)
                </label>
                <input
                  type="number"
                  value={balloonTerm}
                  onChange={(e) => setBalloonTerm(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">When remaining balance is due</p>
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

        {/* Loan Details Table */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Loan Details</h2>
          <table className="w-full border-collapse border border-gray-300">
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Case Name</td>
                <td className="border border-gray-300 px-4 py-2">{caseName || 'N/A'}</td>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Loan Type</td>
                <td className="border border-gray-300 px-4 py-2">{loanType.charAt(0).toUpperCase() + loanType.slice(1)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Loan Amount</td>
                <td className="border border-gray-300 px-4 py-2">{formatCurrency(loanAmount)}</td>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Interest Rate</td>
                <td className="border border-gray-300 px-4 py-2">{interestRate}%</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">{loanType === 'balloon' ? 'Amortization Period' : 'Loan Term'}</td>
                <td className="border border-gray-300 px-4 py-2">{loanType === 'balloon' ? amortizationPeriod : loanTerm} years</td>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Start Date</td>
                <td className="border border-gray-300 px-4 py-2">{formatDate(startDate)}</td>
              </tr>
              {loanType === 'balloon' && (
                <tr>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Balloon Due</td>
                  <td className="border border-gray-300 px-4 py-2">{balloonTerm} years</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Interest Only</td>
                  <td className="border border-gray-300 px-4 py-2">{isInterestOnly ? 'Yes' : 'No'}</td>
                </tr>
              )}
              {extraPayment > 0 && (
                <tr>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Extra Payment</td>
                  <td className="border border-gray-300 px-4 py-2">{formatCurrency(extraPayment)}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium"></td>
                  <td className="border border-gray-300 px-4 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        {schedule.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment Summary</h2>
            <table className="w-full border-collapse border border-gray-300">
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Monthly Payment</td>
                  <td className="border border-gray-300 px-4 py-2 text-blue-600 font-bold text-lg">{formatCurrency(summary.monthlyPayment || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Total Payments</td>
                  <td className="border border-gray-300 px-4 py-2 font-bold text-lg">{formatCurrency(summary.totalPayments || 0)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Total Interest</td>
                  <td className="border border-gray-300 px-4 py-2 text-red-600 font-bold text-lg">{formatCurrency(summary.totalInterest || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Payoff Date</td>
                  <td className="border border-gray-300 px-4 py-2 font-bold text-lg">{summary.payoffDate || 'N/A'}</td>
                </tr>
                {loanType === 'balloon' && (
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium">Balloon Payment</td>
                    <td className="border border-gray-300 px-4 py-2 text-orange-600 font-bold text-lg">
                      {formatCurrency(schedule.find(row => row.month === balloonTerm * 12)?.balance || 0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium"></td>
                    <td className="border border-gray-300 px-4 py-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Chart Section */}
        {schedule.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 chart-container page-break-after">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment Breakdown Over Time</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
              accept=".json"
              onChange={handleFileLoad}
              className="hidden"
            />
          </label>
        </div>

        {/* Amortization Schedule Table */}
        {schedule.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 page-break-before">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Amortization Schedule</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">Month</th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Payment</th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Principal</th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Interest</th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{row.month}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{row.date}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(row.payment)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(row.principal)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(row.interest)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Print-specific styles */}
        <style>{`
          @media print {
            body {
              margin: 0;
              padding: 0;
              font-size: 12px;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .container {
              max-width: 8.5in;
              margin: 0 auto;
              padding: 0.5in;
            }
            
            .print:hidden {
              display: none !important;
            }
            
            .no-print {
              display: none !important;
            }
            
            .page-break-before {
              page-break-before: always;
            }
            
            .page-break-after {
              page-break-after: always;
            }
            
            .chart-container {
              page-break-after: always;
              text-align: center;
              margin: 0 auto;
              max-width: 6in;
            }
            
            .loan-details-section {
              text-align: center;
              margin: 30px auto;
              max-width: 6in;
            }
            
            .schedule-section {
              page-break-before: always;
              margin: 0 auto;
              max-width: 8in;
            }
            
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 0 auto;
            }
            
            th, td {
              border: 1px solid #333;
              padding: 6px;
              font-size: 10px;
            }
            
            th {
              background-color: #f5f5f5;
              font-weight: 600;
              text-align: center;
            }
            
            .loan-details-table th {
              width: 40%;
              text-align: left;
              background-color: #e8e8e8;
            }
            
            .loan-details-table td {
              width: 60%;
              text-align: right;
            }
            
            .schedule-table th {
              text-align: center;
              font-size: 9px;
            }
            
            .schedule-table td {
              text-align: right;
              font-size: 9px;
            }
            
            .schedule-table td:first-child {
              text-align: center;
            }
            
            h1, h2 {
              text-align: center;
              margin: 20px 0;
            }
            
            h1 {
              font-size: 24px;
              color: #1f2937;
            }
            
            h2 {
              font-size: 18px;
              color: #374151;
            }
          }
        `}</style>
      </div>
    </div>
  );
// ...existing code...
}
