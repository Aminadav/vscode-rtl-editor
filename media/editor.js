// RTL Editor JavaScript

(function() {
    const vscode = acquireVsCodeApi();

    // Get DOM elements
    const editor = document.getElementById('editor');
    const notificationBar = document.getElementById('notification-bar');
    const notificationMessage = document.getElementById('notification-message');
    const notificationRefresh = document.getElementById('notification-refresh');
    const notificationDismiss = document.getElementById('notification-dismiss');
    const lineNumbers = document.getElementById('line-numbers');
    const lineMirror = document.getElementById('line-mirror');

    // lastKnown mirrors the document content as understood by the extension.
    // Every webview-originated edit updates it optimistically before send;
    // every extension `update` reconciles against it.
    let lastKnown = editor.value;

    // Initialize editor
    function init() {
        // Auto-resize textarea
        autoResize();
        updateLineNumbers();

        // Sync line numbers scroll with editor scroll
        if (lineNumbers) {
            editor.addEventListener('scroll', function() {
                lineNumbers.scrollTop = editor.scrollTop;
            });
        }

        // Setup event listeners
        setupEventListeners();
    }

    function setupEventListeners() {
        // Editor change events
        editor.addEventListener('input', onInput);

        // Keyboard shortcuts
        editor.addEventListener('keydown', function(e) {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) {
                return;
            }

            // Delegate undo/redo to VS Code's document undo stack so it stays in
            // sync with the regular editor view of the same document.
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                vscode.postMessage({ type: 'undo' });
                return;
            }
            if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                e.preventDefault();
                vscode.postMessage({ type: 'redo' });
                return;
            }

            // Ctrl+S / Cmd+S to save
            if (e.key === 's') {
                e.preventDefault();
                vscode.postMessage({ type: 'save' });
                return;
            }

            // Handle RTL/LTR direction toggle with Ctrl+Shift+X
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
                e.preventDefault();
                toggleDirection();
                return;
            }

            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                adjustFontSize(1);
            } else if (e.key === '-') {
                e.preventDefault();
                adjustFontSize(-1);
            } else if (e.key === '0') {
                e.preventDefault();
                editor.style.fontSize = '14px';
                if (lineNumbers) {
                    lineNumbers.style.fontSize = '14px';
                }
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

        // Context menu for direction switching
        editor.addEventListener('contextmenu', function(e) {
            // Let VS Code handle the context menu, but we could add custom items here
        });

        editor.addEventListener('paste', function() {
            // input event will fire after paste with the merged value; nothing extra needed.
        });
    }

    function onInput() {
        const newValue = editor.value;
        if (newValue === lastKnown) {
            return;
        }
        const diff = computeDiff(lastKnown, newValue);
        lastKnown = newValue;

        vscode.postMessage({
            type: 'edit',
            start: diff.start,
            end: diff.end,
            text: diff.text
        });

        autoResize();
        updateLineNumbers();
        scheduleDirectionDetection();
    }

    // Find the minimal {start, end, text} such that
    //   oldStr.slice(0, start) + text + oldStr.slice(end) === newStr.
    function computeDiff(oldStr, newStr) {
        const oldLen = oldStr.length;
        const newLen = newStr.length;
        let start = 0;
        const maxStart = Math.min(oldLen, newLen);
        while (start < maxStart && oldStr.charCodeAt(start) === newStr.charCodeAt(start)) {
            start++;
        }
        let oldEnd = oldLen;
        let newEnd = newLen;
        while (oldEnd > start && newEnd > start && oldStr.charCodeAt(oldEnd - 1) === newStr.charCodeAt(newEnd - 1)) {
            oldEnd--;
            newEnd--;
        }
        return {
            start: start,
            end: oldEnd,
            text: newStr.slice(start, newEnd)
        };
    }

    function applyIncomingUpdate(content) {
        if (content === lastKnown && content === editor.value) {
            return;
        }
        if (content === editor.value) {
            lastKnown = content;
            return;
        }

        // Preserve caret as best we can: compute diff against the current
        // textarea value and map the caret position through it.
        const selStart = editor.selectionStart;
        const selEnd = editor.selectionEnd;
        const oldValue = editor.value;
        const diff = computeDiff(oldValue, content);
        const delta = diff.text.length - (diff.end - diff.start);

        const newSelStart = mapCaret(selStart, diff, delta);
        const newSelEnd = mapCaret(selEnd, diff, delta);

        editor.value = content;
        lastKnown = content;

        try {
            editor.setSelectionRange(newSelStart, newSelEnd);
        } catch (e) {
            // ignore — element may not be focused or range may be invalid
        }

        autoResize();
        updateLineNumbers();
    }

    function mapCaret(pos, diff, delta) {
        if (pos <= diff.start) {
            return pos;
        }
        if (pos >= diff.end) {
            return pos + delta;
        }
        return diff.start + diff.text.length;
    }

    function refresh() {
        vscode.postMessage({ type: 'refresh' });
    }

    function refreshWithDraft() {
        // Send current draft content for comparison
        vscode.postMessage({
            type: 'refreshWithDraft',
            draftContent: editor.value
        });
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
        if (hasUnsavedChanges) {
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
            applyIncomingUpdate(diskContent);
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

    function updateLineNumbers() {
        if (!lineNumbers || !lineMirror) {
            return;
        }

        // Copy computed styles from textarea to mirror div
        const computed = window.getComputedStyle(editor);
        const stylesToCopy = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'lineHeight', 'letterSpacing', 'wordSpacing',
            'textRendering', 'direction', 'textAlign', 'unicodeBidi',
            'fontFeatureSettings', 'paddingLeft', 'paddingRight',
            'borderLeftWidth', 'borderRightWidth', 'boxSizing'
        ];
        for (const prop of stylesToCopy) {
            lineMirror.style[prop] = computed[prop];
        }
        lineMirror.style.width = editor.clientWidth + 'px';

        // Render all lines in the mirror at once, each in a div,
        // then read offsetTop to avoid cumulative rounding errors
        const lines = editor.value.split('\n');
        let mirrorHtml = '';
        for (let i = 0; i < lines.length; i++) {
            mirrorHtml += '<div>' + (lines[i] ? escapeHtml(lines[i]) : '\u00a0') + '</div>';
        }
        lineMirror.innerHTML = mirrorHtml;

        const mirrorDivs = lineMirror.children;
        let numbersHtml = '';
        for (let i = 0; i < mirrorDivs.length; i++) {
            const top = mirrorDivs[i].offsetTop;
            const height = (i < mirrorDivs.length - 1)
                ? mirrorDivs[i + 1].offsetTop - top
                : mirrorDivs[i].offsetHeight;
            numbersHtml += '<div style="height:' + height + 'px">' + (i + 1) + '</div>';
        }
        lineNumbers.innerHTML = numbersHtml;
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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

    function scheduleDirectionDetection() {
        // Debounce the direction detection
        clearTimeout(window.directionTimeout);
        window.directionTimeout = setTimeout(detectTextDirection, 500);
    }

    function adjustFontSize(delta) {
        const currentSize = parseInt(window.getComputedStyle(editor).fontSize);
        const newSize = Math.max(10, Math.min(24, currentSize + delta));
        editor.style.fontSize = newSize + 'px';
        if (lineNumbers) {
            lineNumbers.style.fontSize = newSize + 'px';
        }
    }

    // Listen for messages from the extension
    window.addEventListener('message', function(event) {
        const message = event.data;

        switch (message.type) {
            case 'update':
                applyIncomingUpdate(message.content);
                break;

            case 'fileChanged':
                showFileChangedNotification(message.message, message.hasUnsavedChanges);
                break;

            case 'refreshComplete':
                applyIncomingUpdate(message.content);
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
