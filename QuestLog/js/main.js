// js/main.js
// Main app bootstrap and event orchestration.
// Handles UI rendering, state updates, and user interactions.

import { getState, setState, subscribe } from './app-state.js';
import {
    fetchParentTasks,
    fetchTaskTypes,
    createTask,
    updateTask,
    deleteTask,
    createChildTask,
    fetchChildTasks,
    calculateDaysUntilDue,
    dateToUTC,
    utcToLocalDate,
    STATUSES,
    getValidStatusTransitions,
    isValidStatusTransition
} from './services/task-service.js';
import { showToast, showSuccessToast, showErrorToast } from './toast.js';

// ── DOM References ────────────────────────────────────────────────────────────

const tasksContainer = document.getElementById('tasks-container');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCancelSubmitBtn = document.getElementById('modal-cancel-submit');
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskDescInput = document.getElementById('task-description');
const taskTypeInput = document.getElementById('task-type');
const taskDueDateInput = document.getElementById('task-due-date');

const detailPanel = document.getElementById('task-detail-panel');
const panelCloseBtn = document.getElementById('panel-close-btn');
const panelContent = document.getElementById('panel-content');

// ── Modal Management ──────────────────────────────────────────────────────────

function openCreateTaskModal() {
    childTaskParentId = null;
    taskForm.reset();
    taskTypeInput.readOnly = false;
    taskDueDateInput.readOnly = false;
    document.getElementById('modal-title').textContent = 'Create New Quest';
    taskTitleInput.focus();
    taskModal.classList.add('active');
}

function closeCreateTaskModal() {
    taskModal.classList.remove('active');
    taskForm.reset();
    taskTypeInput.readOnly = false;
    taskDueDateInput.readOnly = false;
    childTaskParentId = null;
}

addTaskBtn?.addEventListener('click', openCreateTaskModal);
modalCancelBtn?.addEventListener('click', closeCreateTaskModal);
modalCancelSubmitBtn?.addEventListener('click', closeCreateTaskModal);

// ── Modal State ──────────────────────────────────────────────────────────────

let childTaskParentId = null;

// ── Load & Render Tasks ───────────────────────────────────────────────────────

async function loadParentTasks() {
    const state = getState();
    if (!state.user) return;

    setState({ loading: true });

    const { data: tasks, error: tasksError } = await fetchParentTasks(state.user.id);
    const { data: types, error: typesError } = await fetchTaskTypes(state.user.id);

    if (tasksError || typesError) {
        showErrorToast('Failed to load quests.');
        setState({ loading: false });
        return;
    }

    setState({ parentTasks: tasks || [], loading: false });
    renderTasks(tasks || [], types || []);
}

