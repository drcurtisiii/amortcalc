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
    month: 'short',
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
  const [showSchedule, setShowSchedule] = useState(false);
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
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const pdfContent = generatePDFContent();
    const zip = await createZipFile(jsonBlob, pdfContent);
    const a = document.createElement('a');
    const saveDate = new Date().toISOString().split('T')[0];
    a.href = URL.createObjectURL(zip);
    a.download = `${caseName || 'Untitled'} Amortization ${saveDate}.zip`;
    a.click();
  };

  const generatePDFContent = () => {
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

  const createZipFile = async (jsonBlob: Blob, pdfContent: string) => {
    const boundary = '----=_Part_0_1234567890';
    const zipContent = `--${boundary}\r\nContent-Type: application/json\r\nContent-Disposition: attachment; filename="data.json"\r\n\r\n${await jsonBlob.text()}\r\n--${boundary}\r\nContent-Type: text/html\r\nContent-Disposition: attachment; filename="schedule.html"\r\n\r\n${pdfContent}\r\n--${boundary}--`;
    return new Blob([zipContent], { type: 'multipart/mixed; boundary=' + boundary });
  };

  const handleFileLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let data;
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
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
        {/* ...existing code for input fields, summary, chart, actions, and schedule table... */}
        {/* (This is the same JSX as your original amortization calculator) */}
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
    </div>
  );
// ...existing code...
}
