// js/services/task-service.js
// All Supabase calls related to task data.
// Every function returns { data, error } — never touches the DOM or calls alert().

import { supabase } from '../../../shared/js/supabase-client.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['To Do', 'Planning', 'In Progress', 'Validation', 'In Review', 'Done'];

export { STATUSES };

// ── Parent Tasks ──────────────────────────────────────────────────────────────

/**
 * Fetch all parent tasks for the current user with child count.
 */
export async function fetchParentTasks(userId) {
    const { data, error } = await supabase.rpc('get_parent_tasks', {
        p_user_id: userId
    });
    return { data, error };
}

/**
 * Fetch all distinct task types for the user.
 */
export async function fetchTaskTypes(userId) {
    const { data, error } = await supabase.rpc('get_task_types', {
        p_user_id: userId
    });
    return { data, error };
}

/**
 * Create a new parent task.
 */
export async function createTask(userId, taskData) {
    const { title, description, taskType, dueDate, status = 'To Do' } = taskData;

    const { data, error } = await supabase
        .from('lu_quest_tasks')
        .insert({
            user_id: userId,
            title,
            description: description || null,
            task_type: taskType || null,
            due_date: dueDate || null,
            status
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Update a task (parent or child).
 */
export async function updateTask(taskId, updates) {
    const payload = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.taskType !== undefined) payload.task_type = updates.taskType;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;

    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('lu_quest_tasks')
        .update(payload)
        .eq('id', taskId)
        .select()
        .single();

    return { data, error };
}

/**
 * Delete a task (soft delete).
 */
export async function deleteTask(taskId) {
    const { data, error } = await supabase
        .from('lu_quest_tasks')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();

    return { data, error };
}

// ── Child Tasks ───────────────────────────────────────────────────────────────

/**
 * Fetch all child tasks for a parent task.
 */
export async function fetchChildTasks(parentTaskId) {
    const { data, error } = await supabase.rpc('get_child_tasks', {
        p_parent_task_id: parentTaskId
    });
    return { data, error };
}

/**
 * Create a new child task.
 */
export async function createChildTask(userId, parentTaskId, taskData) {
    const { title, description, taskType, dueDate, status = 'To Do' } = taskData;

    const { data, error } = await supabase
        .from('lu_quest_tasks')
        .insert({
            user_id: userId,
            parent_task_id: parentTaskId,
            title,
            description: description || null,
            task_type: taskType || null,
            due_date: dueDate || null,
            status
        })
        .select()
        .single();

    return { data, error };
}

// ── Status Management ─────────────────────────────────────────────────────────

/**
 * Get valid statuses for status progression.
 * Returns all available statuses and which ones are valid transitions from current status.
 */
export function getValidStatusTransitions(currentStatus) {
    const currentIndex = STATUSES.indexOf(currentStatus);

    if (currentIndex === -1) {
        return { allStatuses: STATUSES, validTransitions: STATUSES };
    }

    // Can move to any status, but logically show adjacent ones
    return {
        allStatuses: STATUSES,
        validTransitions: STATUSES,
        currentIndex
    };
}

/**
 * Check if a status transition is valid (must be in order).
 */
export function isValidStatusTransition(fromStatus, toStatus) {
    const fromIndex = STATUSES.indexOf(fromStatus);
    const toIndex = STATUSES.indexOf(toStatus);

    if (fromIndex === -1 || toIndex === -1) return false;

    // Can move forward or backward in order
    return Math.abs(toIndex - fromIndex) > 0;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Convert local date string (YYYY-MM-DD) to UTC ISO string.
 */
export function dateToUTC(dateString) {
    if (!dateString) return null;

    const date = new Date(dateString + 'T00:00:00');
    return date.toISOString();
}

/**
 * Convert UTC ISO string to local date string (YYYY-MM-DD).
 */
export function utcToLocalDate(isoString) {
    if (!isoString) return null;

    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Calculate days until due and if past due.
 */
export function calculateDaysUntilDue(dueDateISO) {
    if (!dueDateISO) return { daysUntil: null, isPastDue: false, text: 'No due date' };

    const now = new Date();
    const due = new Date(dueDateISO);

    // Normalize to start of day for accurate day count
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffMs = due.getTime() - now.getTime();
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
        return {
            daysUntil: Math.abs(daysUntil),
            isPastDue: true,
            text: `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`
        };
    } else if (daysUntil === 0) {
        return {
            daysUntil: 0,
            isPastDue: false,
            text: 'Due today'
        };
    } else {
        return {
            daysUntil,
            isPastDue: false,
            text: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until due`
        };
    }
}
