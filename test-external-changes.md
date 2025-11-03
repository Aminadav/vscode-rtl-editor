# Test External File Changes

This file is for testing the RTL Editor's external file change detection.

## How to Test:

1. Open this file in RTL Editor
2. Keep the RTL Editor window open
3. Open this same file in another editor (like regular VS Code editor, TextEdit, or any text editor)
4. Make changes in the other editor and save
5. Return to RTL Editor - you should see a notification about external changes

## Test Cases:

### Test 1: No unsaved changes in RTL Editor
- Make changes in external editor
- Save external editor
- Should see notification with "Refresh" button
- Click "Refresh" to load external changes

### Test 2: With unsaved changes in RTL Editor
- Type something in RTL Editor (don't save)
- Make different changes in external editor
- Save external editor  
- Should see notification with "Compare & Merge" button
- Click button to choose between your version or disk version

## Expected Behavior:
- ✅ Notification appears when file changes externally
- ✅ Different button text based on whether you have unsaved changes
- ✅ Can choose to keep your changes or load disk version
- ✅ Proper feedback messages after refresh

مرحبا بك في محرر RTL
שלום וברוכים הבאים ל-RTL Editor