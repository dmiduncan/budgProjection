
function isInArray(array, value) {
  return !!array.find(item => {return item.getDate() == value.getDate() && item.getMonth() == value.getMonth()});
}

let txData = 
    {
        "currentBalance" : 0.00,
        "savingsBalance" : 0.00,
        "transactions" : [
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 28,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": 2500,
            "name": "ADC Paycheck Semi-Monthly 1",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 13,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": 2500,
            "name": "ADC Paycheck Semi-Monthly 2",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 1,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -375,
            "name": "Roth IRA Contribution 1",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 15,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -375,
            "name": "Roth IRA Contribution 2",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 1,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -285,
            "name": "High Yield Savings 1",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 15,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -285,
            "name": "High Yield Savings 2",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 1,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -50,
            "name": "Gen Investment 1",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 15,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -50,
            "name": "Gen Investment 2",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 0,
            "targetDate": "2025-09-01",
            "isBiweekly": false,
            "amount": 375,
            "name": "Savings Adjustment for August Tattoo",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 0,
            "targetDate": "2025-08-30",
            "isBiweekly": false,
            "amount": -300,
            "name": "Tarot Tattoo",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 0,
            "targetDate": "2025-08-30",
            "isBiweekly": false,
            "amount": -75,
            "name": "Actual Roth IRA Contribution",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 15,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -620,
            "name": "Kids School",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 20,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -373.08,
            "name": "Auto Loan",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 1,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -2000,
            "name": "Mortgage",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 1,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -0,
            "name": "<---- Monthly Low Balance ---->",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 19,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -411,
            "name": "Student Loan",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 28,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -50,
            "name": "Phone",
            "description": ""
          },
          {
            "startDate": 0,
            "endDate": 0,
            "recurDay": 20,
            "targetDate": 0,
            "isBiweekly": false,
            "amount": -125,
            "name": "Lawn",
            "description": ""
          },
        ]
      }

console.log(txData);

let input = document.getElementById('balanceInput');
let currentBalance = txData.currentBalance;
let savingsBalance = txData.savingsBalance;
input.value = currentBalance;

let projectionStartDate = new Date();
projectionStartDate.setHours(0,0,0,0);
let projectionEndDate = new Date(2026, 0, 1);
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