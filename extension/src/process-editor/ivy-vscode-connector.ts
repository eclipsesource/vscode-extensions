import {
  ActionMessage,
  Args,
  GlspVscodeClient,
  GlspVscodeConnector,
  GlspVscodeConnectorOptions,
  MessageOrigin,
  MessageProcessingResult,
  NavigateToExternalTargetAction,
  SModelRootSchema,
  SelectionState,
  ServerMessageAction,
  SetMarkersAction
} from '@eclipse-glsp/vscode-integration';
import { Action, InitializeResult, SetModelAction } from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import IvyEditorProvider from './ivy-editor-provider';
import { SelectedElement } from '../base/process-editor-connector';

type IvyGlspClient = GlspVscodeClient & { app: string; pmv: string };
const severityMap = new Map([
  ['info', vscode.DiagnosticSeverity.Information],
  ['warning', vscode.DiagnosticSeverity.Warning],
  ['error', vscode.DiagnosticSeverity.Error]
]);

export class IvyVscodeConnector<D extends vscode.CustomDocument = vscode.CustomDocument> extends GlspVscodeConnector {
  private readonly emitter = new vscode.EventEmitter<SelectedElement>();
  private readonly onSelectedElementUpdate = this.emitter.event;
  protected readonly onDidChangeActiveGlspEditorEventEmitter = new vscode.EventEmitter<{ client: GlspVscodeClient<D> }>();
  private readonly modelLoading: vscode.StatusBarItem;

  constructor(options: GlspVscodeConnectorOptions) {
    super(options);

    this.onSelectionUpdate(selection => this.selectionChange(selection));
    this.modelLoading = vscode.window.createStatusBarItem();
    this.modelLoading.text = '$(loading~spin) Model loading';
  }

  get onDidChangeActiveGlspEditor() {
    return this.onDidChangeActiveGlspEditorEventEmitter.event;
  }

  override async registerClient(client: GlspVscodeClient<D>): Promise<InitializeResult> {
    this.onDidChangeActiveGlspEditorEventEmitter.fire({ client });

    client.webviewPanel.onDidChangeViewState(e => {
      if (e.webviewPanel.active) {
        this.onDidChangeActiveGlspEditorEventEmitter.fire({ client });
      }
    });
    return super.registerClient(client);
  }

  onSelectedElement(listener: (selectedElement: SelectedElement) => void) {
    this.onSelectedElementUpdate(listener);
  }

  private newSelectedElement(client: IvyGlspClient, pid: string): SelectedElement {
    return {
      app: client.app,
      pmv: client.pmv,
      pid: pid
    };
  }

  private selectionChange(selection: SelectionState) {
    const selectedElement = this.toSelectedElement(selection.selectedElementsIDs);
    this.emitter.fire(selectedElement);
  }

  private toSelectedElement(pids: string[]): SelectedElement {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, client] of this.clientMap) {
      if (client.webviewPanel.active) {
        const ivyClient = client as IvyGlspClient;
        if (pids.length > 0) {
          return this.newSelectedElement(ivyClient, pids[0]);
        }
      }
    }
    return undefined;
  }

  public override sendActionToClient(clientId: string, action: Action) {
    super.sendActionToClient(clientId, action);
  }

  protected override handleNavigateToExternalTargetAction(message: ActionMessage<NavigateToExternalTargetAction>): MessageProcessingResult {
    const { uri, args } = message.action.target;
    const absolutePath = args?.['absolutePath'] as string;
    if (absolutePath) {
      this.openWithProcessEditor(absolutePath);
    } else {
      this.showTextDocument(uri, args);
    }

    // Do not propagate action
    return { processedMessage: undefined, messageChanged: true };
  }

  private openWithProcessEditor(absolutePath: string) {
    vscode.commands.executeCommand('vscode.openWith', vscode.Uri.parse(absolutePath), IvyEditorProvider.viewType);
  }
  private showTextDocument(uri: string, args: Args | undefined) {
    const SHOW_OPTIONS = 'jsonOpenerOptions';
    let showOptions = { ...args };

    // Give server the possibility to provide options through the `showOptions` field by providing a
    // stringified version of the `TextDocumentShowOptions`
    // See: https://code.visualstudio.com/api/references/vscode-api#TextDocumentShowOptions
    const showOptionsField = args?.[SHOW_OPTIONS];
    if (showOptionsField) {
      showOptions = { ...args, ...JSON.parse(showOptionsField.toString()) };
    }

    vscode.window.showTextDocument(vscode.Uri.parse(uri), showOptions).then(
      () => undefined, // onFulfilled: Do nothing.
      () => undefined // onRejected: Do nothing - This is needed as error handling in case the navigationTarget does not exist.
    );
  }

  protected override processMessage(message: unknown, origin: MessageOrigin): MessageProcessingResult {
    if (ActionMessage.is(message)) {
      if (SetModelAction.is(message.action)) {
        const action = message.action;
        const client = this.clientMap.get(message.clientId);
        const ivyClient = client as IvyGlspClient;
        const newRoot = action.newRoot as SModelRootSchema & { args: { app: string; pmv: string } };
        ivyClient.app = newRoot.args.app;
        ivyClient.pmv = newRoot.args.pmv;
      }
    }
    return super.processMessage(message, origin);
  }

  protected override handleServerMessageAction(message: ActionMessage<ServerMessageAction>): MessageProcessingResult {
    switch (message.action.severity) {
      case 'ERROR':
      case 'FATAL':
        vscode.window.showErrorMessage(message.action.message);
        break;
      case 'WARNING':
        vscode.window.showWarningMessage(message.action.message);
        break;
      case 'INFO':
      case 'OK':
        if (message.action.message.includes('Model loading')) {
          this.modelLoading.show();
        } else {
          vscode.window.showInformationMessage(message.action.message);
        }
        break;
      case 'NONE':
        this.modelLoading.hide();
    }
    // Do not propagate action
    return { processedMessage: undefined, messageChanged: true };
  }

  protected override handleSetMarkersAction(
    message: ActionMessage<SetMarkersAction>,
    client: GlspVscodeClient<D> | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _origin: MessageOrigin
  ): MessageProcessingResult {
    if (client) {
      const updatedDiagnostics = message.action.markers.map(marker => {
        const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), marker.description, severityMap.get(marker.kind));
        diagnostic.source = marker.elementId;
        return diagnostic;
      });
      this.diagnostics.set(client.document.uri, updatedDiagnostics);
    }
    return { processedMessage: message, messageChanged: false };
  }
}
