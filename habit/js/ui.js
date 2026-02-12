/**
 * UI Module
 * Handles all DOM manipulation and rendering for the Habit Tracker app
 */

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
}

/**
 * Render a single habit card
 * @param {Habit} habit - Habit to render
 * @param {Object} callbacks - Object with callback functions
 * @returns {HTMLElement} Habit card element
 */
export function renderHabitCard(habit, callbacks = {}) {
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.habitId = habit.id;

    // Build the card HTML
    const now = new Date();
    const today = _localDateStr(now);
    const isCompleted = habit.isCompletedOn(today);
    const stats = habit.getStatistics();
    const isActiveToday = habit.isActiveOnDay(now);
    const safeId = escapeAttr(habit.id);
    const safeNotifTime = habit.notificationTime ? escapeAttr(habit.notificationTime) : '';

    card.innerHTML = `
        <div class="habit-header">
            <div class="habit-title-row">
                <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
                ${habit.tags && habit.tags.length > 0 ? `<div class="habit-tags">${habit.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="habit-actions-header">
                <button class="habit-edit" data-habit-id="${safeId}" title="Edit habit" aria-label="Edit ${escapeAttr(habit.name)}">✎</button>
                <button class="habit-delete" data-habit-id="${safeId}" title="Delete habit" aria-label="Delete ${escapeAttr(habit.name)}">×</button>
            </div>
        </div>
        
        ${habit.notes ? `<div class="habit-notes">${escapeHtml(habit.notes)}</div>` : ''}
        
        <div class="habit-info">
            <span class="habit-streak" title="Current streak">🔥 ${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}</span>
            <span class="habit-completion-rate" title="Completion rate">${stats.completionRate}%</span>
            ${habit.notificationTime ? `<span class="habit-notification" title="Notification time">🔔 ${safeNotifTime}</span>` : ''}
        </div>
        
        ${renderDaysOfWeek(habit)}
        
        <div class="habit-actions">
            <button class="complete-btn ${isCompleted ? 'completed' : ''} ${!isActiveToday ? 'disabled' : ''}" 
                    data-habit-id="${safeId}"
                    ${!isActiveToday ? 'disabled' : ''}>
                ${isCompleted ? '✓ Completed Today' : (isActiveToday ? 'Mark Complete' : 'Not Scheduled Today')}
            </button>
        </div>
        
        ${renderCalendar(habit)}
    `;

    // Attach event listeners
    const deleteBtn = card.querySelector('.habit-delete');
    const editBtn = card.querySelector('.habit-edit');
    const completeBtn = card.querySelector('.complete-btn');
    const calendarToggle = card.querySelector('.calendar-toggle');

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

/**
 * Render a calendar view showing completion history
 * @param {Habit} habit - Habit to render calendar for
 * @param {number} days - Number of days to show (default 30)
 * @returns {string} HTML string for calendar
 */
function renderCalendar(habit, days = 30) {
    const calendar = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = _localDateStr(date);
        const isCompleted = habit.isCompletedOn(dateStr);
        const isToday = i === 0;
        const dayOfWeek = date.getDay();
        const isActive = habit.isActiveOnDay(date);
        
        calendar.push({
            date: dateStr,
            day: date.getDate(),
            isCompleted,
            isToday,
            isActive
        });
    }
    
    const safeHabitId = escapeAttr(habit.id);
    const calendarHtml = calendar.map(day => `
        <div class="calendar-day ${day.isCompleted ? 'completed' : ''} ${day.isToday ? 'today' : ''} ${!day.isActive ? 'inactive' : ''}" 
             title="${day.date}${!day.isActive ? ' (not scheduled)' : ''}"
             data-date="${day.date}" data-habit-id="${safeHabitId}"
             ${day.isActive ? 'role="button" tabindex="0" aria-label="' + day.date + (day.isCompleted ? ' completed' : ' not completed') + '"' : ''}>
            <span class="day-number">${day.day}</span>
            ${day.isCompleted ? '<span class="check-mark">✓</span>' : ''}
        </div>
    `).join('');
    
    return `
        <div class="habit-calendar">
            <button class="calendar-toggle" type="button">
                <span class="toggle-text">View History</span>
                <span class="toggle-icon">▼</span>
            </button>
            <div class="calendar-grid hidden">
                ${calendarHtml}
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

    // Store habit ID in form
    form.dataset.habitId = habit.id;
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
    const notificationTime = formData.get(timeField) || null;
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
    
    if (dayCheckboxes.length > 0 && dayCheckboxes.length < 7) {
        daysOfWeek = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));
    }

    return {
        name: name ? name.trim() : '',
        notificationTime,
        daysOfWeek,
        notes: notes.trim(),
        tags
    };
}
