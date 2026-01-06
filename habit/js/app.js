/**
 * Main Application Controller
 * Coordinates all modules and handles user interactions
 */

import { Habit } from './habit.js';
import * as Storage from './storage.js';
import * as UI from './ui.js';
import * as Notifications from './notifications.js';

// Application state
let habits = [];
let currentView = 'all'; // 'all' or 'today'
let deferredPrompt = null; // Store install prompt event
let notificationCheckInterval = null; // Interval for checking notifications

/**
 * Initialize the application
 */
function init() {
    try {
        console.log('Initializing Habit Tracker...');
        console.log('User Agent:', navigator.userAgent);
        
        // Check if storage is available
        if (!Storage.isStorageAvailable()) {
            console.error('localStorage is not available');
            UI.showNotification('Storage is not available. Your data may not be saved.', 'error');
            // Continue initialization anyway - some features may work
        }

        // Load habits from storage
        loadHabits();
        console.log('Loaded habits:', habits);

    // Set up event listeners
    setupEventListeners();

    // Register service worker for PWA
    registerServiceWorker();

    // Initialize theme
    initializeTheme();
    
    // Setup install prompt
    setupInstallPrompt();
    
    // Setup notifications
    setupNotifications();

    // Render the initial view
    renderHabits();

    console.log('Habit Tracker initialized successfully');
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        UI.showNotification('Failed to initialize app. Please refresh the page.', 'error');
    }
}

/**
 * Load habits from storage
 */
function loadHabits() {
    habits = Storage.loadHabits();
    console.log(`Loaded ${habits.length} habits from storage`);
}

/**
 * Save habits to storage
 */
function saveHabits() {
    const success = Storage.saveHabits(habits);
    if (!success) {
        UI.showNotification('Failed to save habits', 'error');
    }
    return success;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Add Habit button
    const addHabitBtn = document.getElementById('add-habit-btn');
    if (addHabitBtn) {
        addHabitBtn.addEventListener('click', handleAddHabitClick);
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => UI.showModal('settings-modal'));
    }

    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }

    // Import button
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => document.getElementById('import-file').click());
    }

    // Import file input
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', handleImport);
    }

    // Clear data button
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', handleClearData);
    }

    // Enable notifications button
    const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', handleEnableNotifications);
    }
    
    // Test notification button
    const testNotificationBtn = document.getElementById('test-notification-btn');
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', handleTestNotification);
    }

    // Update notification status when settings modal opens
    const settingsModalForObserver = document.getElementById('settings-modal');
    if (settingsModalForObserver) {
        // Use MutationObserver to detect when modal is shown
        const observer = new MutationObserver(() => {
            if (!settingsModalForObserver.classList.contains('hidden')) {
                updateNotificationStatus();
            }
        });
        observer.observe(settingsModalForObserver, { attributes: true, attributeFilter: ['class'] });
    }

    // Add Habit form submission
    const addHabitForm = document.getElementById('add-habit-form');
    if (addHabitForm) {
        addHabitForm.addEventListener('submit', handleAddHabitSubmit);
    }

    // Cancel button in modal
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancelClick);
    }

    // Edit Habit form submission
    const editHabitForm = document.getElementById('edit-habit-form');
    if (editHabitForm) {
        editHabitForm.addEventListener('submit', handleEditHabitSubmit);
    }

    // Edit Cancel button
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', () => UI.hideModal('edit-habit-modal'));
    }

    // Close modals when clicking outside
    const modal = document.getElementById('add-habit-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                UI.hideModal('add-habit-modal');
            }
        });
    }

    const editModal = document.getElementById('edit-habit-modal');
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                UI.hideModal('edit-habit-modal');
            }
        });
    }

    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                UI.hideModal('settings-modal');
            }
        });
        // Close button
        const closeBtn = settingsModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => UI.hideModal('settings-modal'));
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes modals
        if (e.key === 'Escape') {
            UI.hideModal('add-habit-modal');
            UI.hideModal('edit-habit-modal');
            UI.hideModal('settings-modal');
        }
        
        // Ctrl/Cmd + K to open add habit (like many apps use for "quick add")
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            handleAddHabitClick();
        }
        
        // Ctrl/Cmd + , to open settings
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            UI.showModal('settings-modal');
            updateNotificationStatus();
        }
        
        // Ctrl/Cmd + E to export data
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            handleExport();
        }
    });

    // Theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