function renderTasks(tasks, types) {
    if (!tasksContainer) return;

    if (tasks.length === 0) {
        tasksContainer.innerHTML = '<p style="color: var(--text-muted);">No quests yet. Create one to get started!</p>';
        return;
    }

    // Group tasks by type
    const tasksByType = {};
    types.forEach(t => {
        tasksByType[t.task_type || 'Untyped'] = [];
    });

    tasks.forEach(task => {
        const type = task.task_type || 'Untyped';
        if (!tasksByType[type]) tasksByType[type] = [];
        tasksByType[type].push(task);
    });

    let html = '';

    Object.entries(tasksByType).forEach(([type, typeTasks]) => {
        if (typeTasks.length === 0) return;

        typeTasks.sort((a, b) => {
            const createdAtDifference = new Date(a.created_at) - new Date(b.created_at);
            return createdAtDifference || Number(a.id) - Number(b.id);
        });

        html += `
            <div class="task-section">
                <div class="task-section-header">${escapeHTML(type)}</div>
                <div class="task-grid">
        `;

        typeTasks.forEach(task => {
            const statusClass = `task-card-status--${task.status.toLowerCase().replace(/\s+/g, '')}`;
            html += `
                <div class="task-card" data-task-id="${task.id}">
                    <div class="task-card-title">${escapeHTML(task.title)}</div>
                    <div class="task-card-meta">
                        <div class="task-card-status ${statusClass}">${task.status}</div>
                        <div class="task-card-children">${task.child_count} subtask${task.child_count !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    tasksContainer.innerHTML = html;

    // Attach click handlers
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', () => {
            const taskId = parseInt(card.dataset.taskId);
            openDetailPanel(taskId);
        });
    });
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

async function openDetailPanel(taskId) {
    const state = getState();
    const task = state.parentTasks.find(t => t.id === taskId);

    if (!task) return;

    setState({ selectedTaskId: taskId });

    // Fetch child tasks
    const { data: children, error: childrenError } = await fetchChildTasks(taskId);

    if (childrenError) {
        showErrorToast('Failed to load subtasks.');
        return;
    }

    renderTaskDetail(task, children || [], true);
}

function renderTaskDetail(task, children, isParent, parentTaskId = null) {
    const dayInfo = calculateDaysUntilDue(task.due_date);
    const parentTask = parentTaskId
        ? getState().parentTasks.find(parent => parent.id === parentTaskId)
        : null;

    let childHTML = '';
    if (isParent && children.length > 0) {
        childHTML = '<div class="child-tasks"><div class="task-detail-label">Subtasks</div>';
        children.forEach(child => {
            childHTML += `
                <button type="button" class="child-task-item" data-child-task-id="${child.id}">
                    <div class="child-task-title">${escapeHTML(child.title)}</div>
                    <div class="child-task-status">${child.status}</div>
                </button>
            `;
        });
        childHTML += '</div>';
    }

    const dueHTML = task.due_date
        ? `<div class="task-detail-field">
               <div class="task-detail-label">Due Date</div>
               <div class="task-detail-value">${utcToLocalDate(task.due_date)}</div>
               <div class="task-detail-value--muted">${dayInfo.text}</div>
           </div>`
        : '';

    panelContent.innerHTML = `
        ${!isParent && parentTask ? `
            <button type="button" class="button task-detail-back" id="back-to-parent-btn">
                ← Back to ${escapeHTML(parentTask.title)}
            </button>
        ` : ''}

        <div class="task-detail-field">
            <div class="task-detail-label">Title</div>
            <div class="task-detail-value">${escapeHTML(task.title)}</div>
        </div>

        ${task.description ? `
            <div class="task-detail-field">
                <div class="task-detail-label">Description</div>
                <div class="task-detail-value">${escapeHTML(task.description)}</div>
            </div>
        ` : ''}

        <div class="task-detail-field">
            <div class="task-detail-label">Status</div>
            <select id="status-select" class="task-detail-value" style="background: var(--surface); border: 1px solid var(--border); padding: 0.5em; border-radius: var(--radius);">
                ${STATUSES.map(status =>
                    `<option value="${status}" ${status === task.status ? 'selected' : ''}>${status}</option>`
                ).join('')}
            </select>
        </div>

        ${task.task_type ? `
            <div class="task-detail-field">
                <div class="task-detail-label">Quest Type</div>
                <div class="task-detail-value">${escapeHTML(task.task_type)}</div>
            </div>
        ` : ''}

        ${dueHTML}

        ${childHTML}

        <div class="task-detail-actions">
            ${isParent ? '<button type="button" class="button button--primary add-child-btn" id="add-child-btn">+ Add Subtask</button>' : `
                <span class="task-detail-parent-note">This subtask belongs to the parent quest above.</span>
            `}
            <button type="button" class="button button--danger" id="delete-task-btn">Delete ${isParent ? 'Quest' : 'Subtask'}</button>
        </div>
    `;

    // Status change handler
    const statusSelect = document.getElementById('status-select');
    statusSelect?.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        const { error } = await updateTask(task.id, { status: newStatus });

        if (error) {
            showErrorToast('Failed to update status.');
            return;
        }

        showSuccessToast('Status updated!');
        await loadParentTasks();
        openDetailPanel(task.id); // Refresh panel
    });

    if (isParent) {
        document.getElementById('add-child-btn')?.addEventListener('click', () => {
            openCreateChildTaskModal(task);
        });

        document.querySelectorAll('[data-child-task-id]').forEach(childElement => {
            childElement.addEventListener('click', () => {
                const child = children.find(item => item.id === Number(childElement.dataset.childTaskId));
                if (child) {
                    renderTaskDetail(child, [], false, task.id);
                }
            });
        });
    } else {
        document.getElementById('back-to-parent-btn')?.addEventListener('click', () => {
            openDetailPanel(parentTaskId);
        });
    }

    document.getElementById('delete-task-btn')?.addEventListener('click', async () => {
        const label = isParent ? 'quest' : 'subtask';
        if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;

        const deleteButton = document.getElementById('delete-task-btn');
        deleteButton.disabled = true;

        const { error } = await deleteTask(task.id);
        if (error) {
            showErrorToast(`Failed to delete ${label}: ${error.message}`);
            deleteButton.disabled = false;
            return;
        }

        showSuccessToast(`${isParent ? 'Quest' : 'Subtask'} deleted.`);
        closeDetailPanel();
        await loadParentTasks();
        if (!isParent && parentTaskId) {
            openDetailPanel(parentTaskId);
        }
    });

    detailPanel?.classList.add('active');
}

function closeDetailPanel() {
    setState({ selectedTaskId: null });
    detailPanel?.classList.remove('active');
}

panelCloseBtn?.addEventListener('click', closeDetailPanel);

// ── Create Child Task Modal ───────────────────────────────────────────────────

function openCreateChildTaskModal(parentTask) {
    childTaskParentId = parentTask.id;
    taskForm.reset();
    taskTypeInput.value = parentTask.task_type || '';
    taskTypeInput.readOnly = true;
    taskDueDateInput.value = parentTask.due_date ? utcToLocalDate(parentTask.due_date) : '';
    taskDueDateInput.readOnly = true;
    document.getElementById('modal-title').textContent = 'Create New Subtask';
    taskTitleInput.focus();
    taskModal.classList.add('active');
}

// ── Task Submission (unified for parent & child) ──────────────────────────────

taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const state = getState();
    if (!state.user) {
        showErrorToast('You must be logged in.');
        return;
    }

    const title = taskTitleInput.value.trim();
    if (!title) {
        showErrorToast('Task title is required.');
        return;
    }

    setState({ loading: true });

    const taskData = {
        title,
        description: taskDescInput.value.trim() || null,
        taskType: taskTypeInput.value.trim() || null,
        dueDate: taskDueDateInput.value ? dateToUTC(taskDueDateInput.value) : null
    };

    let result;
    if (childTaskParentId) {
        result = await createChildTask(state.user.id, childTaskParentId, taskData);
    } else {
        result = await createTask(state.user.id, taskData);
    }

    const { data, error } = result;

    if (error) {
        showErrorToast(`Failed to create: ${error.message}`);
        setState({ loading: false });
        return;
    }

    showSuccessToast('Created!');
    const createdForParentId = childTaskParentId;
    closeCreateTaskModal();

    if (createdForParentId) {
        await loadParentTasks();
        openDetailPanel(createdForParentId);
    } else {
        await loadParentTasks();
    }

    setState({ loading: false });
});

// ── Subscribe to State Changes ────────────────────────────────────────────────

subscribe(async (state) => {
    if (state.user && !state.loading) {
        // User just signed in, load tasks
        if (state.parentTasks.length === 0) {
            await loadParentTasks();
        }
    }
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Initial Load ──────────────────────────────────────────────────────────────

window.addEventListener('userSignedIn', async () => {
    await loadParentTasks();
});
