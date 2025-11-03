// RTL Editor JavaScript

(function() {
    const vscode = acquireVsCodeApi();
    
    // Get DOM elements
    const editor = document.getElementById('editor');
    const notificationBar = document.getElementById('notification-bar');
    const notificationMessage = document.getElementById('notification-message');
    const notificationRefresh = document.getElementById('notification-refresh');
    const notificationDismiss = document.getElementById('notification-dismiss');
    
    let isDirty = false;
    let originalContent = '';
    
    // Initialize editor
    function init() {
        originalContent = editor.value;
        
        // Auto-resize textarea
        autoResize();
        
        // Setup event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Editor change events
        editor.addEventListener('input', function() {
            isDirty = (editor.value !== originalContent);
            autoResize();
        });
        
        // Keyboard shortcuts
        editor.addEventListener('keydown', function(e) {
            // Ctrl+S / Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                save();
            }
            
            // Handle RTL/LTR direction toggle with Ctrl+Shift+X
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
                e.preventDefault();
                toggleDirection();
            }
        });
        
        // Notification bar events
        notificationRefresh.addEventListener('click', function() {
            // This will be overridden by showFileChangedNotification when needed
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
    }
    
    function refresh() {
        if (isDirty) {
            // If user has unsaved changes, ask what to do
            if (confirm('You have unsaved changes. Do you want to refresh and lose your changes?\n\nClick OK to refresh (lose changes)\nClick Cancel to keep editing')) {
                vscode.postMessage({
                    type: 'refresh'
                });
            }
        } else {
            vscode.postMessage({
                type: 'refresh'
            });
        }
    }
    
    function refreshWithDraft() {
        // Send current draft content for comparison
        vscode.postMessage({
            type: 'refreshWithDraft',
            draftContent: editor.value
        });
    }
    
    function updateContent(content) {
        editor.value = content;
        originalContent = content;
        isDirty = false;
        autoResize();
    }
    
    function showNotification(message, type = 'warning') {
        notificationMessage.textContent = message;
        notificationBar.className = `notification-bar ${type}`;
        notificationBar.classList.remove('hidden');
    }
    
    function showFileChangedNotification(message, hasUnsavedChanges) {
        // Create enhanced notification for file changes
        notificationMessage.innerHTML = message;
        notificationBar.className = 'notification-bar warning';
        notificationBar.classList.remove('hidden');
        
        // Update buttons based on whether user has unsaved changes
        if (hasUnsavedChanges && isDirty) {
            notificationRefresh.textContent = 'Compare & Merge';
            notificationRefresh.onclick = function() {
                refreshWithDraft();
            };
        } else {
            notificationRefresh.textContent = 'Refresh';
            notificationRefresh.onclick = function() {
                refresh();
                hideNotification();
            };
        }
    }
    
    function showMergeDialog(diskContent, draftContent, message) {
        // Create a simple merge interface
        const choice = confirm(
            message + '\n\n' +
            'Your version (length: ' + draftContent.length + ' chars)\n' +
            'vs\n' +
            'Disk version (length: ' + diskContent.length + ' chars)\n\n' +
            'Click OK to keep your version\n' +
            'Click Cancel to use disk version'
        );
        
        if (choice) {
            // Keep user's version - just hide notification
            hideNotification();
        } else {
            // Use disk version
            updateContent(diskContent);
            hideNotification();
        }
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
                showFileChangedNotification(message.message, message.hasUnsavedChanges);
                break;
                
            case 'refreshComplete':
                updateContent(message.content);
                hideNotification();
                break;
                
            case 'refreshError':
                showNotification(message.message, 'error');
                break;
                
            case 'showMergeDialog':
                showMergeDialog(message.diskContent, message.draftContent, message.message);
                break;
                
            case 'saveSuccess':
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