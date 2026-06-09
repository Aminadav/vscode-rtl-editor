import * as vscode from 'vscode';
import * as path from 'path';

export class RtlEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'rtl-editor.rtlTextEditor';

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
                case 'edit':
                    await this.applyEdit(document, message.start, message.end, message.text);
                    break;
                case 'undo':
                    await vscode.commands.executeCommand('undo');
                    break;
                case 'redo':
                    await vscode.commands.executeCommand('redo');
                    break;
                case 'save':
                    await document.save();
                    webviewPanel.webview.postMessage({
                        type: 'saveSuccess',
                        message: 'File saved successfully'
                    });
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
            if (e.document.uri.toString() === document.uri.toString()) {
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

        fileWatcher.onDidChange(async () => {
            try {
                const fileContent = await vscode.workspace.fs.readFile(document.uri);
                const diskContent = Buffer.from(fileContent).toString('utf8');

                if (diskContent === document.getText()) {
                    return;
                }

                webviewPanel.webview.postMessage({
                    type: 'fileChanged',
                    message: 'File has been modified externally. Click Refresh to reload or continue editing.',
                    hasUnsavedChanges: true
                });
            } catch (error) {
                console.error('Error checking external file change:', error);
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

    private async applyEdit(document: vscode.TextDocument, start: number, end: number, text: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(document.positionAt(start), document.positionAt(end)),
            text
        );
        await vscode.workspace.applyEdit(edit);
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
                <div class="editor-wrapper">
                    <textarea id="editor" class="rtl-editor" placeholder="Start typing in RTL mode...">${this.escapeHtml(content)}</textarea>
                    <div id="line-numbers" class="line-numbers"></div>
                    <div id="line-mirror" class="line-mirror"></div>
                </div>
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