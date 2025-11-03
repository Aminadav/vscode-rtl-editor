import * as vscode from 'vscode';
import * as path from 'path';

export class RtlEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'rtl-editor.rtlTextEditor';
    private isInternalSave = false;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new RtlEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            RtlEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
        return providerRegistration;
    }

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async message => {
            switch (message.type) {
                case 'save':
                    await this.saveDocument(document, message.content, webviewPanel.webview);
                    break;
                case 'refresh':
                    this.refreshFromDisk(document, webviewPanel.webview);
                    break;
                case 'refreshWithDraft':
                    // Refresh but keep user's draft content for comparison
                    this.refreshWithDraftContent(document, webviewPanel.webview, message.draftContent);
                    break;
            }
        });

        // Handle text document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !this.isInternalSave) {
                this.updateWebview(webviewPanel.webview, document);
            }
        });

        // Watch for external file changes - use a more reliable pattern
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                vscode.Uri.file(path.dirname(document.uri.fsPath)),
                path.basename(document.uri.fsPath)
            ),
            true, // ignore creates
            false, // watch changes
            true // ignore deletes
        );

        let lastModifiedTime = 0;
        let isExternalChange = false;
        
        // Initialize with current file time
        try {
            const initialStats = await vscode.workspace.fs.stat(document.uri);
            lastModifiedTime = initialStats.mtime;
        } catch (error) {
            // File might not exist yet
        }

        fileWatcher.onDidChange(async () => {
            // Prevent triggering on our own saves
            if (this.isInternalSave) {
                return;
            }
            
            // Get file stats to check modification time
            try {
                const stats = await vscode.workspace.fs.stat(document.uri);
                const currentModified = stats.mtime;
                
                // Only notify if this is truly an external change
                if (currentModified > lastModifiedTime + 100) { // 100ms buffer
                    lastModifiedTime = currentModified;
                    isExternalChange = true;
                    
                    webviewPanel.webview.postMessage({ 
                        type: 'fileChanged',
                        message: 'File has been modified externally. Click Refresh to reload or continue editing.',
                        hasUnsavedChanges: true // Let the webview decide based on its state
                    });
                }
            } catch (error) {
                console.error('Error checking file modification time:', error);
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            fileWatcher.dispose();
        });

        // Initial content update
        this.updateWebview(webviewPanel.webview, document);
    }

    private async saveDocument(document: vscode.TextDocument, content: string, webview: vscode.Webview): Promise<void> {
        this.isInternalSave = true;
        
        try {
            const workspaceEdit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            workspaceEdit.replace(document.uri, fullRange, content);
            await vscode.workspace.applyEdit(workspaceEdit);
            await document.save();
            
            // Notify webview that save was successful
            webview.postMessage({
                type: 'saveSuccess',
                message: 'File saved successfully'
            });
        } catch (error) {
            // Notify webview of save error
            webview.postMessage({
                type: 'saveError',
                message: 'Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        } finally {
            // Reset the flag after a short delay to allow file system events to settle
            setTimeout(() => {
                this.isInternalSave = false;
            }, 500);
        }
    }

    private updateWebview(webview: vscode.Webview, document: vscode.TextDocument): void {
        webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }

    private async refreshFromDisk(document: vscode.TextDocument, webview: vscode.Webview): Promise<void> {
        try {
            // Force reload the document from disk
            const fileContent = await vscode.workspace.fs.readFile(document.uri);
            const textContent = Buffer.from(fileContent).toString('utf8');
            
            webview.postMessage({
                type: 'refreshComplete',
                content: textContent
            });
        } catch (error) {
            webview.postMessage({
                type: 'refreshError',
                message: 'Failed to refresh file: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    }

    private async refreshWithDraftContent(document: vscode.TextDocument, webview: vscode.Webview, draftContent: string): Promise<void> {
        try {
            // Get the current file content from disk
            const fileContent = await vscode.workspace.fs.readFile(document.uri);
            const diskContent = Buffer.from(fileContent).toString('utf8');
            
            // Send both contents to webview for user to decide
            webview.postMessage({
                type: 'showMergeDialog',
                diskContent: diskContent,
                draftContent: draftContent,
                message: 'File was modified externally. Choose which version to keep:'
            });
        } catch (error) {
            webview.postMessage({
                type: 'refreshError',
                message: 'Failed to compare file versions: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.js')
        );

        // Get current content
        const content = document.getText();
        const fileName = path.basename(document.uri.fsPath);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
            <title>RTL Editor - ${fileName}</title>
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div id="notification-bar" class="notification-bar hidden">
                <span id="notification-message"></span>
                <button id="notification-refresh" class="btn btn-small">Refresh</button>
                <button id="notification-dismiss" class="btn btn-small">×</button>
            </div>
            
            <div class="editor-container">
                <textarea id="editor" class="rtl-editor" placeholder="Start typing in RTL mode...">${this.escapeHtml(content)}</textarea>
            </div>
            
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}