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

function App() {
  const [loanType, setLoanType] = useState('standard');
  const [caseName, setCaseName] = useState('');
  // ...existing code...
  // (rest of the amortization-calculator.tsx code, unchanged)
}

export default App
