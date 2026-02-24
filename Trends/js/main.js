// js/main.js
// Budget projection — calculate and display only.

import { fetchTransactions } from './services/transaction-service.js';
import { showToast } from './toast.js';

const PROJECTION_END_DATE = new Date(2027, 0, 1);
const INITIAL_PAY_DAY     = new Date(2024, 0, 5);
INITIAL_PAY_DAY.setHours(0, 0, 0, 0);

// Pre-compute biweekly pay dates
const payDates = [];
for (
    let d = new Date(INITIAL_PAY_DAY);
    d < PROJECTION_END_DATE;
    d.setDate(d.getDate() + 14)
) {
    payDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isInArray(array, value) {
    return !!array.find(
        item => item.getDate() === value.getDate() && item.getMonth() === value.getMonth()
    );
}

function recalc(transactions) {
    const input = document.getElementById('balanceInput');
    if (!input) return;

    let currentBalance = Number(input.value);

    const projectionStartDate = new Date();
    projectionStartDate.setHours(0, 0, 0, 0);

    const txList = document.createElement('ul');

    for (
        let date = new Date(projectionStartDate);
        date < PROJECTION_END_DATE;
        date.setDate(date.getDate() + 1)
    ) {
        date.setHours(0, 0, 0, 0);

        for (const currTx of transactions) {
            const startDate  = currTx.startDate  !== 0 ? new Date(currTx.startDate)  : 0;
            const endDate    = currTx.endDate    !== 0 ? new Date(currTx.endDate)    : 0;
            let   targetDate = 0;

            if (currTx.targetDate !== 0) {
                targetDate = new Date(currTx.targetDate);
                targetDate.setHours(0, 0, 0, 0);
            }

            const afterStart   = startDate === 0 || date >= startDate;
            const beforeEnd    = endDate   === 0 || date <= endDate;
            const onRecurDay   = currTx.recurDay !== 0 && currTx.recurDay === date.getDate();
            const onPayDay     = currTx.isBiweekly && isInArray(payDates, date);
            const onTargetDate = currTx.recurDay === 0 && !currTx.isBiweekly && targetDate !== 0 && targetDate.getTime() === date.getTime();

            if (afterStart && beforeEnd && (onRecurDay || onPayDay || onTargetDate)) {
                currentBalance += currTx.amount;

                if (currTx.name === 'Monthly Low Balance') {
                    txList.insertAdjacentHTML('beforeend',
                        `<li class="tx-month-header">${date.toLocaleString('default', { month: 'long' })} Low Balance: $${currentBalance.toFixed(2)}</li>`
                    );
                } else {
                    txList.insertAdjacentHTML('beforeend',
                        `<li class="tx-row">
                            <span class="tx-name">${currTx.name}</span>
                            <span class="tx-date">${date.toLocaleDateString('en-US')}</span>
                            <span class="tx-amount">${currTx.amount >= 0 ? '+' : ''}${currTx.amount}</span>
                            <span class="tx-balance">Balance: $${currentBalance.toFixed(2)}</span>
                        </li>`
                    );
                }
            }
        }
    }

    document.getElementById('txBucket')?.replaceChildren(txList);
}

export async function initApp() {
    const { data, error } = await fetchTransactions();

    if (error) {
        showToast('Error loading transactions: ' + error.message, 'error');
        console.error('Error loading transactions:', error);
        return;
    }

    const transactions = (data || []).map(tx => ({
        startDate:   tx.start_date   || 0,
        endDate:     tx.stop_date    || 0,
        recurDay:    tx.recurrence_date ? new Date(tx.recurrence_date).getUTCDate() : 0,
        targetDate:  tx.target_date  || 0,
        isBiweekly:  tx.occurs_biweekly,
        amount:      tx.transaction_amount,
        name:        tx.transaction_name,
        description: tx.transaction_description || ''
    }));

    document.getElementById('recalcButton')?.addEventListener('click', () => recalc(transactions));
    console.log('Budget projection ready.');
}