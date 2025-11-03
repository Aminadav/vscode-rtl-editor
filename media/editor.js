// RTL Editor JavaScript

(function() {
    const vscode = acquireVsCodeApi();
    
    // Get DOM elements
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('save-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const charCount = document.getElementById('char-count');
    const notificationBar = document.getElementById('notification-bar');
    const notificationMessage = document.getElementById('notification-message');
    const notificationRefresh = document.getElementById('notification-refresh');
    const notificationDismiss = document.getElementById('notification-dismiss');
    const saveStatus = document.getElementById('save-status');
    
    let isDirty = false;
    let originalContent = '';
    let saveStatusTimeout;
    
    // Initialize editor
    function init() {
        originalContent = editor.value;
        updateCharCount();
        updateStatus();
        updateSaveStatus();
        
        // Auto-resize textarea
        autoResize();
        
        // Setup event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Editor change events
        editor.addEventListener('input', function() {
            isDirty = (editor.value !== originalContent);
            updateStatus();
            updateSaveStatus();
            updateCharCount();
            autoResize();
        });
        
        // Save button
        saveBtn.addEventListener('click', function() {
            save();
        });
        
        // Refresh button
        refreshBtn.addEventListener('click', function() {
            refresh();
        });
        
        // Keyboard shortcuts
        editor.addEventListener('keydown', function(e) {
            // Ctrl+S / Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                save();
            }
            
            // Ctrl+R / Cmd+R to refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                refresh();
            }
            
            // Handle RTL/LTR direction toggle with Ctrl+Shift+X
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
                e.preventDefault();
                toggleDirection();
            }
        });
        
        // Notification bar events
        notificationRefresh.addEventListener('click', function() {
            refresh();
            hideNotification();
        });
        
        notificationDismiss.addEventListener('click', function() {
            hideNotification();
        });
        
        // Auto-save on focus lost
        editor.addEventListener('blur', function() {
            if (isDirty) {
                save();
            }
        });
        
        // Context menu for direction switching
        editor.addEventListener('contextmenu', function(e) {
            // Let VS Code handle the context menu, but we could add custom items here
        });
    }
    
    function save() {
        vscode.postMessage({
            type: 'save',
            content: editor.value
        });
        
        originalContent = editor.value;
        isDirty = false;
        updateStatus();
        updateSaveStatus();
    }
    
    function refresh() {
        vscode.postMessage({
            type: 'refresh'
        });
    }
    
    function updateContent(content) {
        editor.value = content;
        originalContent = content;
        isDirty = false;
        updateStatus();
        updateSaveStatus();
        updateCharCount();
        autoResize();
    }
    
    function updateStatus() {
        if (isDirty) {
            statusIndicator.className = 'status-indicator modified';
            statusIndicator.title = 'File has unsaved changes';
        } else {
            statusIndicator.className = 'status-indicator';
            statusIndicator.title = 'File is saved';
        }
    }
    
    function updateSaveStatus() {
        // Clear any existing timeout
        clearTimeout(saveStatusTimeout);
        
        if (isDirty) {
            saveStatus.textContent = 'Changes not saved';
            saveStatus.parentElement.className = 'status-message unsaved';
        } else {
            saveStatus.textContent = 'RTL Mode Enabled';
            saveStatus.parentElement.className = 'status-message';
        }
    }
    
    function showSaveConfirmation() {
        clearTimeout(saveStatusTimeout);
        saveStatus.textContent = 'File saved';
        saveStatus.parentElement.className = 'status-message saved';
        
        // Show for 3 seconds by default (can be made configurable)
        saveStatusTimeout = setTimeout(() => {
            updateSaveStatus();
        }, 3000);
    }
    
    function updateCharCount() {
        const count = editor.value.length;
        charCount.textContent = `Characters: ${count}`;
        
        // Also show word count for RTL text
        const words = editor.value.trim().split(/\s+/).filter(word => word.length > 0).length;
        charCount.textContent += ` | Words: ${words}`;
    }
    
    function showTemporaryStatus(message) {
        const originalTitle = statusIndicator.title;
        statusIndicator.title = message;
        statusIndicator.className = 'status-indicator';
        
        setTimeout(() => {
            statusIndicator.title = originalTitle;
            updateStatus();
        }, 1500);
    }
    
    function showNotification(message, type = 'warning') {
        notificationMessage.textContent = message;
        notificationBar.className = `notification-bar ${type}`;
        notificationBar.classList.remove('hidden');
    }
    
    function hideNotification() {
        notificationBar.classList.add('hidden');
    }
    
    function toggleDirection() {
        const currentDir = editor.style.direction || 'rtl';
        const newDir = currentDir === 'rtl' ? 'ltr' : 'rtl';
        const newAlign = newDir === 'rtl' ? 'right' : 'left';
        
        editor.style.direction = newDir;
        editor.style.textAlign = newAlign;
        
        showTemporaryStatus(`Direction: ${newDir.toUpperCase()}`);
    }
    
    function autoResize() {
        // Reset height to calculate new height
        editor.style.height = 'auto';
        
        // Set new height based on scroll height
        const newHeight = Math.max(200, editor.scrollHeight);
        editor.style.height = newHeight + 'px';
    }
    
    // Detect RTL/LTR content and adjust accordingly
    function detectTextDirection() {
        const text = editor.value;
        const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const ltrChars = /[a-zA-Z]/;
        
        const rtlCount = (text.match(rtlChars) || []).length;
        const ltrCount = (text.match(ltrChars) || []).length;
        
        if (rtlCount > ltrCount && editor.style.direction !== 'rtl') {
            editor.style.direction = 'rtl';
            editor.style.textAlign = 'right';
        } else if (ltrCount > rtlCount && editor.style.direction !== 'ltr') {
            editor.style.direction = 'ltr';
            editor.style.textAlign = 'left';
        }
    }
    
    // Listen for messages from the extension
    window.addEventListener('message', function(event) {
        const message = event.data;
        
        switch (message.type) {
            case 'update':
                updateContent(message.content);
                break;
                
            case 'fileChanged':
                showNotification(message.message, 'warning');
                break;
                
            case 'saveSuccess':
                showSaveConfirmation();
                hideNotification();
                break;
                
            case 'saveError':
                showNotification(message.message, 'error');
                break;
        }
    });
    
    // Text direction detection on input
    editor.addEventListener('input', function() {
        // Debounce the direction detection
        clearTimeout(window.directionTimeout);
        window.directionTimeout = setTimeout(detectTextDirection, 500);
    });
    
    // Handle paste events to maintain RTL formatting
    editor.addEventListener('paste', function(e) {
        setTimeout(() => {
            detectTextDirection();
            autoResize();
        }, 10);
    });
    
    // Handle font size adjustments
    function adjustFontSize(delta) {
        const currentSize = parseInt(window.getComputedStyle(editor).fontSize);
        const newSize = Math.max(10, Math.min(24, currentSize + delta));
        editor.style.fontSize = newSize + 'px';
        showTemporaryStatus(`Font size: ${newSize}px`);
    }
    
    // Font size keyboard shortcuts
    editor.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey)) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                adjustFontSize(1);
            } else if (e.key === '-') {
                e.preventDefault();
                adjustFontSize(-1);
            } else if (e.key === '0') {
                e.preventDefault();
                editor.style.fontSize = '14px';
                showTemporaryStatus('Font size reset');
            }
        }
    });
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();