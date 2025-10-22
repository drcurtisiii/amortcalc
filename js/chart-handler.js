// Chart handling using Chart.js

let currentChart = null;

function updateChart(schedule) {
    if (!schedule || schedule.length === 0) {
        document.getElementById('chartSection').style.display = 'none';
        return;
    }
    
    // Show chart section
    document.getElementById('chartSection').style.display = 'block';
    
    // Prepare chart data (sample every 12 months for readability)
    const chartData = schedule.filter((item, index) => 
        index % 12 === 0 || index === schedule.length - 1
    ).map(item => ({
        x: Math.ceil(item.month / 12),
        balance: item.balance,
        totalInterest: item.totalInterest,
        totalPrincipal: item.totalPrincipal
    }));
    
    const ctx = document.getElementById('paymentChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Create new chart
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => `Year ${d.x}`),
            datasets: [
                {
                    label: 'Remaining Balance',
                    data: chartData.map(d => d.balance),
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f6',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Total Principal Paid',
                    data: chartData.map(d => d.totalPrincipal),
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Total Interest Paid',
                    data: chartData.map(d => d.totalInterest),
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Years'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Function to capture chart as image for PDF
function captureChartAsImage() {
    return new Promise((resolve) => {
        if (!currentChart) {
            resolve(null);
            return;
        }
        
        try {
            const canvas = currentChart.canvas;
            const imageData = canvas.toDataURL('image/png', 0.8);
            resolve(imageData);
        } catch (error) {
            console.error('Error capturing chart:', error);
            resolve(null);
        }
    });
}