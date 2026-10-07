/**
 * UI Module
 * Handles all DOM manipulation and rendering for the Habit Tracker app
 */

import { getReorderPeers } from './stacks.js';

/**
 * Render the complete list of habits
 * @param {Array<Habit>} habits - Array of habits to render
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} callbacks - Object with callback functions (onComplete, onDelete, onEdit)
 */
export function renderHabitList(habits, container, callbacks = {}) {
    if (!container) {
        console.error('Container element not provided');
        return;
    }

    const openCalendars = _getOpenCalendarIds(container);

    // Clear existing content
    container.innerHTML = '';

    // If no habits, show empty state
    if (!habits || habits.length === 0) {
        showEmptyState(container);
        return;
    }

    // Hide empty state if it exists
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.classList.add('hidden');
    }

    // Use DocumentFragment for batched DOM insertion (performance optimization)
    const fragment = document.createDocumentFragment();

    // Render each habit
    habits.forEach(habit => {
        const habitCard = renderHabitCard(habit, callbacks);
        fragment.appendChild(habitCard);
    });

    container.appendChild(fragment);
    _restoreOpenCalendars(container, openCalendars);
}

/**
 * Render habits grouped into stacks (see stacks.js groupHabitsIntoStacks).
 * Each habit in a stack keeps its own card and completion button.
 * @param {Array<Object>} items - Items from groupHabitsIntoStacks
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} callbacks - Card callbacks plus optional onRenameStack(time, currentName)
 * @param {Array<Habit>} [longTermHabits=[]] - Long-term habits, shown in "Due now" and "Long-term" sections
 */
export function renderStackedHabitList(items, container, callbacks = {}, longTermHabits = []) {
    if (!container) {
        console.error('Container element not provided');
        return;
    }

    const openCalendars = _getOpenCalendarIds(container);
    const wasLongTermOpen = !!container.querySelector('.long-term-section[open]');
    container.innerHTML = '';

    if ((!items || items.length === 0) && longTermHabits.length === 0) {
        showEmptyState(container);
        return;
    }

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.classList.add('hidden');
    }

    const now = new Date();
    const dueNow = longTermHabits
        .filter(h => h.isDue(now) && !h.isDismissedOn(now))
        .sort((a, b) => b.getUrgencyLevel(now) - a.getUrgencyLevel(now) ||
            a.getDaysUntilDue(now) - b.getDaysUntilDue(now));
    const dueIds = new Set(dueNow.map(h => h.id));
    const later = longTermHabits
        .filter(h => !dueIds.has(h.id))
        .sort((a, b) => a.getNextDueDate().localeCompare(b.getNextDueDate()));

    // Plain habits form one reorder section (the untimed ones); lone timed habits can't move
    const plainHabits = items.filter(i => i.type === 'habit').map(i => i.habit);
    const untimed = plainHabits.filter(h => !h.notificationTime);

    const fragment = document.createDocumentFragment();

    if (dueNow.length > 0) {
        const section = document.createElement('section');
        section.className = 'due-now-section';
        section.setAttribute('aria-labelledby', 'due-now-title');
        section.innerHTML = `<h2 class="section-title" id="due-now-title">Due now <span class="section-count">${dueNow.length}</span></h2><div class="due-now-list"></div>`;
        const list = section.querySelector('.due-now-list');
        dueNow.forEach(h => list.appendChild(renderHabitCard(h, callbacks)));
        fragment.appendChild(section);
    }

    for (const item of items) {
        if (item.type === 'stack') {
            fragment.appendChild(renderStack(item, callbacks));
        } else {
            const peers = item.habit.notificationTime ? [item.habit] : untimed;
            fragment.appendChild(renderHabitCard(item.habit, callbacks, _moveOptions(item.habit, peers)));
        }
    }

    if (later.length > 0) {
        const details = document.createElement('details');
        details.className = 'long-term-section';
        if (wasLongTermOpen) details.open = true;
        details.innerHTML = `<summary>Long-term habits <span class="section-count">${later.length}</span></summary><div class="long-term-list"></div>`;
        const list = details.querySelector('.long-term-list');
        later.forEach(h => list.appendChild(renderHabitCard(h, callbacks)));
        fragment.appendChild(details);
    }

    container.appendChild(fragment);
    _restoreOpenCalendars(container, openCalendars);
}