/**
 * Handle Add Habit button click
 */
function handleAddHabitClick() {
    UI.showModal('add-habit-modal');
}

/**
 * Handle Add Habit form submission
 */
function handleAddHabitSubmit(e) {
    e.preventDefault();

    try {
        const form = e.target;
        const formData = UI.getHabitFormData(form);

        // Validate form data
        if (!formData || !formData.name || formData.name.trim() === '') {
            UI.showNotification('Please enter a habit name', 'error');
            return;
        }
        
        // Validate habit name length
        if (formData.name.length > 100) {
            UI.showNotification('Habit name is too long (max 100 characters)', 'error');
            return;
        }
        
        // Validate notification time format if provided
        if (formData.notificationTime && !/^\d{2}:\d{2}$/.test(formData.notificationTime)) {
            UI.showNotification('Invalid notification time format', 'error');
            return;
        }

    // Create new habit
    const habit = new Habit(
        formData.name,
        null,
        [],
        formData.notificationTime,
        formData.daysOfWeek,
        formData.notes,
        formData.tags
    );

    // Add to habits array
    habits.push(habit);

    // Save to storage
    if (saveHabits()) {
        UI.showNotification('Habit added successfully!', 'success');
    }

    // Re-render habits
    renderHabits();

    // Close modal and reset form
    UI.hideModal('add-habit-modal');
    form.reset();
    } catch (error) {
        console.error('Error adding habit:', error);
        UI.showNotification('Failed to add habit. Please try again.', 'error');
    }
}

/**
 * Handle cancel button click
 */
function handleCancelClick() {
    UI.hideModal('add-habit-modal');
}

/**
 * Handle habit completion toggle
 */
function handleHabitComplete(habitId, shouldComplete) {
    try {
        if (!habitId) {
            throw new Error('Invalid habit ID');
        }
        
        const habit = habits.find(h => h.id === habitId);
        if (!habit) {
            console.error(`Habit with ID ${habitId} not found`);
            UI.showNotification('Habit not found', 'error');
            return;
        }

        const today = new Date().toISOString().split('T')[0];

    if (shouldComplete) {
        habit.markCompleted(today);
        UI.showNotification(`Great job! "${habit.name}" completed!`, 'success');
    } else {
        habit.markIncomplete(today);
        UI.showNotification(`"${habit.name}" marked as incomplete`, 'info');
    }

    // Save changes
    if (saveHabits()) {
        // Update the UI
        const callbacks = getCallbacks();
        UI.updateHabitCard(habitId, habit, callbacks);
    }
    } catch (error) {
        console.error('Error toggling habit completion:', error);
        UI.showNotification('Failed to update habit. Please try again.', 'error');
    }
}

/**
 * Handle habit deletion
 */
function handleHabitDelete(habitId) {
    try {
        if (!habitId) {
            throw new Error('Invalid habit ID');
        }
        
        const habit = habits.find(h => h.id === habitId);
        if (!habit) {
            console.error(`Habit with ID ${habitId} not found`);
            UI.showNotification('Habit not found', 'error');
            return;
        }

        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete "${habit.name}"? This action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        // Remove from array
        habits = habits.filter(h => h.id !== habitId);

        // Save changes
        if (saveHabits()) {
            UI.showNotification(`"${habit.name}" deleted`, 'info');
            // Remove from UI
            UI.removeHabitCard(habitId);
        } else {
            throw new Error('Failed to save after deletion');
        }
    } catch (error) {
        console.error('Error deleting habit:', error);
        UI.showNotification('Failed to delete habit. Please try again.', 'error');
    }
}

