// js/services/transaction-service.js
// All Supabase calls related to transactions and expenses.
// Every function returns { data, error } — never touches the DOM.

import { supabase } from '../supabase-client.js';

/**
 * Fetch all transactions ordered by priority.
 */
export async function fetchTransactions() {
    const { data, error } = await supabase
        .from('lu_transaction')
        .select('*')
        .order('priority', { ascending: true });
    return { data, error };
}

/**
 * Insert a new expense record.
 */
export async function insertExpense(userId, expenseDate, expenseType, expenseCost) {
    const insertObj = {
        date_created:  new Date().toISOString(),
        expense_date:  expenseDate,
        expense_type:  expenseType,
        expense_cost:  parseFloat(expenseCost, 10)
    };
    if (userId) insertObj.user_id = userId;

    const { data, error } = await supabase
        .from('lu_expense')
        .insert([insertObj]);
    return { data, error };
}
