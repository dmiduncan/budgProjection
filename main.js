import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://ljisujkxmbijleyhmxab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaXN1amt4bWJpamxleWhteGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMyOTYsImV4cCI6MjA3MDEwOTI5Nn0.9CbNfvI5VlUUQ4bbHd18pGR9ft-tHz2FLKAF_4yQJsg';
const supabase = createClient(supabaseUrl, supabaseKey);


// --- Expense Types Enum ---
const expenseTypesEnum = [
    "Groceries",
    "Fuel",
    "Power",
    "Gas",
    "Water",
    "Home"
];

// --- Populate expense type dropdown on page load ---
function populateExpenseTypes() {
    const select = document.getElementById('expense-type');
    if (!select) return;
    select.innerHTML = '';
    expenseTypesEnum.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
}

// --- Show message to user ---
function showExpenseMessage(msg, isError) {
    const div = document.getElementById('expense-message');
    if (!div) return;
    div.textContent = msg;
    div.style.color = isError ? 'red' : 'green';
}

// --- Handle expense form submission ---
async function handleExpenseSubmit(e) {
    e.preventDefault();

    let expenseDate = document.getElementById('expense-date').value;
    let expenseCost = document.getElementById('expense-cost').value;
    let expenseType = document.getElementById('expense-type').value;

    // Validate inputs
    if (!expenseDate) {
        showExpenseMessage('Please select a date.', true);
        return;
    }
    
    if (!expenseType || !expenseTypesEnum.includes(expenseType)) {
        showExpenseMessage('Please select a valid expense type.', true);
        return;
    }

    // Insert into Supabase
    const { data, error } = await supabase
        .from('lu_expense')
        .insert([{
            date_created: new Date().toISOString(),
            expense_date: expenseDate,
            expense_type: expenseType,
            expense_cost: parseFloat(expenseCost, 10)
        }]);

    if (error) {
        showExpenseMessage('Error: ' + error.message, true);
        console.error('Error adding expense:', error);
    } else {
        showExpenseMessage('Expense submitted!', false);
        console.log('Expense submitted!');
        document.getElementById('expense-form').reset();
        setTodaysDate();
    }
}

// --- Setup expense entry on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {
  // Default date picker to today
  const expenseDateInput = document.getElementById('expense-date');
  if (expenseDateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      expenseDateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Select-all for expense-cost
  const expenseCostInput = document.getElementById('expense-cost');
  if (expenseCostInput) {
      expenseCostInput.addEventListener('focus', function() {
          expenseCostInput.select();
      });
  }
  
  populateExpenseTypes();
  const form = document.getElementById('expense-form');
  if (form) {
      form.addEventListener('submit', handleExpenseSubmit);
  }
});

function setTodaysDate() {
  const expenseDateInput = document.getElementById('expense-date');
  if (expenseDateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      expenseDateInput.value = `${yyyy}-${mm}-${dd}`;
  }
}


function isInArray(array, value) {
  return !!array.find(item => {return item.getDate() == value.getDate() && item.getMonth() == value.getMonth()});
}

let txData = {
  currentBalance: 0.00,
  savingsBalance: 0.00,
  transactions: []
};

(async function fetchDataAndInit() {
  const { data, error } = await supabase
    .from('lu_transaction')
    .select('*');

  if (error) {
    console.error('Error loading transactions:', error);
    return;
  }

  txData.transactions = data.map(tx => ({
    startDate: tx.start_date || 0,
    endDate: tx.stop_date || 0,
    recurDay: tx.recurrence_date ? new Date(tx.recurrence_date).getUTCDate() : 0,
    targetDate: tx.target_date || 0,
    isBiweekly: tx.occurs_biweekly,
    amount: tx.transaction_amount,
    name: tx.transaction_name,
    description: tx.transaction_description || ""
  }));

  console.log("Fetched transactions from Supabase:", txData.transactions);
})();


console.log(txData);

let input = document.getElementById('balanceInput');
let currentBalance = txData.currentBalance;
let savingsBalance = txData.savingsBalance;
input.value = currentBalance;

let projectionStartDate = new Date();
projectionStartDate.setHours(0,0,0,0);
let projectionEndDate = new Date(2027, 0, 1);
let initialPayDay = new Date(2024, 0, 5);
initialPayDay.setHours(0,0,0,0);
let payDates = [];

for (let date = new Date(initialPayDay); date < projectionEndDate; date.setDate(date.getDate() + 14)) {
    payDates.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
}

let savingsTotal = 0;

function recalc() {
    savingsTotal = 0;
    currentBalance = Number(input.value);

    let txBucket = document.getElementById("txBucket");
    let txList = document.createElement("ul");
    
    for (let date = new Date(projectionStartDate); date < projectionEndDate; date.setDate(date.getDate() + 1)) {
        date.setHours(0,0,0,0);
        for (let i = 0; i < txData.transactions.length; i++) {
            let currTx = txData.transactions[i];
            let startDate = currTx.startDate === 0 ? 0 : new Date(currTx.startDate);
            let endDate = currTx.endDate === 0 ? 0 : new Date(currTx.endDate);
            let targetDate = 0;
            
            if (currTx.targetDate !== 0) {
                targetDate = new Date(currTx.targetDate);
                targetDate.setHours(0,0,0,0);
            }        
    
            if ((startDate === 0 || date >= startDate) 
                && (endDate === 0 || date <= endDate)
                && ((currTx.recurDay !== 0 && currTx.recurDay === date.getDate())
                    || (currTx.isBiweekly && isInArray(payDates, date)) 
                    || (currTx.recurDay === 0 && !currTx.isBiweekly && targetDate.getTime() === date.getTime()))) {
                        currentBalance += currTx.amount;
                        if (currTx.name === ('<---- Monthly Low Balance ---->'))
                        {
                            txList.insertAdjacentHTML('beforeend', `<li>${currTx.name}<ul><li>New Blance: ${currentBalance.toFixed(2)}</li></ul></li>`)
                        }
                        else
                        {
                          txList.insertAdjacentHTML('beforeend', `<li>${currTx.name}<ul><li>${date.toLocaleDateString("en-US")}</li><li>Tx Amount: ${currTx.amount}</li><li>New Blance: ${currentBalance.toFixed(2)}</li></ul></li>`)  
                        }
          }
        }
    }

    txBucket.replaceChildren(txList);
}

document.getElementById('recalcButton').onclick = recalc;