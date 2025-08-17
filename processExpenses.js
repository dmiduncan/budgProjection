// processExpenses.js

// This function fetches expenses for the prior month from 'lu_expense',
// aggregates by type, and upserts (insert or update) per-type monthly totals into 'lu_monthly_expense'.
// It avoids duplicate entries and only updates if the value is different.
// It also returns the grand total for the month.

export async function processExpenses(supabase, expenseTypesEnum, monthModifier) {
  // Determine prior month and year
  const today = new Date();
  const priorMonthDate = new Date(today.getFullYear(), today.getMonth(), 1); // This is technically the current month in JS, but for Supabase it would be viewed as prior month.
  const year = priorMonthDate.getFullYear();
  // JS months are 0-based. We add a month to normalize the number and then subtract the modifier (current or previous).
  const month = priorMonthDate.getMonth() + 1 - monthModifier; 

  // Calculate start and end dates for the prior month
  // TODO probably need to adjust the period end to roll over. Not sure how it will handle when the month is 11 or 12.
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr = periodEnd.toISOString().slice(0, 10);

  console.log(startStr + ' ' + endStr);

  // Fetch expenses for the prior and current month
  let { data: expenses, error } = await supabase
    .from('lu_expense')
    .select('*')
    .gte('expense_date', startStr)
    .lte('expense_date', endStr);

  if (error) {
    console.error("Error fetching expenses:", error);
    return;
  }

  // Aggregate by type
  const typeTotals = {};
  let monthTotal = 0;
  for (const exp of expenses) {
    if (!typeTotals[exp.expense_type]) typeTotals[exp.expense_type] = 0;
    typeTotals[exp.expense_type] += exp.expense_cost;
    monthTotal += exp.expense_cost;
  }

  typeTotals['Monthly Total'] = monthTotal;

  // Fetch existing monthly entries for this month and all types
  let { data: existingRows, error2} = await supabase
    .from('lu_monthly_expense')
    .select('id, amount, type')
    .eq('year', year)
    .eq('month', month);

  if (error2) {
    console.error("Error fetching existing monthly aggregates:", fetchExistingError);
    return;
  }

  const existingMap = {};
  for (const row of existingRows) {
    existingMap[row.type] = { id: row.id, amount: row.amount };
  }

  // Prepare actions: update if changed, insert if missing, skip if same
  const updates = [];
  const inserts = [];
  for (const type of expenseTypesEnum) {
    if (typeTotals[type]) {
      if (existingMap[type]) {
        if (existingMap[type].amount !== typeTotals[type]) {
          updates.push({
            id: existingMap[type].id,
            amount: typeTotals[type]
          });
        }
        // else, skip since value is same
      } else {
        inserts.push({
          year,
          month,
          amount: typeTotals[type],
          type
        });
      }
    }
  }

  // Perform inserts if needed
  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from('lu_monthly_expense')
      .insert(inserts);
    if (insertError) {
      console.error("Error inserting new monthly per-type aggregates:", insertError);
    } else {
      console.log(`Inserted ${inserts.length} new rows for ${year}-${month} into lu_monthly_expense.`);
    }
  }

  // Perform updates if needed
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('lu_monthly_expense')
      .update({ amount: update.amount })
      .eq('id', update.id);
    if (updateError) {
      console.error(`Error updating monthly aggregate id ${update.id}:`, updateError);
    } else {
      console.log(`Updated row id ${update.id} for type in ${year}-${month}.`);
    }
  }

  if (inserts.length === 0 && updates.length === 0) {
    console.log("No inserts or updates required for prior month.");
  }

  // Return grand total for reporting
  return { year, month, total: monthTotal };
}