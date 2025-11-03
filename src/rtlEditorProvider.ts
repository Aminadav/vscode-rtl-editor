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
                    this.updateWebview(webviewPanel.webview, document);
                    break;
            }
        });

        // Handle text document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !this.isInternalSave) {
                this.updateWebview(webviewPanel.webview, document);
            }
        });

        // Watch for external file changes - watch the specific file
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
            document.uri.fsPath,
            true, // ignore creates
            false, // watch changes
            true // ignore deletes
        );

        let lastModified = 0;
        fileWatcher.onDidChange(async () => {
            // Prevent triggering on our own saves
            if (this.isInternalSave) {
                return;
            }
            
            // Get file stats to check modification time
            try {
                const stats = await vscode.workspace.fs.stat(document.uri);
                const currentModified = stats.mtime;
                
                // Only notify if enough time has passed and it's actually a different modification
                if (currentModified > lastModified + 1000) { // 1 second buffer
                    lastModified = currentModified;
                    webviewPanel.webview.postMessage({ 
                        type: 'fileChanged',
                        message: 'File has been modified externally'
                    });
                }
            } catch (error) {
                // File might not exist, ignore
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
            <div class="toolbar">
                <div class="file-info">
                    <span class="file-name">${fileName}</span>
                    <div id="status-indicator" class="status-indicator"></div>
                </div>
                <div class="toolbar-buttons">
                    <button id="refresh-btn" class="btn btn-secondary" title="Refresh from file">
                        <span>🔄</span> Refresh
                    </button>
                    <button id="save-btn" class="btn btn-primary" title="Save file">
                        <span>💾</span> Save
                    </button>
                </div>
            </div>
            
            <div id="notification-bar" class="notification-bar hidden">
                <span id="notification-message"></span>
                <button id="notification-refresh" class="btn btn-small">Refresh</button>
                <button id="notification-dismiss" class="btn btn-small">×</button>
            </div>
            
            <div class="editor-container">
                <textarea id="editor" class="rtl-editor" placeholder="Start typing in RTL mode...">${this.escapeHtml(content)}</textarea>
            </div>
            
            <div class="status-bar">
                <div class="status-message">
                    <span id="save-status">RTL Mode Enabled</span>
                </div>
                <span id="char-count">Characters: ${content.length}</span>
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