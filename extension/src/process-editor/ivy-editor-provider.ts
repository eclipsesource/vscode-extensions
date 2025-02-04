import { executeCommand } from '../base/commands';
import { GlspVscodeConnector, GlspEditorProvider, DisposableCollection } from '@eclipse-glsp/vscode-integration';
import * as vscode from 'vscode';
import fs from 'fs';
import { NotificationType, RequestType, MessageParticipant } from 'vscode-messenger-common';
import { messenger } from '../messenger';
import { InscriptionWebSocketMessage, IvyScriptWebSocketMessage, WebSocketForwarder } from '../websocket-forwarder';

const ColorThemeChangedNotification: NotificationType<'dark' | 'light'> = { method: 'colorThemeChanged' };
const WebviewReadyNotification: NotificationType<void> = { method: 'ready' };
const InitializeConnectionRequest: RequestType<void, void> = { method: 'initializeConnection' };
const StartProcessRequest: RequestType<string, void> = { method: 'startProcess' };

export default class IvyEditorProvider extends GlspEditorProvider {
  diagramType = 'ivy-glsp-process';
  static readonly viewType = 'ivy.glspDiagram';

  constructor(
    protected readonly extensionContext: vscode.ExtensionContext,
    protected override readonly glspVscodeConnector: GlspVscodeConnector
  ) {
    super(glspVscodeConnector);
  }

  setUpWebview(_document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken, clientId: string) {
    const webview = webviewPanel.webview;
    webviewPanel.webview.options = {
      enableScripts: true
    };

    const messageParticipant = messenger.registerWebviewPanel(webviewPanel);
    const toDispose = new DisposableCollection(
      new WebSocketForwarder('ivy-inscription-lsp', messageParticipant, InscriptionWebSocketMessage),
      new WebSocketForwarder('ivy-script-lsp', messageParticipant, IvyScriptWebSocketMessage),
      messenger.onNotification(WebviewReadyNotification, () => this.handleWebviewReadyNotification(messageParticipant), {
        sender: messageParticipant
      }),
      messenger.onRequest(StartProcessRequest, startUri => executeCommand('engine.startProcess', startUri), {
        sender: messageParticipant
      }),
      vscode.window.onDidChangeActiveColorTheme(theme =>
        messenger.sendNotification(ColorThemeChangedNotification, messageParticipant, this.vsCodeThemeToMonacoTheme(theme))
      )
    );
    webviewPanel.onDidDispose(() => toDispose.dispose());

    const nonce = getNonce();

    const manifest = JSON.parse(fs.readFileSync(this.getAppUri('build.manifest.json').fsPath, 'utf8'));

    const rootHtmlKey = this.findRootHtmlKey(manifest);

    const relativeRootPath = manifest[rootHtmlKey]['file'] as string;
    const indexJs = webview.asWebviewUri(this.getAppUri(relativeRootPath));

    const relativeCssFilePaths = manifest[rootHtmlKey]['css'] as string[];
    const cssUris = relativeCssFilePaths.map(relativePath => webview.asWebviewUri(this.getAppUri(relativePath)));
    cssUris.push(webview.asWebviewUri(vscode.Uri.joinPath(this.extensionContext.extensionUri, 'css', 'inscription-editor.css')));

    const contentSecurityPolicy =
      `default-src 'none';` +
      `style-src 'unsafe-inline' ${webview.cspSource};` +
      `img-src ${webview.cspSource} https: data:;` +
      `script-src 'nonce-${nonce}';` +
      `worker-src ${webview.cspSource};` +
      `font-src ${webview.cspSource};` +
      `connect-src ${webview.cspSource}`;

    webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
          <meta name="viewport" content="width=device-width, height=device-height">
          ${cssUris.map(cssUri => `<link rel="stylesheet" type="text/css" href="${cssUri}" />`).join('\n')}
        </head>
        <body>
          <div id="${clientId}_container" class="main-widget"></div>
          <div id="inscription"></div>
          <script nonce="${nonce}" type="module" src="${indexJs}"></script>
        </body>
      </html>`;
  }

  private async handleWebviewReadyNotification(messageParticipant: MessageParticipant) {
    await messenger.sendRequest(InitializeConnectionRequest, messageParticipant);
    messenger.sendNotification(
      ColorThemeChangedNotification,
      messageParticipant,
      this.vsCodeThemeToMonacoTheme(vscode.window.activeColorTheme)
    );
  }

  private vsCodeThemeToMonacoTheme(theme: vscode.ColorTheme) {
    if (theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast) {
      return 'dark';
    }
    return 'light';
  }

  private getAppUri(...pathSegments: string[]) {
    return vscode.Uri.joinPath(this.extensionContext.extensionUri, 'webviews', 'process-editor', 'dist', ...pathSegments);
  }

  private findRootHtmlKey(buildManifest: object) {
    return Object.keys(buildManifest).filter(key => key.endsWith('index.html'))[0];
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