/**
 * Work out whether a habit can move up/down among its reorder peers
 * @param {Habit} habit - The habit
 * @param {Array<Habit>} section - Habits in the same reorder section, in display order
 * @returns {{canMoveUp: boolean, canMoveDown: boolean}}
 * @private
 */
function _moveOptions(habit, section) {
    const peers = getReorderPeers(section, habit);
    const idx = peers.findIndex(h => h.id === habit.id);
    return { canMoveUp: idx > 0, canMoveDown: idx >= 0 && idx < peers.length - 1 };
}

/**
 * Render a stack: a header (name, time, progress, rename) above its habit cards
 * @param {{time: string, name: string, habits: Array<Habit>}} stack - Stack item
 * @param {Object} callbacks - Card callbacks plus optional onRenameStack
 * @returns {HTMLElement} Stack element
 */
export function renderStack(stack, callbacks = {}) {
    const el = document.createElement('section');
    el.className = 'habit-stack';
    el.dataset.stackTime = stack.time;

    const now = new Date();
    const today = _localDateStr(now);
    const dueToday = stack.habits.filter(h => h.isActiveOnDay(now));
    const doneToday = dueToday.filter(h => h.isCompletedOn(today)).length;
    const allDone = dueToday.length > 0 && doneToday === dueToday.length;
    const headingId = `stack-title-${stack.time.replace(':', '')}`;
    const hasCustomName = stack.name !== stack.time;

    el.innerHTML = `
        <div class="stack-header">
            <div class="stack-title-group">
                <h2 class="stack-name" id="${escapeAttr(headingId)}">${escapeHtml(stack.name)}</h2>
                ${hasCustomName ? `<span class="stack-time" title="Stack time">🔔 ${escapeHtml(stack.time)}</span>` : ''}
            </div>
            <span class="stack-progress ${allDone ? 'all-done' : ''}" title="Completed today">${dueToday.length > 0 ? `${doneToday}/${dueToday.length} done` : 'Rest day'}</span>
            <button class="stack-rename" type="button" data-stack-time="${escapeAttr(stack.time)}" title="Rename stack" aria-label="Rename stack ${escapeAttr(stack.name)}">✎</button>
        </div>
        <div class="stack-habits"></div>
    `;
    el.setAttribute('aria-labelledby', headingId);

    const renameBtn = el.querySelector('.stack-rename');
    if (renameBtn && callbacks.onRenameStack) {
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onRenameStack(stack.time, stack.name);
        });
    }

    const body = el.querySelector('.stack-habits');
    stack.habits.forEach(habit => {
        body.appendChild(renderHabitCard(habit, callbacks, _moveOptions(habit, stack.habits)));
    });

    return el;
}

/**
 * Collect IDs of habits whose history calendar is currently expanded
 * @param {HTMLElement} container - List container
 * @returns {Set<string>} Habit IDs
 * @private
 */
function _getOpenCalendarIds(container) {
    const ids = new Set();
    container.querySelectorAll('.habit-card').forEach(card => {
        const grid = card.querySelector('.calendar-grid');
        if (grid && !grid.classList.contains('hidden')) ids.add(card.dataset.habitId);
    });
    return ids;
}

/**
 * Re-expand history calendars that were open before a re-render
 * @param {HTMLElement} container - List container
 * @param {Set<string>} ids - Habit IDs to expand
 * @private
 */
function _restoreOpenCalendars(container, ids) {
    if (ids.size === 0) return;
    container.querySelectorAll('.habit-card').forEach(card => {
        if (ids.has(card.dataset.habitId)) {
            const toggle = card.querySelector('.calendar-toggle');
            if (toggle) toggle.click();
        }
    });
}

