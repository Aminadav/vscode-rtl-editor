// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RtlEditorProvider } from './rtlEditorProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('RTL Editor extension is now active!');

	// Register the custom RTL text editor provider
	const rtlEditorProvider = RtlEditorProvider.register(context);
	context.subscriptions.push(rtlEditorProvider);

	// Register the command to open files in RTL editor
	const openRtlEditorCommand = vscode.commands.registerCommand('rtl-editor.openRtlEditor', async (uri?: vscode.Uri) => {
		let targetUri = uri;
		
		// If no URI provided, use the active editor's document
		if (!targetUri && vscode.window.activeTextEditor) {
			targetUri = vscode.window.activeTextEditor.document.uri;
		}
		
		// If still no URI, ask user to select a file
		if (!targetUri) {
			const selectedFiles = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: {
					'Text files': ['txt', 'md', 'rtl'],
					'All files': ['*']
				}
			});
			
			if (selectedFiles && selectedFiles.length > 0) {
				targetUri = selectedFiles[0];
			}
		}
		
		if (targetUri) {
			// Open the file with our custom RTL editor
			await vscode.commands.executeCommand('vscode.openWith', targetUri, 'rtl-editor.rtlTextEditor');
		}
	});

	context.subscriptions.push(openRtlEditorCommand);

	// Register a command to create a new RTL file
	const createRtlFileCommand = vscode.commands.registerCommand('rtl-editor.createRtlFile', async () => {
		const fileName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the new RTL file',
			placeHolder: 'example.rtl',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Please enter a valid filename';
				}
				return null;
			}
		});

		if (fileName) {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const newFileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
				
				// Create the file with empty content
				const edit = new vscode.WorkspaceEdit();
				edit.createFile(newFileUri, { ignoreIfExists: false });
				await vscode.workspace.applyEdit(edit);
				
				// Open it in the RTL editor
				await vscode.commands.executeCommand('vscode.openWith', newFileUri, 'rtl-editor.rtlTextEditor');
			} else {
				vscode.window.showWarningMessage('Please open a workspace folder first.');
			}
		}
	});

	context.subscriptions.push(createRtlFileCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('RTL Editor extension is now deactivated.');
}