/**
 * Handle habit edit button click
 */
function handleHabitEdit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) {
        console.error(`Habit with ID ${habitId} not found`);
        return;
    }

    // Populate the edit form
    UI.populateEditForm(habit);
    
    // Show the edit modal
    UI.showModal('edit-habit-modal');
}

/**
 * Handle Edit Habit form submission
 */
function handleEditHabitSubmit(e) {
    e.preventDefault();

    try {
        const form = e.target;
        const habitId = form.dataset.habitId;
        
        if (!habitId) {
            throw new Error('No habit ID found in form');
        }

        const habit = habits.find(h => h.id === habitId);
        if (!habit) {
            throw new Error(`Habit with ID ${habitId} not found`);
        }

        const formData = UI.getHabitFormData(form);

        // Validate form data
        if (!formData || !formData.name || formData.name.trim() === '') {
            UI.showNotification('Please enter a habit name', 'error');
            return;
        }
        
        // Validate habit name length
        if (formData.name.length > 100) {
            UI.showNotification('Habit name is too long (max 100 characters)', 'error');
            return;
        }

        // Update habit properties
        habit.name = formData.name;
        habit.setNotificationTime(formData.notificationTime);
        habit.setDaysOfWeek(formData.daysOfWeek);
        habit.notes = formData.notes || '';
        habit.tags = formData.tags || [];

        // Save to storage
        if (saveHabits()) {
            UI.showNotification('Habit updated successfully!', 'success');
        } else {
            throw new Error('Failed to save changes');
        }

        // Update the UI
        const callbacks = getCallbacks();
        UI.updateHabitCard(habitId, habit, callbacks);

        // Close modal
        UI.hideModal('edit-habit-modal');
    } catch (error) {
        console.error('Error updating habit:', error);
        UI.showNotification('Failed to update habit. Please try again.', 'error');
    }
}

/**
 * Get callback functions for UI components
 */
function getCallbacks() {
    return {
        onComplete: handleHabitComplete,
        onDelete: handleHabitDelete,
        onEdit: handleHabitEdit
    };
}

/**
 * Render habits based on current view
 */
function renderHabits() {
    const container = document.getElementById('habits-list');
    if (!container) {
        console.error('Habits list container not found');
        return;
    }

    const callbacks = getCallbacks();

    if (currentView === 'today') {
        UI.renderTodayHabits(habits, container, callbacks);
    } else {
        UI.renderHabitList(habits, container, callbacks);
    }
}

/**
 * Switch between different views
 */
function setView(view) {
    currentView = view;
    renderHabits();
}

/**
 * Setup PWA install prompt
 */
function setupInstallPrompt() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install prompt if not dismissed
        const installDismissed = localStorage.getItem('installDismissed');
        if (!installDismissed) {
            showInstallPrompt();
        }
    });

    // Handle install button click
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', handleInstallClick);
    }

    // Handle dismiss button click
    const dismissBtn = document.getElementById('install-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', handleInstallDismiss);
    }

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        deferredPrompt = null;
        hideInstallPrompt();
        UI.showNotification('Habit Tracker installed successfully!', 'success');
    });
}

/**
 * Show install prompt
 */
function showInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    if (prompt) {
        prompt.classList.remove('hidden');
    }
}

/**
 * Hide install prompt
 */
function hideInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    if (prompt) {
        prompt.classList.add('hidden');
    }
}

/**
 * Handle install button click
 */
