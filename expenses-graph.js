// expenses-graph.js

// --- Replace with your actual Supabase details ---
const supabaseUrl = 'https://ljisujkxmbijleyhmxab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaXN1amt4bWJpamxleWhteGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMyOTYsImV4cCI6MjA3MDEwOTI5Nn0.9CbNfvI5VlUUQ4bbHd18pGR9ft-tHz2FLKAF_4yQJsg';
// -------------------------------------------------
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function fetchExpenses() {
    const now = new Date();
    const past = new Date(now.getFullYear(), now.getMonth() - 13, 1);

    const year = past.getFullYear();
    const month = past.getMonth() + 1;

  let { data, error } = await supabase
    .from('lu_monthly_expense')
    .select('*')
    .gte('year', year)
    .gte('month', month)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (error) {
    alert('Error fetching data: ' + error.message);
    return [];
  }
  return data;
}

function groupByTypeAndMonth(data) {
  const labels = Array.from(new Set(data.map(row => `${row.year}-${String(row.month).padStart(2, '0')}`))).sort();
  const grouped = {};
  data.forEach(row => {
    if (!grouped[row.type]) grouped[row.type] = {};
    grouped[row.type][`${row.year}-${String(row.month).padStart(2, '0')}`] = row.amount;
  });
  return { labels, grouped };
}

function prepareChartData(data) {
  const { labels, grouped } = groupByTypeAndMonth(data);
  const datasets = Object.keys(grouped).map((type, idx) => ({
    label: type,
    data: labels.map(label => grouped[type][label] || 0),
    borderColor: `hsl(${(idx*60)%360}, 70%, 50%)`,
    backgroundColor: `hsla(${(idx*60)%360}, 70%, 50%, 0.2)`,
    tension: 0.25
  }));
  return { labels, datasets };
}

async function renderChart() {
  const data = await fetchExpenses();
  if (data.length === 0) return;

  // Filtered datasets
  const nonTotalData = data.filter(row => row.type !== "Monthly Total");
  const totalData = data.filter(row => row.type === "Monthly Total");

  console.log(nonTotalData);
  console.log(totalData);
  // --- Chart 1: Expenses (excluding Monthly Total) ---
  if (nonTotalData.length > 0) {
    const expensesChartData = prepareChartData(nonTotalData);
    const ctx1 = document.getElementById('expensesChart').getContext('2d');
    new Chart(ctx1, {
      type: 'line',
      data: expensesChartData,
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Monthly Expenses by Type' },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { title: { display: true, text: 'Month' } },
          y: { title: { display: true, text: 'Amount ($)' }, beginAtZero: true }
        }
      }
    });
  }

  // --- Chart 2: Monthly Total ---
  if (totalData.length > 0) {
    const totalChartData = prepareChartData(totalData);
    const ctx2 = document.getElementById('totalChart').getContext('2d');
    new Chart(ctx2, {
      type: 'line',
      data: totalChartData,
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Monthly Total' },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { title: { display: true, text: 'Month' } },
          y: { title: { display: true, text: 'Amount ($)' }, beginAtZero: true }
        }
      }
    });
  }
}

renderChart();