import * as vscode from 'vscode';

import newClient from './lsp-client';
import BrocatelPreviewer from './previewer';
import { error } from './utils';

const trackedDocuments = new Map<string, BrocatelPreviewer>();

export function activate(context: vscode.ExtensionContext) {
  newClient()
    .then((c) => context.subscriptions.push(c))
    .catch((e) => error('error starting language server', e));

  vscode.workspace.onDidCloseTextDocument((doc) => {
    trackedDocuments.delete(doc.fileName);
  });

  vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.fileName.endsWith('.md')) {
      const previewer = trackedDocuments.get(doc.fileName);
      if (previewer) {
        previewer.update();
      }
    }
  });

  context.subscriptions.push(vscode.commands.registerCommand('vscode-brocatel.preview', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('.md')) {
      let previewer = trackedDocuments.get(editor.document.fileName);
      if (!previewer) {
        previewer = new BrocatelPreviewer(context, editor, (disposed) => {
          trackedDocuments.delete(disposed.fileUri().fsPath);
        });
        trackedDocuments.set(editor.document.fileName, previewer);
      }
      previewer.update();
    } else {
      vscode.window.showErrorMessage('Please open a .md file first');
    }
  }));
}

export function deactivate() {
  trackedDocuments.clear();
}
