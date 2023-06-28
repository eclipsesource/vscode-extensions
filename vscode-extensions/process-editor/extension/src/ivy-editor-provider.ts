import { GlspVscodeConnector, GlspEditorProvider } from '@eclipse-glsp/vscode-integration';
import * as vscode from 'vscode';

export default class IvyEditorProvider extends GlspEditorProvider {
  diagramType = 'ivy-glsp-process';
  static readonly viewType = 'ivy.glspDiagram';

  constructor(
    protected readonly extensionContext: vscode.ExtensionContext,
    protected override readonly glspVscodeConnector: GlspVscodeConnector
  ) {
    super(glspVscodeConnector);
  }

  setUpWebview(
    _document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
    clientId: string
  ): void {
    const webview = webviewPanel.webview;
    const extensionUri = this.extensionContext.extensionUri;
    const webviewScriptSourceUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));

    this.handleInscriptionEditorFocus(webview);

    webviewPanel.webview.options = {
      enableScripts: true
    };

    webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, height=device-height">
					<meta http-equiv="Content-Security-Policy" content="
        default-src http://*.fontawesome.com  ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
        ">

        </head>
        <body>
          <div id="${clientId}_container" style="height: 100%;"></div>
          <script>var exports = {};</script>
          <script src="${webviewScriptSourceUri}"></script>
        </body>
      </html>`;
  }

  private handleInscriptionEditorFocus(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(message => {
      if (message?.kind === 'openInscription') {
        vscode.commands.executeCommand('inscriptionEditor.focus');
      }
    });
  }
}