async function handleInstallClick() {
    if (!deferredPrompt) {
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // Clear the deferred prompt
    deferredPrompt = null;
    hideInstallPrompt();
}

/**
 * Handle install dismiss button click
 */
function handleInstallDismiss() {
    hideInstallPrompt();
    localStorage.setItem('installDismissed', 'true');
}

/**
 * Setup notification system
 */
function setupNotifications() {
    console.log('[App] Setting up notifications...');
    
    // Check if any habits have notifications enabled
    const hasNotifications = habits.some(h => h.notificationTime);
    console.log(`[App] Habits with notifications: ${habits.filter(h => h.notificationTime).length}`);
    
    if (hasNotifications && Notifications.isNotificationSupported()) {
        const permission = Notifications.getNotificationPermission();
        console.log(`[App] Notification permission: ${permission}`);
        
        // Only start checks if permission already granted
        // Don't auto-prompt - Firefox requires user interaction
        if (permission === 'granted') {
            console.log('[App] Permission already granted, starting checks');
            startNotificationChecks();
        } else if (permission === 'default') {
            console.log('[App] Notification permission not yet requested. Use Settings to enable.');
        } else {
            console.log('[App] Permission denied');
        }
    } else {
        if (!Notifications.isNotificationSupported()) {
            console.log('[App] Notifications not supported in this browser');
        }
        if (!hasNotifications) {
            console.log('[App] No habits have notifications enabled');
        }
    }
}

/**
 * Show notification permission request prompt
 */
function showNotificationPermissionPrompt() {
    const message = 'Enable notifications to get reminders for your habits?';
    if (confirm(message)) {
        requestNotificationPermission();
    }
}

/**
 * Request notification permission and start checks if granted
 */
async function requestNotificationPermission() {
    const permission = await Notifications.requestNotificationPermission();
    
    if (permission === 'granted') {
        UI.showNotification('Notifications enabled! You\'ll receive reminders for your habits.', 'success');
        startNotificationChecks();
    } else if (permission === 'denied') {
        UI.showNotification('Notifications are disabled. You can enable them in your browser settings.', 'info');
    }
}

/**
 * Start checking for notifications every minute
 */
function startNotificationChecks() {
    console.log('[App] Starting notification checks...');
    
    // Clear any existing interval
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    
    // Check immediately
    console.log('[App] Running initial notification check');
    Notifications.checkAllHabitsForNotifications(habits);
    
    // Then check every minute
    notificationCheckInterval = setInterval(() => {
        console.log('[App] Running periodic notification check');
        Notifications.checkAllHabitsForNotifications(habits);
    }, 60000); // Every minute
    
    console.log('[App] Notification checks started (checking every 60 seconds)');
}

/**
 * Stop notification checks
 */
function stopNotificationChecks() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
        notificationCheckInterval = null;
        console.log('Notification checks stopped');
    }
}

/**
 * Handle enable notifications button click
 */
async function handleEnableNotifications() {
    await requestNotificationPermission();
    updateNotificationStatus();
}

/**
 * Update notification status display in settings
 */
function updateNotificationStatus() {
    const statusDiv = document.getElementById('notification-status');
    const enableBtn = document.getElementById('enable-notifications-btn');
    
    if (!statusDiv || !enableBtn) return;
    
    const permission = Notifications.getNotificationPermission();
    const stats = Notifications.getNotificationStats(habits);
    
    if (!Notifications.isNotificationSupported()) {
        statusDiv.textContent = '❌ Notifications are not supported in this browser';
        statusDiv.className = 'disabled';
        enableBtn.style.display = 'none';
    } else if (permission === 'granted') {
        statusDiv.textContent = `✅ Notifications enabled • ${stats.withNotifications} habit${stats.withNotifications !== 1 ? 's' : ''} with reminders`;
        statusDiv.className = 'enabled';
        enableBtn.style.display = 'none';
    } else if (permission === 'denied') {
        statusDiv.textContent = '❌ Notifications blocked. Please enable them in your browser settings.';
        statusDiv.className = 'disabled';
        enableBtn.style.display = 'none';
    } else {
        statusDiv.textContent = '🔔 Enable notifications to receive habit reminders';
        statusDiv.className = 'disabled';
        enableBtn.style.display = 'inline-block';
    }
}

