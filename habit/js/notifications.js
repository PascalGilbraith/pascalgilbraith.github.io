/**
 * Notifications Module
 * Handles notification permissions and scheduling for habit reminders
 */

/**
 * Check if notifications are supported
 * @returns {boolean} True if Notification API is available
 */
export function isNotificationSupported() {
    return 'Notification' in window;
}

/**
 * Get current notification permission status
 * @returns {string} 'granted', 'denied', or 'default'
 */
export function getNotificationPermission() {
    if (!isNotificationSupported()) {
        return 'denied';
    }
    return Notification.permission;
}

/**
 * Request notification permission from user
 * @returns {Promise<string>} Resolves to permission status ('granted', 'denied', or 'default')
 */
export async function requestNotificationPermission() {
    if (!isNotificationSupported()) {
        console.log('Notifications are not supported in this browser');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
}

/**
 * Show a notification
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 * @returns {Notification|null} Notification instance or null
 */
export function showNotification(title, options = {}) {
    if (!isNotificationSupported() || Notification.permission !== 'granted') {
        console.log(`[Notifications] Cannot show notification: ${!isNotificationSupported() ? 'not supported' : 'permission not granted (' + Notification.permission + ')'}`);
        return null;
    }

    const defaultOptions = {
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'habit-reminder',
        requireInteraction: false,
        ...options
    };

    try {
        console.log(`[Notifications] Showing notification: "${title}"`);
        const notification = new Notification(title, defaultOptions);
        
        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);
        
        return notification;
    } catch (error) {
        console.error('[Notifications] Error showing notification:', error);
        return null;
    }
}

/**
 * Check if a habit should trigger a notification
 * @param {Object} habit - Habit object with notificationTime, completions, and daysOfWeek
 * @returns {boolean} True if notification should be shown
 */
export function shouldNotifyForHabit(habit) {
    console.log(`[Notifications] Checking habit: ${habit.name}`);
    
    // No notification time set
    if (!habit.notificationTime) {
        console.log(`[Notifications] - No notification time set`);
        return false;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    console.log(`[Notifications] - Current time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}, Notification time: ${habit.notificationTime}`);
    
    // Check if habit is active today
    if (!habit.isActiveOnDay(now)) {
        console.log(`[Notifications] - Not active today (day ${now.getDay()})`);
        return false;
    }

    // Check if already completed today
    if (habit.isCompletedOn(today)) {
        console.log(`[Notifications] - Already completed today`);
        return false;
    }

    // Check if current time matches notification time (within 1 minute window)
    const [notifHour, notifMinute] = habit.notificationTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if we're within the notification minute
    if (currentHour === notifHour && currentMinute === notifMinute) {
        console.log(`[Notifications] - ✓ Time matches! Showing notification`);
        return true;
    }

    console.log(`[Notifications] - Time doesn't match (current: ${currentHour}:${currentMinute}, target: ${notifHour}:${notifMinute})`);
    return false;
}

/**
 * Get the next notification time for a habit
 * @param {Object} habit - Habit object with notificationTime
 * @returns {Date|null} Next notification time or null
 */
export function getNextNotificationTime(habit) {
    if (!habit.notificationTime) {
        return null;
    }

    const [hour, minute] = habit.notificationTime.split(':').map(Number);
    const now = new Date();
    const notificationTime = new Date();
    notificationTime.setHours(hour, minute, 0, 0);

    // If notification time has passed today, schedule for tomorrow
    if (notificationTime <= now) {
        notificationTime.setDate(notificationTime.getDate() + 1);
    }

    // Find next active day if habit has specific days
    if (habit.daysOfWeek && habit.daysOfWeek.length > 0 && habit.daysOfWeek.length < 7) {
        let daysChecked = 0;
        while (daysChecked < 7) {
            const dayOfWeek = notificationTime.getDay();
            if (habit.daysOfWeek.includes(dayOfWeek)) {
                break;
            }
            notificationTime.setDate(notificationTime.getDate() + 1);
            daysChecked++;
        }
    }

    return notificationTime;
}

/**
 * Schedule a notification for a habit (using intervals since Web API doesn't support precise scheduling)
 * @param {Object} habit - Habit object
 * @param {Function} callback - Callback function to execute when notification should fire
 * @returns {number} Interval ID
 */
export function scheduleNotificationCheck(habit, callback) {
    // Check every minute if notification should fire
    const intervalId = setInterval(() => {
        if (shouldNotifyForHabit(habit)) {
            callback(habit);
        }
    }, 60000); // Check every minute

    return intervalId;
}

/**
 * Cancel a scheduled notification check
 * @param {number} intervalId - Interval ID returned from scheduleNotificationCheck
 */
export function cancelNotificationCheck(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

/**
 * Show a habit reminder notification
 * @param {Object} habit - Habit object
 * @returns {Notification|null} Notification instance or null
 */
export function showHabitReminder(habit) {
    const title = `Time for: ${habit.name}`;
    const body = `Don't forget to complete your habit today!`;
    
    const options = {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: `habit-${habit.id}`,
        requireInteraction: true,
        actions: [
            { action: 'complete', title: 'Mark Complete' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    return showNotification(title, options);
}

/**
 * Check all habits and show notifications for those that need it
 * @param {Array} habits - Array of habit objects
 */
export function checkAllHabitsForNotifications(habits) {
    console.log(`[Notifications] Checking ${habits.length} habits for notifications`);
    
    if (!isNotificationSupported()) {
        console.log('[Notifications] Notifications not supported');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        console.log(`[Notifications] Permission not granted (status: ${Notification.permission})`);
        return;
    }

    let notificationsSent = 0;
    habits.forEach(habit => {
        if (shouldNotifyForHabit(habit)) {
            showHabitReminder(habit);
            notificationsSent++;
        }
    });
    
    console.log(`[Notifications] Sent ${notificationsSent} notifications`);
}

/**
 * Get notification statistics
 * @param {Array} habits - Array of habit objects
 * @returns {Object} Notification statistics
 */
export function getNotificationStats(habits) {
    const withNotifications = habits.filter(h => h.notificationTime).length;
    const permissionStatus = getNotificationPermission();
    const supported = isNotificationSupported();

    return {
        total: habits.length,
        withNotifications,
        permissionStatus,
        supported,
        enabled: permissionStatus === 'granted' && supported
    };
}