/**
 * Render a single habit card
 * @param {Habit} habit - Habit to render
 * @param {Object} callbacks - Object with callback functions
 * @param {Object} options - Rendering options
 * @param {boolean} [options.canMoveUp=true] - Whether the move-up button is enabled
 * @param {boolean} [options.canMoveDown=true] - Whether the move-down button is enabled
 * @returns {HTMLElement} Habit card element
 */
export function renderHabitCard(habit, callbacks = {}, options = {}) {
    const canMoveUp = options.canMoveUp !== false;
    const canMoveDown = options.canMoveDown !== false;
    const showMove = options.showMove !== false && !habit.isLongTerm();
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.habitId = habit.id;

    // Build the card HTML
    const now = new Date();
    const today = _localDateStr(now);
    const isCompleted = habit.isCompletedOn(today);
    const isLongTerm = habit.isLongTerm();
    const stats = isLongTerm ? null : habit.getStatistics();
    const isActiveToday = isLongTerm || habit.isActiveOnDay(now);
    const safeId = escapeAttr(habit.id);
    const safeNotifTime = habit.notificationTime ? escapeAttr(habit.notificationTime) : '';

    let infoHtml;
    let daysHtml = '';
    let actionsHtml;
    if (isLongTerm) {
        const level = habit.getUrgencyLevel(now);
        const snoozed = level > 0 && habit.isDismissedOn(now);
        card.classList.add('long-term', `urgency-${level}`);
        if (snoozed) card.classList.add('snoozed');
        const lastDone = habit.getLastCompletedDate();
        infoHtml = `
            <span class="habit-repeat" title="Repeats">🔁 ${escapeHtml(describeRecurrence(habit.recurrence))}</span>
            <span class="habit-last-done" title="Last completed">${lastDone ? `Last done: ${escapeHtml(lastDone)}` : 'Never done'}</span>
            <span class="due-badge due-level-${level}" title="Next due ${escapeAttr(habit.getNextDueDate())}">${escapeHtml(describeDueStatus(habit.getDaysUntilDue(now)))}</span>`;
        const doneLabel = isCompleted ? '✓ Done Today (tap to undo)' : (level > 0 ? 'Mark Done' : 'Mark Done Early');
        actionsHtml = `
            <button class="complete-btn ${isCompleted ? 'completed' : ''}" data-habit-id="${safeId}">${doneLabel}</button>
            ${level > 0 && !snoozed && !isCompleted ? `<button class="dismiss-btn" type="button" data-habit-id="${safeId}" title="Hide until tomorrow. It will still be overdue and more urgent then.">Not today</button>` : ''}
            ${snoozed ? '<span class="snoozed-note">Snoozed until tomorrow</span>' : ''}`;
    } else {
        infoHtml = `
            <span class="habit-streak" title="Current streak">🔥 ${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}</span>
            <span class="habit-completion-rate" title="Completion rate">${stats.completionRate}%</span>
            ${habit.notificationTime ? `<span class="habit-notification" title="Notification time">🔔 ${safeNotifTime}</span>` : ''}`;
        daysHtml = renderDaysOfWeek(habit);
        actionsHtml = `
            <button class="complete-btn ${isCompleted ? 'completed' : ''} ${!isActiveToday ? 'disabled' : ''}" 
                    data-habit-id="${safeId}"
                    ${!isActiveToday ? 'disabled' : ''}>
                ${isCompleted ? '✓ Completed Today' : (isActiveToday ? 'Mark Complete' : 'Not Scheduled Today')}
            </button>`;
    }

    card.innerHTML = `
        <div class="habit-header">
            <div class="habit-title-row">
                <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
                ${habit.tags && habit.tags.length > 0 ? `<div class="habit-tags">${habit.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="habit-actions-header">
                ${showMove ? `<button class="habit-move-up" data-habit-id="${safeId}" title="Move up" aria-label="Move ${escapeAttr(habit.name)} up" ${canMoveUp ? '' : 'disabled'}>▲</button>
                <button class="habit-move-down" data-habit-id="${safeId}" title="Move down" aria-label="Move ${escapeAttr(habit.name)} down" ${canMoveDown ? '' : 'disabled'}>▼</button>` : ''}
                <button class="habit-edit" data-habit-id="${safeId}" title="Edit habit" aria-label="Edit ${escapeAttr(habit.name)}">✎</button>
                <button class="habit-delete" data-habit-id="${safeId}" title="Delete habit" aria-label="Delete ${escapeAttr(habit.name)}">×</button>
            </div>
        </div>
        
        ${habit.notes ? `<div class="habit-notes">${escapeHtml(habit.notes)}</div>` : ''}
        
        <div class="habit-info">${infoHtml}
        </div>
        
        ${daysHtml}
        
        <div class="habit-actions">${actionsHtml}
        </div>
        
        ${renderCalendar(habit)}
    `;

    // Attach event listeners
    const deleteBtn = card.querySelector('.habit-delete');
    const editBtn = card.querySelector('.habit-edit');
    const completeBtn = card.querySelector('.complete-btn');
    const dismissBtn = card.querySelector('.dismiss-btn');
    const calendarToggle = card.querySelector('.calendar-toggle');
    const moveUpBtn = card.querySelector('.habit-move-up');
    const moveDownBtn = card.querySelector('.habit-move-down');

    if (dismissBtn && callbacks.onDismiss) {
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onDismiss(habit.id);
        });
    }

    if (deleteBtn && callbacks.onDelete) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onDelete(habit.id);
        });
    }

    if (editBtn && callbacks.onEdit) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onEdit(habit.id);
        });
    }

    if (moveUpBtn && callbacks.onMoveUp) {
        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onMoveUp(habit.id);
        });
    }

    if (moveDownBtn && callbacks.onMoveDown) {
        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onMoveDown(habit.id);
        });
    }

    if (completeBtn && callbacks.onComplete && isActiveToday) {
        completeBtn.addEventListener('click', () => {
            callbacks.onComplete(habit.id, !isCompleted);
        });
    }

    if (calendarToggle) {
        calendarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const calendarGrid = card.querySelector('.calendar-grid');
            const toggleIcon = calendarToggle.querySelector('.toggle-icon');
            const toggleText = calendarToggle.querySelector('.toggle-text');
            
            if (calendarGrid && toggleIcon && toggleText) {
                calendarGrid.classList.toggle('hidden');
                const isHidden = calendarGrid.classList.contains('hidden');
                toggleIcon.textContent = isHidden ? '▼' : '▲';
                toggleText.textContent = isHidden ? 'View History' : 'Hide History';
            }
        });
    }

    // Attach click handlers to active calendar days for history editing
    if (callbacks.onHistoryToggle) {
        card.querySelectorAll('.calendar-day:not(.inactive)').forEach(dayEl => {
            dayEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = dayEl.dataset.date;
                const hId = dayEl.dataset.habitId;
                if (date && hId) {
                    callbacks.onHistoryToggle(hId, date);
                }
            });
            dayEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    const date = dayEl.dataset.date;
                    const hId = dayEl.dataset.habitId;
                    if (date && hId) {
                        callbacks.onHistoryToggle(hId, date);
                    }
                }
            });
        });
    }

    return card;
}

/**
 * Describe a repeat rule, e.g. "Every 2 weeks" or "Every month"
 * @param {{every: number, unit: string}} rec - Repeat rule
 * @returns {string} Description
 */
export function describeRecurrence(rec) {
    const singular = rec.unit.replace(/s$/, '');
    return rec.every === 1 ? `Every ${singular}` : `Every ${rec.every} ${rec.unit}`;
}

/**
 * Describe how far a long-term habit is from being due
 * @param {number} daysUntilDue - Days until due (0 = today, negative = overdue)
 * @returns {string} e.g. "Due today", "3 days overdue", "Due in 5 days"
 */
export function describeDueStatus(daysUntilDue) {
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue < 0) {
        const n = -daysUntilDue;
        return `${n} day${n !== 1 ? 's' : ''} overdue`;
    }
    return daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${daysUntilDue} days`;
}

/**
 * Render days of week indicator for a habit
 * @param {Habit} habit - Habit to render days for
 * @returns {string} HTML string for days of week
 */
function renderDaysOfWeek(habit) {
    const daysOfWeek = habit.getDaysOfWeek();
    
    if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.length === 7) {
        return '<div class="habit-days"><span class="day-badge">Every day</span></div>';
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const badges = daysOfWeek.map(day => 
        `<span class="day-badge">${dayNames[day]}</span>`
    ).join('');

    return `<div class="habit-days">${badges}</div>`;
}

/** Day the history calendar week starts on (0 = Sunday, 1 = Monday) */
export const CALENDAR_WEEK_START = 1;

/** Number of weeks shown in the history calendar */
export const CALENDAR_WEEKS = 8;

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Build a weekday-aligned calendar: each row is one week, each column a fixed weekday.
 * The last row is the week containing `today`; days after today are flagged as future.
 * @param {Date} today - Reference date
 * @param {number} weeks - Number of week rows
 * @param {number} weekStart - First column's weekday (0 = Sunday, 1 = Monday)
 * @returns {Array<Array<{date: string, day: number, isToday: boolean, isFuture: boolean}>>} Rows of 7 cells
 */
export function buildCalendarWeeks(today = new Date(), weeks = CALENDAR_WEEKS, weekStart = CALENDAR_WEEK_START) {
    const todayStr = _localDateStr(today);
    const offsetFromWeekStart = (today.getDay() - weekStart + 7) % 7;
    // Build from date components (not ms arithmetic) so DST shifts can't skip or repeat a day
    const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offsetFromWeekStart - (weeks - 1) * 7);

    const rows = [];
    for (let w = 0; w < weeks; w++) {
        const row = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + d);
            const dateStr = _localDateStr(date);
            row.push({
                date: dateStr,
                day: date.getDate(),
                isToday: dateStr === todayStr,
                isFuture: dateStr > todayStr
            });
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Render a calendar view showing completion history, aligned by day of the week
 * so that weekday patterns show up as vertical columns
 * @param {Habit} habit - Habit to render calendar for
 * @param {number} weeks - Number of weeks to show
 * @returns {string} HTML string for calendar
 */
function renderCalendar(habit, weeks = CALENDAR_WEEKS) {
    const rows = buildCalendarWeeks(new Date(), weeks, CALENDAR_WEEK_START);
    const safeHabitId = escapeAttr(habit.id);

    const headerHtml = Array.from({ length: 7 }, (_, col) => {
        const dow = (CALENDAR_WEEK_START + col) % 7;
        return `<div class="calendar-weekday" aria-hidden="true" title="${DAY_NAMES_FULL[dow]}">${DAY_LETTERS[dow]}</div>`;
    }).join('');

    const cellsHtml = rows.flat().map(cell => {
        if (cell.isFuture) {
            return `<div class="calendar-day future inactive" aria-hidden="true" title="${cell.date} (upcoming)" data-date="${cell.date}" data-habit-id="${safeHabitId}"></div>`;
        }
        const isCompleted = habit.isCompletedOn(cell.date);
        const isActive = habit.isActiveOnDay(cell.date);
        return `
        <div class="calendar-day ${isCompleted ? 'completed' : ''} ${cell.isToday ? 'today' : ''} ${!isActive ? 'inactive' : ''}" 
             title="${cell.date}${!isActive ? ' (not scheduled)' : ''}"
             data-date="${cell.date}" data-habit-id="${safeHabitId}"
             ${isActive ? 'role="button" tabindex="0" aria-label="' + cell.date + (isCompleted ? ' completed' : ' not completed') + '"' : ''}>
            <span class="day-number">${cell.day}</span>
            ${isCompleted ? '<span class="check-mark">✓</span>' : ''}
        </div>`;
    }).join('');

    return `
        <div class="habit-calendar">
            <button class="calendar-toggle" type="button">
                <span class="toggle-text">View History</span>
                <span class="toggle-icon">▼</span>
            </button>
            <div class="calendar-grid hidden" role="group" aria-label="Completion history by day of week">
                ${headerHtml}
                ${cellsHtml}
            </div>
        </div>
    `;
}

/**
 * Show empty state message
 * @param {HTMLElement} container - Container to show empty state in
 */
function showEmptyState(container) {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.classList.remove('hidden');
    }
}

