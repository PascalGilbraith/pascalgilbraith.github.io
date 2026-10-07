/**
 * Stacks Module
 * Groups habits that share a notification time into "habit stacks".
 * Each habit is still tracked individually; a stack is only a presentation grouping.
 */

/** Maximum length of a custom stack name */
export const MAX_STACK_NAME_LENGTH = 50;

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Check whether a string is a valid HH:MM time (the key of a stack)
 * @param {*} time - Value to check
 * @returns {boolean} True if valid
 */
export function isValidStackTime(time) {
    return typeof time === 'string' && TIME_REGEX.test(time);
}

/**
 * Get the display name of a stack: the custom name, or the time by default
 * @param {string} time - Stack time (HH:MM)
 * @param {Object<string, string>} stackNames - Map of time -> custom name
 * @returns {string} Display name
 */
export function getStackName(time, stackNames = {}) {
    const custom = stackNames && Object.prototype.hasOwnProperty.call(stackNames, time) ? stackNames[time] : '';
    return typeof custom === 'string' && custom.trim() !== '' ? custom.trim() : time;
}

/**
 * Normalise user input for a stack name. Empty input means "use the default (time)".
 * @param {string} name - Raw name
 * @returns {string} Trimmed name truncated to the maximum length ('' for default)
 */
export function sanitizeStackName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/\s+/g, ' ').trim().substring(0, MAX_STACK_NAME_LENGTH);
}

/**
 * Validate and clean a stack-name map loaded from storage or an import file
 * @param {*} raw - Untrusted value
 * @returns {{names: Object<string, string>, errors: string[]}} Cleaned map and any problems found
 */
export function validateStackNames(raw) {
    const errors = [];
    const names = {};
    if (raw === undefined || raw === null) return { names, errors };
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { names, errors: ['stackNames must be an object'] };
    }
    for (const [time, name] of Object.entries(raw)) {
        if (!isValidStackTime(time)) {
            errors.push(`Invalid stack time "${String(time).substring(0, 20)}" (expected HH:MM)`);
        } else if (typeof name !== 'string') {
            errors.push(`Stack name for ${time} must be a string`);
        } else if (name.length > MAX_STACK_NAME_LENGTH) {
            errors.push(`Stack name for ${time} exceeds ${MAX_STACK_NAME_LENGTH} characters`);
        } else {
            const clean = sanitizeStackName(name);
            if (clean) names[time] = clean;
        }
    }
    return { names, errors };
}

/**
 * Group habits into display items.
 *
 * Habits sharing a notification time form a stack when there are two or more of them.
 * A lone timed habit stays a plain habit item. Timed items come first, in time order;
 * habits with no notification time follow. Habit order within each group is preserved.
 *
 * @param {Array<Habit>} habits - Habits, already in the desired order
 * @param {Object<string, string>} stackNames - Map of time -> custom name
 * @returns {Array<{type: 'stack', time: string, name: string, habits: Array<Habit>}|{type: 'habit', habit: Habit}>}
 */
export function groupHabitsIntoStacks(habits, stackNames = {}) {
    const byTime = new Map();
    const untimed = [];

    for (const habit of habits || []) {
        if (habit.isLongTerm()) continue; // long-term habits are listed in their own sections
        if (habit.notificationTime) {
            if (!byTime.has(habit.notificationTime)) byTime.set(habit.notificationTime, []);
            byTime.get(habit.notificationTime).push(habit);
        } else {
            untimed.push(habit);
        }
    }

    const items = [];
    for (const time of [...byTime.keys()].sort()) {
        const group = byTime.get(time);
        if (group.length >= 2) {
            items.push({ type: 'stack', time, name: getStackName(time, stackNames), habits: group });
        } else {
            items.push({ type: 'habit', habit: group[0] });
        }
    }
    for (const habit of untimed) {
        items.push({ type: 'habit', habit });
    }
    return items;
}

/**
 * Get the habits that can be reordered relative to each other: those in the same stack
 * (same notification time), or all untimed habits.
 * @param {Array<Habit>} habits - Habits in display order
 * @param {Habit} habit - The habit being moved
 * @returns {Array<Habit>} Peers (including the habit itself) in display order
 */
export function getReorderPeers(habits, habit) {
    if (habit.isLongTerm()) return [];
    const key = habit.notificationTime || '';
    return habits.filter(h => !h.isLongTerm() && (h.notificationTime || '') === key);
}
