// Rate Fetching Service using Federal Reserve Economic Data (FRED) API
// Free API for real-time financial data

class RateFetchingService {
    constructor() {
        // FRED API endpoint (no API key required for basic usage)
        this.fredBaseUrl = 'https://api.stlouisfed.org/fred/series/observations';
        
        // FRED series IDs for different rates
        this.seriesIds = {
            'WSJ': 'DPRIME',           // Bank Prime Loan Rate
            'SOFR': 'SOFR',           // Secured Overnight Financing Rate
            'Treasury': 'DGS1',       // 1-Year Treasury Constant Maturity Rate
            'LIBOR': 'USD1MTD156N'    // 1-Month USD LIBOR (Legacy)
        };
        
        // Fallback rates in case API fails
        this.fallbackRates = {
            'WSJ': 7.50,
            'SOFR': 5.32,
            'Treasury': 4.85,
            'LIBOR': 5.75
        };
        
        // Cache for rates (valid for 1 hour)
        this.rateCache = {};
        this.cacheTimestamp = null;
        this.cacheValidityMs = 60 * 60 * 1000; // 1 hour
    }
    
    // Check if cache is valid
    isCacheValid() {
        if (!this.cacheTimestamp) return false;
        return (Date.now() - this.cacheTimestamp) < this.cacheValidityMs;
    }
    
    // Fetch rate from FRED API
    async fetchRateFromFRED(seriesId) {
        try {
            const url = `${this.fredBaseUrl}?series_id=${seriesId}&api_key=demo&file_type=json&limit=1&sort_order=desc`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.observations && data.observations.length > 0) {
                const latestObservation = data.observations[0];
                const rate = parseFloat(latestObservation.value);
                
                if (!isNaN(rate)) {
                    return {
                        rate: rate,
                        date: latestObservation.date,
                        success: true
                    };
                }
            }
            
            throw new Error('Invalid data received from FRED API');
            
        } catch (error) {
            console.warn(`Failed to fetch ${seriesId} from FRED:`, error.message);
            return { success: false, error: error.message };
        }
    }
    
    // Fetch all current rates
    async fetchCurrentRates() {
        // Return cached rates if still valid
        if (this.isCacheValid() && Object.keys(this.rateCache).length > 0) {
            console.log('Using cached rates');
            return this.rateCache;
        }
        
        console.log('Fetching fresh rates from FRED API...');
        const rates = {};
        const fetchPromises = [];
        
        // Fetch all rates in parallel
        for (const [indexName, seriesId] of Object.entries(this.seriesIds)) {
            fetchPromises.push(
                this.fetchRateFromFRED(seriesId).then(result => ({
                    indexName,
                    result
                }))
            );
        }
        
        try {
            const results = await Promise.all(fetchPromises);
            
            for (const { indexName, result } of results) {
                if (result.success) {
                    rates[indexName] = {
                        rate: result.rate,
                        date: result.date,
                        source: 'FRED'
                    };
                    console.log(`✓ ${indexName}: ${result.rate}% (as of ${result.date})`);
                } else {
                    // Use fallback rate
                    rates[indexName] = {
                        rate: this.fallbackRates[indexName],
                        date: new Date().toISOString().split('T')[0],
                        source: 'Fallback'
                    };
                    console.warn(`⚠ ${indexName}: Using fallback rate ${this.fallbackRates[indexName]}%`);
                }
            }
            
            // Cache the results
            this.rateCache = rates;
            this.cacheTimestamp = Date.now();
            
            return rates;
            
        } catch (error) {
            console.error('Error fetching rates:', error);
            
            // Return all fallback rates
            for (const [indexName, fallbackRate] of Object.entries(this.fallbackRates)) {
                rates[indexName] = {
                    rate: fallbackRate,
                    date: new Date().toISOString().split('T')[0],
                    source: 'Fallback'
                };
            }
            
            return rates;
        }
    }
    
    // Get rate for specific index
    async getRate(indexName) {
        const rates = await this.fetchCurrentRates();
        return rates[indexName] || {
            rate: this.fallbackRates[indexName] || 5.0,
            date: new Date().toISOString().split('T')[0],
            source: 'Fallback'
        };
    }
    
    // Format rate display with source info
    formatRateDisplay(indexName, rateData) {
        const sourceIndicator = rateData.source === 'FRED' ? '🔴 Live' : '⚪ Cached';
        return `${rateData.rate.toFixed(2)}% (${sourceIndicator} - ${rateData.date})`;
    }
}

// Global instance
console.log('Creating global rate fetching service...');
window.rateFetchingService = new RateFetchingService();
console.log('Rate fetching service created:', window.rateFetchingService);
