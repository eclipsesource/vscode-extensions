import * as vscode from 'vscode';
import { executeCommand } from '../base/commands';
import { resolveNamespaceFromPath } from './util';
import { InscriptionActionArgs } from '@axonivy/inscription-protocol';
import { InscriptionActionHandler, SendInscriptionNotification } from '../inscription-action-handler';

export type ProcessKind = 'Business Process' | 'Callable Sub Process' | 'Web Service Process';

export interface NewProcessParams {
  name: string;
  namespace: string;
  path: string;
  kind?: ProcessKind;
  pid?: string;
}

export class NewProcessActionHandler implements InscriptionActionHandler {
  actionId = 'newProcess' as const;
  async handle(actionArgs: InscriptionActionArgs, sendInscriptionNotification: SendInscriptionNotification): Promise<void> {
    const tabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (tabInput instanceof vscode.TabInputCustom) {
      await executeCommand('ivyProjects.addProcess', tabInput, actionArgs.context.pid);
      sendInscriptionNotification('dataChanged');
      sendInscriptionNotification('validation');
    }
  }
}

const prompt =
  'Enter the new process name e.g. "myProcess". You can also specify its directory name in the form "parentDirectory/subDirectory/myProcess".';

export async function addNewProcess(selectedUri: vscode.Uri, projectDir: string, kind?: ProcessKind, pid?: string) {
  const input = await collectNewProcessParams(selectedUri, projectDir);
  if (input) {
    await executeCommand('engine.createProcess', { pid, kind, ...input });
  }
}

async function collectNewProcessParams(selectedUri: vscode.Uri, projectDir: string): Promise<NewProcessParams | undefined> {
  const resolvedNamespace = await resolveNamespaceFromPath(selectedUri, projectDir, 'processes');
  const placeHolder = 'newProcessName';
  const nameWithNamespace = await vscode.window.showInputBox({
    title: 'Process Name',
    prompt,
    placeHolder,
    value: resolvedNamespace ? resolvedNamespace + placeHolder : undefined,
    valueSelection: resolvedNamespace ? [resolvedNamespace.length, -1] : undefined,
    validateInput: validateNameWithNamespace,
    ignoreFocusOut: true
  });
  if (!nameWithNamespace) {
    return;
  }
  const nameStartIndex = nameWithNamespace.lastIndexOf('/') + 1;
  const name = nameWithNamespace.substring(nameStartIndex, nameWithNamespace.length);
  const namespace = nameWithNamespace.substring(0, nameStartIndex - 1);
  return { name, path: projectDir, namespace };
}

function validateNameWithNamespace(value: string): string | undefined {
  const pattern = /^\w+(\/\w+)*$/;
  if (pattern.test(value)) {
    return;
  }
  return `Alphanumeric name expected. ${prompt}`;
}
