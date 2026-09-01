// js/toast.js
// Simple toast notification system

const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

export function showSuccessToast(message, duration = 3000) {
    showToast(message, 'success', duration);
}

export function showErrorToast(message, duration = 3000) {
    showToast(message, 'error', duration);
}

export function showWarningToast(message, duration = 3000) {
    showToast(message, 'warning', duration);
}