/**
 * Test notification functionality
 */
async function handleTestNotification() {
    console.log('[App] Test notification button clicked');
    
    if (!Notifications.isNotificationSupported()) {
        UI.showNotification('Notifications are not supported in this browser', 'error');
        return;
    }
    
    const permission = Notifications.getNotificationPermission();
    console.log('[App] Current permission:', permission);
    
    if (permission !== 'granted') {
        console.log('[App] Requesting permission...');
        const newPermission = await Notifications.requestNotificationPermission();
        console.log('[App] Permission result:', newPermission);
        
        if (newPermission !== 'granted') {
            UI.showNotification('Permission denied. Please allow notifications in your browser.', 'error');
            updateNotificationStatus();
            return;
        }
    }
    
    // Show test notification
    console.log('[App] Showing test notification...');
    const notification = Notifications.showNotification('🧪 Test Notification', {
        body: 'If you can see this, notifications are working!',
        tag: 'test-notification'
    });
    
    if (notification) {
        console.log('[App] Test notification shown successfully');
        UI.showNotification('Test notification sent!', 'success');
    } else {
        console.log('[App] Failed to show test notification');
        UI.showNotification('Failed to show notification. Check console for details.', 'error');
    }
    
    updateNotificationStatus();
}

/**
 * Register service worker for PWA functionality
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered successfully:', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                UI.showNotification('New version available! Refresh to update.', 'info');
                            }
                        });
                    });
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }
}

/**
 * Initialize theme from localStorage
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcon(savedTheme);
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggleIcon(newTheme);
}

/**
 * Update theme toggle button icon
 */
function updateThemeToggleIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

/**
 * Export data (for future use)
 */
function exportHabits() {
    const data = Storage.exportData();
    if (data) {
        // Create a download link
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        UI.showNotification('Data exported successfully!', 'success');
    } else {
        UI.showNotification('Failed to export data', 'error');
    }
}

/**
 * Handle export button click
 */
function handleExport() {
    exportHabits();
    UI.hideModal('settings-modal');
}

/**
 * Import data (for future use)
 */
function importHabits(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const jsonString = e.target.result;
        const success = Storage.importData(jsonString, false);
        
        if (success) {
            loadHabits();
            renderHabits();
            UI.showNotification('Data imported successfully!', 'success');
        } else {
            UI.showNotification('Failed to import data', 'error');
        }
    };
    
    reader.readAsText(file);
}

/**
 * Handle import file selection
 */
function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
        importHabits(file);
        UI.hideModal('settings-modal');
        // Clear the file input so the same file can be selected again
        event.target.value = '';
    }
}

/**
 * Clear all data (for future use)
 */
function clearAllData() {
    const confirmed = confirm('Are you sure you want to delete ALL habits? This cannot be undone!');
    if (!confirmed) {
        return;
    }

    if (Storage.clearAllData()) {
        habits = [];
        renderHabits();
        UI.showNotification('All data cleared', 'info');
    } else {
        UI.showNotification('Failed to clear data', 'error');
    }
}

/**
 * Handle clear data button click
 */
function handleClearData() {
    clearAllData();
    UI.hideModal('settings-modal');
}

/**
 * Get application statistics
 */
function getAppStats() {
    const storageStats = Storage.getStorageStats();
    
    const totalCompletions = habits.reduce((sum, habit) => {
        return sum + habit.completions.length;
    }, 0);

    const activeToday = habits.filter(h => h.isActiveOnDay(new Date())).length;

    const today = new Date().toISOString().split('T')[0];
    const completedToday = habits.filter(h => h.isCompletedOn(today)).length;

    return {
        totalHabits: habits.length,
        activeToday,
        completedToday,
        totalCompletions,
        storageStats
    };
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export functions for potential external use
export {
    init,
    loadHabits,
    saveHabits,
    renderHabits,
    setView,
    exportHabits,
    importHabits,
    clearAllData,
    getAppStats,
    habits
};
