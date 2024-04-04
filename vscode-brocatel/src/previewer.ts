import path from 'path';
import fs from 'fs/promises';

import * as vscode from 'vscode';

interface Point {
  line: number;
  column: number;
}

interface Message {
  message: string;
  position?: { start: Point; end: Point };
}

function point2Position(point?: Point): vscode.Position {
  if (!point) {
    return new vscode.Position(0, 0);
  }
  return new vscode.Position(point.line - 1, point.column - 1);
}

const indexHtml = 'node_modules/@brocatel/mdui/dist/index.html';

export default class BrocatelPreviewer {
  private diagnostics: vscode.DiagnosticCollection;

  private editor: vscode.TextEditor;

  private panel: vscode.WebviewPanel;

  onDisposed: (previewer: BrocatelPreviewer) => void;

  constructor(
    context: vscode.ExtensionContext,
    editor: vscode.TextEditor,
    onDisposed: (previewer: BrocatelPreviewer) => void,
  ) {
    this.diagnostics = vscode.languages.createDiagnosticCollection('brocatel');
    context.subscriptions.push(this.diagnostics);
    this.editor = editor;
    this.onDisposed = onDisposed;
    this.panel = vscode.window.createWebviewPanel(
      'brocatelPreview',
      'Brocatel Preview',
      vscode.ViewColumn.Beside,
      {
        enableForms: false,
        enableScripts: true,
      },
    );
    this.panel.onDidDispose(() => {
      this.onDisposed(this);
    });
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'error': {
          const { messages } = message as { messages: any[] };
          const annotations: Message[] = [];
          const serialized = messages.map((m) => {
            if (typeof m === 'string') {
              return m;
            }
            const msg = m as { message: string, source: string, line: number, column: number };
            if (path.basename(msg.source) === path.basename(this.fileName())) {
              annotations.push({
                message: msg.message,
                position: { start: msg, end: msg },
              });
            }
            return msg.message;
          });
          this.annotateEditor(annotations);
          vscode.window.showErrorMessage(serialized.join('\n'));
          break;
        }
        case 'read': {
          const { payload, id } = message as { payload: string, id: number };
          const name = payload.endsWith('.md') ? payload : `${payload}.md`;
          const directory = path.dirname(this.fileName());
          const file = path.join(directory, name);
          const content = (await fs.readFile(file)).toString('utf-8');
          this.panel.webview.postMessage({ type: 'result', result: content, id });
          break;
        }
        default:
          break;
      }
    });
    this.getHtmlForWebview(context);
  }

  async getHtmlForWebview(context: vscode.ExtensionContext) {
    const index = context.asAbsolutePath(indexHtml);
    const file = await fs.readFile(index);
    this.panel.webview.html = file.toString();
    await this.update();
  }

  fileName() {
    return this.editor.document.fileName;
  }

  async annotateEditor(messages: Message[]) {
    this.diagnostics.clear();
    this.diagnostics.set(this.editor.document.uri, messages.map((m) => ({
      message: m.message,
      severity: vscode.DiagnosticSeverity.Error,
      range: new vscode.Range(
        point2Position(m.position?.start),
        point2Position(m.position?.end),
      ),
    })));
  }

  async update() {
    try {
      await this.panel.webview.postMessage({
        type: 'reload',
        file: path.basename(this.fileName()),
        payload: this.editor.document.getText(),
      });
    } catch (e) {
      vscode.window.showErrorMessage((e as Error).message);
    }
  }
}
