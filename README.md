# Amortization Calculator

A professional-grade loan amortization calculator with live Federal Reserve data integration, designed for legal and financial professionals.

## Features

### 🏛️ **Live Federal Reserve Data Integration**
- Real-time rates from FRED (Federal Reserve Economic Data) API
- WSJ Prime Rate, SOFR, Treasury rates, and LIBOR
- Automatic hourly rate updates with intelligent caching
- Fallback system ensures reliability even when APIs are unavailable

### 📊 **Multiple Loan Types**
- **Standard Fixed-Rate Loans**: Traditional amortization with extra payments
- **ARM (Adjustable Rate Mortgages)**: 1-10 year fixed periods with margin calculations
- **Recasting Loans**: Principal reduction scenarios with payment recalculation
- **Balloon Loans**: Interest-only or partial amortization with balloon payments

### 📋 **Professional PDF Generation**
- Ultra-compact formatting optimized for legal documentation
- Dynamic warning boxes with jurisdiction-specific legal language
- 0.75" margins with 6pt row spacing for maximum data density
- Embedded payment breakdown charts

### 🔄 **Smart Field Synchronization**
- Cross-tab data persistence - fill out once, use everywhere
- Intelligent loan term/amortization period syncing
- Protected borrower field with 4x2 grid layout
- Real-time calculation updates

### 📈 **Advanced Visualizations**
- Chart.js payment breakdown visualizations
- Principal vs interest over time
- Balance reduction curves
- Embedded charts in PDF output

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 Grid
- **PDF Generation**: jsPDF with custom ultra-compact formatting
- **Data Visualization**: Chart.js
- **API Integration**: Federal Reserve Economic Data (FRED)
- **Styling**: Modern CSS with cross-browser compatibility

## Getting Started

### Online Version (Recommended)
Visit the live version at: [https://drcurtisiii.github.io/amortcalc](https://drcurtisiii.github.io/amortcalc)

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/drcurtisiii/amortcalc.git
   cd amortcalc
   ```

2. Open `index.html` in your browser or serve with a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using Live Server (VS Code extension)
   # Right-click index.html → Open with Live Server
   ```

3. **Note**: Live rate fetching requires internet connectivity. When running offline, the app will automatically use fallback rates.

## Usage

1. **Select Loan Type**: Choose from Standard, Recasting, Balloon, or Adjustable Rate
2. **Enter Loan Details**: Fill in borrower info, loan amount, and terms
3. **Live Rate Integration**: For ARM loans, rates update automatically from Federal Reserve
4. **Generate Calculations**: View amortization schedule and payment breakdown
5. **Export PDF**: Generate professional PDFs with legal warnings and charts

## API Integration

### Federal Reserve Economic Data (FRED)
The application integrates with the St. Louis Federal Reserve's FRED API to fetch current rates:

- **WSJ Prime Rate**: `DPRIME` series
- **SOFR**: `SOFR` series  
- **1-Year Treasury**: `DGS1` series
- **LIBOR (Legacy)**: `USD1MTD156N` series

### Rate Caching Strategy
- **Cache Duration**: 1 hour for optimal performance
- **Fallback Rates**: Reliable backup rates when API is unavailable
- **Parallel Fetching**: Multiple rates loaded simultaneously
- **Status Indicators**: Real-time feedback on data source and freshness

## Legal Considerations

The calculator includes appropriate legal warnings and disclaimers:
- Recasting loan warnings about lender policies
- Balloon payment risk disclosures
- ARM rate adjustment notifications
- Professional legal review recommendations

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## License

Copyright © 2025 Curtis Law Firm. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Support

For technical support or feature requests, contact:
- **Email**: ray@curtislawfirm.com
- **Repository**: [GitHub Issues](https://github.com/drcurtisiii/amortcalc/issues)

## Deployment

### GitHub Pages (Current)
The application is automatically deployed to GitHub Pages from the `main` branch.

### Netlify Integration
For enhanced deployment features:
1. Connect GitHub repository to Netlify
2. Set build command: (none - static site)
3. Set publish directory: `/`
4. Enable automatic deploys from `main` branch

---

**Professional Tool for Legal and Financial Analysis**  
Built for accuracy, reliability, and professional presentation.
