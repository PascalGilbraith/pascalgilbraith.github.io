/**
 * Storage Module
 * Handles all localStorage operations for the Habit Tracker app
 */

import { Habit } from './habit.js';

const STORAGE_KEY = 'habitTracker_habits';
const STORAGE_VERSION_KEY = 'habitTracker_version';
const CURRENT_VERSION = '1.0';

/**
 * Save habits to localStorage
 * @param {Array<Habit>} habits - Array of Habit instances to save
 * @returns {boolean} True if successful, false otherwise
 */
export function saveHabits(habits) {
    try {
        if (!Array.isArray(habits)) {
            throw new Error('Habits must be an array');
        }

        // Convert habits to plain objects
        const habitsData = habits.map(habit => habit.toJSON());
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(habitsData));
        localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
        
        return true;
    } catch (error) {
        console.error('Error saving habits:', error);
        return false;
    }
}

/**
 * Load habits from localStorage
 * @returns {Array<Habit>} Array of Habit instances, or empty array if none found
 */
export function loadHabits() {
    try {
        const habitsJson = localStorage.getItem(STORAGE_KEY);
        
        // If no data exists, return empty array
        if (!habitsJson) {
            return [];
        }

        // Parse the JSON data
        const habitsData = JSON.parse(habitsJson);
        
        // Validate that it's an array
        if (!Array.isArray(habitsData)) {
            console.warn('Invalid habits data in localStorage, returning empty array');
            return [];
        }

        // Convert plain objects back to Habit instances
        const habits = habitsData.map(data => Habit.fromJSON(data));
        
        return habits;
    } catch (error) {
        console.error('Error loading habits:', error);
        return [];
    }
}

/**
 * Save a single habit (updates existing or adds new)
 * @param {Habit} habit - Habit instance to save
 * @returns {boolean} True if successful, false otherwise
 */
export function saveHabit(habit) {
    try {
        const habits = loadHabits();
        
        // Find index of existing habit with same ID
        const existingIndex = habits.findIndex(h => h.id === habit.id);
        
        if (existingIndex >= 0) {
            // Update existing habit
            habits[existingIndex] = habit;
        } else {
            // Add new habit
            habits.push(habit);
        }
        
        return saveHabits(habits);
    } catch (error) {
        console.error('Error saving habit:', error);
        return false;
    }
}

/**
 * Delete a habit by ID
 * @param {string} habitId - ID of the habit to delete
 * @returns {boolean} True if successful, false otherwise
 */
export function deleteHabit(habitId) {
    try {
        const habits = loadHabits();
        const filteredHabits = habits.filter(h => h.id !== habitId);
        
        // Only save if something was actually removed
        if (filteredHabits.length === habits.length) {
            console.warn(`Habit with ID ${habitId} not found`);
            return false;
        }
        
        return saveHabits(filteredHabits);
    } catch (error) {
        console.error('Error deleting habit:', error);
        return false;
    }
}

/**
 * Get a single habit by ID
 * @param {string} habitId - ID of the habit to retrieve
 * @returns {Habit|null} Habit instance or null if not found
 */
export function getHabitById(habitId) {
    try {
        const habits = loadHabits();
        const habit = habits.find(h => h.id === habitId);
        return habit || null;
    } catch (error) {
        console.error('Error getting habit:', error);
        return null;
    }
}

/**
 * Clear all habit data from localStorage
 * @returns {boolean} True if successful, false otherwise
 */
export function clearAllData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_VERSION_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing data:', error);
        return false;
    }
}

/**
 * Get the current storage version
 * @returns {string|null} Version string or null if not set
 */
export function getStorageVersion() {
    try {
        return localStorage.getItem(STORAGE_VERSION_KEY);
    } catch (error) {
        console.error('Error getting storage version:', error);
        return null;
    }
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available and working
 */
export function isStorageAvailable() {
    try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('localStorage is not available:', error);
        return false;
    }
}

/**
 * Get storage statistics
 * @returns {Object} Object with storage info (habitCount, storageSize, version)
 */
export function getStorageStats() {
    try {
        const habits = loadHabits();
        const habitsJson = localStorage.getItem(STORAGE_KEY) || '';
        const version = getStorageVersion();
        
        return {
            habitCount: habits.length,
            storageSize: new Blob([habitsJson]).size, // Size in bytes
            version: version || 'unknown',
            isAvailable: isStorageAvailable()
        };
    } catch (error) {
        console.error('Error getting storage stats:', error);
        return {
            habitCount: 0,
            storageSize: 0,
            version: 'unknown',
            isAvailable: false
        };
    }
}

/**
 * Export all habits data as JSON string
 * @returns {string} JSON string of all habits data
 */
export function exportData() {
    try {
        const habits = loadHabits();
        const data = {
            version: CURRENT_VERSION,
            exportDate: new Date().toISOString(),
            habits: habits.map(h => h.toJSON())
        };
        return JSON.stringify(data, null, 2);
    } catch (error) {
        console.error('Error exporting data:', error);
        return null;
    }
}

/**
 * Import habits data from JSON string
 * @param {string} jsonString - JSON string containing habits data
 * @param {boolean} merge - If true, merge with existing data; if false, replace
 * @returns {boolean} True if successful, false otherwise
 */
export function importData(jsonString, merge = false) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validate the data structure
        if (!data.habits || !Array.isArray(data.habits)) {
            throw new Error('Invalid data format: missing habits array');
        }

        // Convert to Habit instances
        const importedHabits = data.habits.map(h => Habit.fromJSON(h));
        
        if (merge) {
            // Merge with existing habits
            const existingHabits = loadHabits();
            const allHabits = [...existingHabits];
            
            // Add imported habits, avoiding duplicates by ID
            for (const habit of importedHabits) {
                const existingIndex = allHabits.findIndex(h => h.id === habit.id);
                if (existingIndex >= 0) {
                    // Update existing
                    allHabits[existingIndex] = habit;
                } else {
                    // Add new
                    allHabits.push(habit);
                }
            }
            
            return saveHabits(allHabits);
        } else {
            // Replace all data
            return saveHabits(importedHabits);
        }
    } catch (error) {
        console.error('Error importing data:', error);
        return false;
    }
}