/** @type {HTMLElement|null} Element that had focus before modal opened */
let _previouslyFocusedElement = null;

/** @type {Function|null} Active focus trap keydown handler */
let _focusTrapHandler = null;

/**
 * Show a modal with focus trapping for accessibility
 * @param {string} modalId - ID of the modal to show
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Store the element that had focus before modal opened
        _previouslyFocusedElement = document.activeElement;

        modal.classList.remove('hidden');
        
        // Focus first focusable element
        const firstInput = modal.querySelector('input, textarea, button, select, [tabindex]:not([tabindex="-1"])');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }

        // Set up focus trap
        _setupFocusTrap(modal);
    }
}

/**
 * Hide a modal and restore focus
 * @param {string} modalId - ID of the modal to hide
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        
        // Clear form if it exists
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }

        // Remove focus trap
        _removeFocusTrap(modal);

        // Restore focus to the element that triggered the modal
        if (_previouslyFocusedElement && document.body.contains(_previouslyFocusedElement)) {
            _previouslyFocusedElement.focus();
            _previouslyFocusedElement = null;
        }
    }
}

/**
 * Set up a focus trap within a modal element
 * @param {HTMLElement} modal - The modal element to trap focus within
 * @private
 */
function _setupFocusTrap(modal) {
    _removeFocusTrap(modal);

    _focusTrapHandler = (e) => {
        if (e.key !== 'Tab') return;

        const focusableSelectors = 'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
        const focusable = Array.from(modal.querySelectorAll(focusableSelectors)).filter(el => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    modal.addEventListener('keydown', _focusTrapHandler);
}

/**
 * Remove focus trap from a modal
 * @param {HTMLElement} modal - The modal element
 * @private
 */
function _removeFocusTrap(modal) {
    if (_focusTrapHandler) {
        modal.removeEventListener('keydown', _focusTrapHandler);
        _focusTrapHandler = null;
    }
}

/**
 * Render notification time input in a form
 * @param {HTMLElement} container - Container to render into
 * @param {string|null} currentTime - Current notification time (HH:MM format)
 * @returns {HTMLElement} The input element
 */
export function renderNotificationTimeInput(container, currentTime = null) {
    if (!container) {
        console.error('Container element not provided');
        return null;
    }

    const input = document.createElement('input');
    input.type = 'time';
    input.id = 'notification-time';
    input.name = 'notification-time';
    input.className = 'notification-time-input';
    
    if (currentTime) {
        input.value = currentTime;
    }

    container.appendChild(input);
    return input;
}

/**
 * Render day-of-week selector
 * @param {HTMLElement} container - Container to render into
 * @param {Array<number>|null} selectedDays - Array of selected day numbers
 * @returns {HTMLElement} The container with checkboxes
 */
export function renderDayOfWeekSelector(container, selectedDays = null) {
    if (!container) {
        console.error('Container element not provided');
        return null;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'days-selector';

    dayNames.forEach((name, index) => {
        const label = document.createElement('label');
        label.className = 'day-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'day';
        checkbox.value = index.toString();
        
        if (selectedDays && selectedDays.includes(index)) {
            checkbox.checked = true;
        }

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${name}`));
        selectorDiv.appendChild(label);
    });

    container.appendChild(selectorDiv);
    return selectorDiv;
}

/**
 * Get selected days from day-of-week selector
 * @param {HTMLElement} container - Container with day checkboxes
 * @returns {Array<number>|null} Array of selected day numbers, or null if all/none selected
 */
export function getSelectedDays(container) {
    if (!container) {
        return null;
    }

    const checkboxes = container.querySelectorAll('input[name="day"]:checked');
    
    if (checkboxes.length === 0 || checkboxes.length === 7) {
        return null; // All days or no days selected = daily habit
    }

    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

/**
 * Update a single habit card in the DOM
 * @param {string} habitId - ID of habit to update
 * @param {Habit} habit - Updated habit object
 * @param {Object} callbacks - Callback functions
 */
export function updateHabitCard(habitId, habit, callbacks = {}) {
    const existingCard = document.querySelector(`[data-habit-id="${habitId}"]`);
    
    if (!existingCard) {
        console.warn(`Habit card with ID ${habitId} not found`);
        return;
    }

    const newCard = renderHabitCard(habit, callbacks);
    existingCard.replaceWith(newCard);
}

/**
 * Remove a habit card from the DOM
 * @param {string} habitId - ID of habit to remove
 */
export function removeHabitCard(habitId) {
    const card = document.querySelector(`[data-habit-id="${habitId}"]`);
    
    if (card) {
        card.remove();
        
        // Check if we should show empty state
        const container = document.getElementById('habits-list');
        if (container && container.children.length === 0) {
            showEmptyState(container);
        }
    }
}

/**
 * Show a notification/toast message
 * @param {string} message - Message to display
 * @param {string} type - Type of message ('success', 'error', 'info')
 */
export function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Escape HTML to prevent XSS in text content
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape a string for safe use in HTML attribute values
 * @param {string} text - Text to escape for attribute context
 * @returns {string} Escaped text safe for attributes
 */
export function escapeAttr(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Display notification indicator on habit card
 * @param {HTMLElement} card - Habit card element
 * @param {string|null} notificationTime - Notification time to display
 */
export function displayNotificationIndicator(card, notificationTime) {
    if (!card) return;

    const existingIndicator = card.querySelector('.habit-notification');
    
    if (notificationTime) {
        if (existingIndicator) {
            existingIndicator.textContent = `🔔 ${notificationTime}`;
        } else {
            const infoSection = card.querySelector('.habit-info');
            if (infoSection) {
                const indicator = document.createElement('span');
                indicator.className = 'habit-notification';
                indicator.title = 'Notification time';
                indicator.textContent = `🔔 ${notificationTime}`;
                infoSection.appendChild(indicator);
            }
        }
    } else {
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }
}

/**
 * Filter and display only habits active today
 * @param {Array<Habit>} habits - All habits
 * @param {HTMLElement} container - Container to render into
 * @param {Object} callbacks - Callback functions
 */
export function renderTodayHabits(habits, container, callbacks = {}) {
    if (!container) return;

    const today = new Date();
    const todayHabits = habits.filter(habit => habit.isActiveOnDay(today));

    renderHabitList(todayHabits, container, callbacks);
}

/**
 * Populate edit form with habit data
 * @param {Habit} habit - Habit to edit
 */
export function populateEditForm(habit) {
    const form = document.getElementById('edit-habit-form');
    if (!form) return;

    const nameInput = form.querySelector('#edit-habit-name');
    const timeInput = form.querySelector('#edit-notification-time');
    const notesInput = form.querySelector('#edit-habit-notes');
    const tagsInput = form.querySelector('#edit-habit-tags');
    const dayCheckboxes = form.querySelectorAll('input[name="edit-day"]');

    if (nameInput) nameInput.value = habit.name;
    if (timeInput) timeInput.value = habit.notificationTime || '';
    if (notesInput) notesInput.value = habit.notes || '';
    if (tagsInput) tagsInput.value = habit.tags ? habit.tags.join(', ') : '';
    
    // Set day checkboxes
    dayCheckboxes.forEach(checkbox => {
        const day = parseInt(checkbox.value);
        checkbox.checked = !habit.daysOfWeek || habit.daysOfWeek.includes(day);
    });

    // Long-term fields
    const longTermBox = form.querySelector('#edit-habit-longterm');
    const everyInput = form.querySelector('#edit-habit-every');
    const unitSelect = form.querySelector('#edit-habit-unit');
    const firstDueInput = form.querySelector('#edit-habit-first-due');
    const rec = habit.recurrence;
    if (longTermBox) longTermBox.checked = habit.isLongTerm();
    if (everyInput) everyInput.value = rec ? rec.every : 2;
    if (unitSelect) unitSelect.value = rec ? rec.unit : 'weeks';
    if (firstDueInput) {
        firstDueInput.value = rec ? rec.firstDue : '';
        // The due date follows the last completion once there is one
        firstDueInput.disabled = habit.isLongTerm() && habit.completions.length > 0;
    }
    updateLongTermFormVisibility(form);

    // Store habit ID in form
    form.dataset.habitId = habit.id;
}

/**
 * Show the repeat fields and hide notification/day fields when "Long-term habit" is ticked
 * @param {HTMLFormElement} form - The add or edit habit form
 */
export function updateLongTermFormVisibility(form) {
    if (!form) return;
    const checkbox = form.querySelector('input[type="checkbox"][id$="habit-longterm"]');
    const isLongTerm = !!(checkbox && checkbox.checked);
    form.querySelectorAll('.longterm-fields').forEach(el => el.classList.toggle('hidden', !isLongTerm));
    form.querySelectorAll('.daily-only').forEach(el => el.classList.toggle('hidden', isLongTerm));
}

/**
 * Create and return form data from the add or edit habit form
 * @param {HTMLFormElement} form - The form element
 * @returns {Object} Form data object
 */
/**
 * Get a local date string (YYYY-MM-DD) avoiding UTC timezone issues
 * @param {Date} date - Date object to format
 * @returns {string} Local date string in YYYY-MM-DD format
 */
export function _localDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getHabitFormData(form) {
    if (!form) return null;

    const formData = new FormData(form);
    const isEditForm = form.id === 'edit-habit-form';
    
    // Get field names based on form type
    const nameField = isEditForm ? 'edit-habit-name' : 'habit-name';
    const timeField = isEditForm ? 'edit-notification-time' : 'notification-time';
    const notesField = isEditForm ? 'edit-habit-notes' : 'habit-notes';
    const tagsField = isEditForm ? 'edit-habit-tags' : 'habit-tags';
    const dayField = isEditForm ? 'edit-day' : 'day';
    
    const name = formData.get(nameField);
    const isLongTerm = form.querySelector(`input[name="${isEditForm ? 'edit-habit-longterm' : 'habit-longterm'}"]`)?.checked === true;
    const notificationTime = isLongTerm ? null : (formData.get(timeField) || null);
    const notes = formData.get(notesField) || '';
    const tagsString = formData.get(tagsField) || '';
    
    // Parse tags from comma-separated string
    const tags = tagsString
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    
    // Get selected days
    const dayCheckboxes = form.querySelectorAll(`input[name="${dayField}"]:checked`);
    let daysOfWeek = null;
    
    if (!isLongTerm && dayCheckboxes.length > 0 && dayCheckboxes.length < 7) {
        daysOfWeek = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));
    }

    // Disabled inputs are omitted by FormData, so firstDue is null when it is locked
    const prefix = isEditForm ? 'edit-habit-' : 'habit-';
    const longTerm = isLongTerm ? {
        every: Number(formData.get(`${prefix}every`)),
        unit: formData.get(`${prefix}unit`),
        firstDue: formData.get(`${prefix}first-due`) || null
    } : null;

    return {
        name: name ? name.trim() : '',
        notificationTime,
        daysOfWeek,
        notes: notes.trim(),
        tags,
        longTerm
    };
}
