# rtl-editor README

This is the README for your extension "rtl-editor". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.
# RTL Editor - VS Code Extension

A custom text editor extension for VS Code that provides enhanced support for right-to-left (RTL) text editing, specifically designed for Arabic and Hebrew text.

## How to Use

### Opening Files in RTL Editor

**Method 1: RTL Editor Button**
- Open any `.txt` or `.md` file in VS Code
- Look for the RTL Editor button (📖) in the top-right of the editor toolbar
- Click the button to open the file in RTL Editor

**Method 2: Context Menu**
- Right-click on any file in Explorer → "Open in RTL Editor"
- Right-click in an open editor → "Open in RTL Editor"

**Method 3: Command Palette**
- Press `Ctrl/Cmd+Shift+P`
- Type "RTL Editor: Open in RTL Editor"
- Or type "RTL Editor: Create New RTL File"

### Working with RTL Text

**Basic Usage:**
- Type directly in Arabic, Hebrew, or mixed content
- Text direction is automatically detected and adjusted
- Save with `Ctrl/Cmd+S` or click the Save button
- Refresh from disk with `Ctrl/Cmd+R` or click Refresh button

**Status Indicators:**
- **"RTL Mode Enabled"** - File is saved and ready
- **"Changes not saved"** - You have unsaved changes
- **"File saved"** - Appears for 3 seconds after successful save
- **Orange dot** - File has unsaved changes
- **Green dot** - File is saved

**External File Changes:**
- If the file is modified outside VS Code, you'll see a notification bar
- Click "Refresh" to load the external changes
- Click "×" to dismiss the notification

### Keyboard Shortcuts

- `Ctrl/Cmd+S` - Save file
- `Ctrl/Cmd+R` - Refresh from disk
- `Ctrl/Cmd+Shift+X` - Toggle text direction (RTL/LTR)
- `Ctrl/Cmd +` - Increase font size
- `Ctrl/Cmd -` - Decrease font size
- `Ctrl/Cmd 0` - Reset font size

### Settings

Access settings via `File → Preferences → Settings` and search for "RTL Editor":

- **Show Editor Button** - Display RTL Editor button in editor toolbar (default: enabled)
- **Auto Detect RTL** - Automatically detect and adjust text direction (default: enabled)
- **Save Confirmation Duration** - How long to show "File saved" message (default: 3 seconds)

### File Types

The RTL Editor works with:
- `.txt` files - Plain text
- `.md` files - Markdown
- `.rtl` files - Custom RTL files
- Any file type (using "Open in RTL Editor" command)

### Features

- **Native RTL Support** - Proper right-to-left text rendering
- **Mixed Content** - Handles both RTL and LTR text automatically
- **Auto-save** - Saves automatically when you switch away from the editor
- **External Change Detection** - Notifies when files are modified outside VS Code
- **Character & Word Count** - Real-time statistics in the status bar
- **Responsive Design** - Editor auto-resizes based on content
> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
