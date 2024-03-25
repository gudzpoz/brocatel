import * as vscode from 'vscode';

import BrocatelPreviewer from './previewer';
import WorkerInstance from './worker-instance';

import { log } from './utils';

const trackedDocuments = new Map<string, BrocatelPreviewer>();

export function activate(context: vscode.ExtensionContext) {
  const errorDecoration = vscode.window.createTextEditorDecorationType({
    border: '1px solid red',
  });
  context.subscriptions.push(errorDecoration);

  const worker = new WorkerInstance();
  context.subscriptions.push(worker);
  worker.echo('hello')
    .then((msg) => log('worker says', msg))
    .catch((e) => vscode.window.showErrorMessage(e.message));

  vscode.workspace.onDidCloseTextDocument((doc) => {
    const previewer = trackedDocuments.get(doc.fileName);
    if (previewer) {
      trackedDocuments.delete(doc.fileName);
      previewer.dispose();
    }
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
        previewer = new BrocatelPreviewer(errorDecoration, editor, worker, (disposed) => {
          trackedDocuments.delete(disposed.fileName());
        });
        trackedDocuments.set(editor.document.fileName, previewer);
      }
      previewer.update();
    } else {
      vscode.window.showErrorMessage('Please open a .md file first');
    }
  }));
}

export function deactivate() { }
