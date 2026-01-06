/**
 * Habit Class
 * Represents a single habit with tracking and scheduling capabilities
 */
export class Habit {
    /**
     * Create a new Habit
     * @param {string} name - The name of the habit
     * @param {string} createdDate - ISO date string when habit was created
     * @param {Array<string>} completions - Array of ISO date strings when habit was completed
     * @param {string|null} notificationTime - Time string in HH:MM format for notifications (optional)
     * @param {Array<number>|null} daysOfWeek - Array of day numbers (0-6, Sunday-Saturday) when habit is active (optional, null means all days)
     * @param {string} notes - Optional notes or description for the habit
     * @param {Array<string>} tags - Optional array of category tags
     */
    constructor(name, createdDate = null, completions = [], notificationTime = null, daysOfWeek = null, notes = '', tags = []) {
        this.id = this._generateId();
        this.name = name;
        this.createdDate = createdDate || new Date().toISOString().split('T')[0];
        this.completions = completions || [];
        this.notificationTime = notificationTime;
        this.daysOfWeek = daysOfWeek; // null means all days, array means specific days
        this.notes = notes || '';
        this.tags = tags || [];
    }

    /**
     * Generate a unique ID for the habit
     * @returns {string} Unique identifier
     * @private
     */
    _generateId() {
        return `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Mark the habit as completed for a specific date
     * @param {string} date - ISO date string (YYYY-MM-DD)
     */
    markCompleted(date) {
        const dateStr = this._normalizeDate(date);
        if (!this.completions.includes(dateStr)) {
            this.completions.push(dateStr);
            this.completions.sort(); // Keep completions sorted chronologically
        }
    }

    /**
     * Mark the habit as incomplete for a specific date
     * @param {string} date - ISO date string (YYYY-MM-DD)
     */
    markIncomplete(date) {
        const dateStr = this._normalizeDate(date);
        const index = this.completions.indexOf(dateStr);
        if (index > -1) {
            this.completions.splice(index, 1);
        }
    }

    /**
     * Check if the habit was completed on a specific date
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {boolean} True if completed on that date
     */
    isCompletedOn(date) {
        const dateStr = this._normalizeDate(date);
        return this.completions.includes(dateStr);
    }

    /**
     * Check if the habit is active on a given day of the week
     * @param {number|Date|string} dayOrDate - Day number (0-6) or Date object or date string
     * @returns {boolean} True if habit is scheduled for this day
     */
    isActiveOnDay(dayOrDate) {
        // If no specific days are set, habit is active every day
        if (!this.daysOfWeek || this.daysOfWeek.length === 0) {
            return true;
        }

        let dayOfWeek;
        if (typeof dayOrDate === 'number') {
            dayOfWeek = dayOrDate;
        } else if (dayOrDate instanceof Date) {
            dayOfWeek = dayOrDate.getDay();
        } else {
            // Assume it's a date string in YYYY-MM-DD format
            // Parse manually to avoid UTC timezone issues
            const parts = dayOrDate.split('-');
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            dayOfWeek = date.getDay();
        }

        return this.daysOfWeek.includes(dayOfWeek);
    }

    /**
     * Calculate the current streak (consecutive days completed)
     * Takes into account scheduled days of the week
     * @returns {number} Number of consecutive days (or scheduled days) completed
     */
    calculateStreak() {
        if (this.completions.length === 0) {
            return 0;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let currentDate = new Date(today);
        let streak = 0;
        let checkingToday = true;
        let daysChecked = 0;

        // Walk backwards from today
        while (daysChecked < 365) {
            const dateStr = this._normalizeDate(currentDate);
            
            // Check if this day should be counted (is it a scheduled day?)
            if (this.isActiveOnDay(currentDate)) {
                // If it's completed, increment streak
                if (this.isCompletedOn(dateStr)) {
                    streak++;
                    checkingToday = false;
                } else {
                    // If we're checking today and it's not completed, that's ok
                    // Continue checking yesterday
                    if (checkingToday) {
                        checkingToday = false;
                    } else {
                        // If it's a past scheduled day that wasn't completed, streak is broken
                        break;
                    }
                }
            }
            // If this day isn't scheduled, skip it and continue checking

            // Move to previous day
            currentDate.setDate(currentDate.getDate() - 1);
            daysChecked++;
        }

        return streak;
    }

    /**
     * Get completion statistics for the habit
     * @returns {Object} Statistics object with various metrics
     */
    getStatistics() {
        const totalCompletions = this.completions.length;
        const currentStreak = this.calculateStreak();
        
        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 0;
        const sortedCompletions = [...this.completions].sort();
        
        for (let i = 0; i < sortedCompletions.length; i++) {
            if (i === 0) {
                tempStreak = 1;
            } else {
                const prevDate = new Date(sortedCompletions[i - 1]);
                const currDate = new Date(sortedCompletions[i]);
                
                // Check all days between prev and current
                let allScheduledDaysCompleted = true;
                let checkDate = new Date(prevDate);
                checkDate.setDate(checkDate.getDate() + 1);
                
                while (checkDate < currDate) {
                    if (this.isActiveOnDay(checkDate)) {
                        allScheduledDaysCompleted = false;
                        break;
                    }
                    checkDate.setDate(checkDate.getDate() + 1);
                }
                
                if (allScheduledDaysCompleted) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Calculate completion rate (days completed vs days since creation)
        const createdDateObj = new Date(this.createdDate);
        const today = new Date();
        const daysSinceCreation = Math.floor((today - createdDateObj) / (1000 * 60 * 60 * 24)) + 1;
        
        // Count how many scheduled days have passed since creation
        let scheduledDaysPassed = 0;
        if (this.daysOfWeek && this.daysOfWeek.length > 0) {
            const checkDate = new Date(createdDateObj);
            while (checkDate <= today) {
                if (this.isActiveOnDay(checkDate)) {
                    scheduledDaysPassed++;
                }
                checkDate.setDate(checkDate.getDate() + 1);
            }
        } else {
            scheduledDaysPassed = daysSinceCreation;
        }
        
        const completionRate = scheduledDaysPassed > 0 
            ? Math.round((totalCompletions / scheduledDaysPassed) * 100) 
            : 0;

        return {
            totalCompletions,
            currentStreak,
            longestStreak,
            completionRate,
            daysSinceCreation,
            scheduledDaysPassed
        };
    }

    /**
     * Set or update the notification time
     * @param {string|null} time - Time string in HH:MM format, or null to disable
     */
    setNotificationTime(time) {
        if (time === null || time === '') {
            this.notificationTime = null;
        } else if (this._isValidTimeString(time)) {
            this.notificationTime = time;
        } else {
            throw new Error('Invalid time format. Use HH:MM format (e.g., "09:00" or "14:30")');
        }
    }

    /**
     * Get the notification time
     * @returns {string|null} Time string in HH:MM format or null
     */
    getNotificationTime() {
        return this.notificationTime;
    }

    /**
     * Set or update the days of week when habit is active
     * @param {Array<number>|null} days - Array of day numbers (0-6), or null for all days
     */
    setDaysOfWeek(days) {
        if (days === null || days.length === 0) {
            this.daysOfWeek = null;
        } else if (Array.isArray(days) && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
            this.daysOfWeek = [...new Set(days)].sort(); // Remove duplicates and sort
        } else {
            throw new Error('Invalid days array. Must be an array of integers between 0-6');
        }
    }

    /**
     * Get the days of week when habit is active
     * @returns {Array<number>|null} Array of day numbers or null (meaning all days)
     */
    getDaysOfWeek() {
        return this.daysOfWeek;
    }

    /**
     * Get a human-readable string of active days
     * @returns {string} String representation of active days
     */
    getDaysOfWeekString() {
        if (!this.daysOfWeek || this.daysOfWeek.length === 0) {
            return 'Every day';
        }

        if (this.daysOfWeek.length === 7) {
            return 'Every day';
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Check for weekdays
        if (this.daysOfWeek.length === 5 && 
            this.daysOfWeek.every(d => d >= 1 && d <= 5)) {
            return 'Weekdays';
        }
        
        // Check for weekends
        if (this.daysOfWeek.length === 2 && 
            this.daysOfWeek.includes(0) && this.daysOfWeek.includes(6)) {
            return 'Weekends';
        }

        return this.daysOfWeek.map(d => dayNames[d]).join(', ');
    }

    /**
     * Normalize a date to ISO format (YYYY-MM-DD)
     * @param {string|Date} date - Date to normalize
     * @returns {string} ISO date string
     * @private
     */
    _normalizeDate(date) {
        if (typeof date === 'string') {
            return date.split('T')[0];
        }
        // Use local date parts to avoid UTC timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Validate time string format
     * @param {string} time - Time string to validate
     * @returns {boolean} True if valid HH:MM format
     * @private
     */
    _isValidTimeString(time) {
        const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        return timeRegex.test(time);
    }

    /**
     * Convert habit to plain object for storage
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            createdDate: this.createdDate,
            completions: this.completions,
            notificationTime: this.notificationTime,
            daysOfWeek: this.daysOfWeek,
            notes: this.notes,
            tags: this.tags
        };
    }

    /**
     * Create a Habit instance from a plain object
     * @param {Object} obj - Plain object with habit data
     * @returns {Habit} New Habit instance
     * @static
     */
    static fromJSON(obj) {
        const habit = new Habit(
            obj.name,
            obj.createdDate,
            obj.completions,
            obj.notificationTime,
            obj.daysOfWeek,
            obj.notes,
            obj.tags
        );
        habit.id = obj.id;
        return habit;
    }
}
