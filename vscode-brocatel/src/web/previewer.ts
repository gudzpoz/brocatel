import * as vscode from 'vscode';
import { Utils as path } from 'vscode-uri';
import innerHtml from '@brocatel/mdui/out/index.html';

export interface MarkdownPoint {
  line: number;
  column: number;
  offset?: number;
}
export interface MarkdownSourceError {
  message: string;
  source: string;
  start: MarkdownPoint;
  end?: MarkdownPoint;
}

function point2Position(point?: MarkdownPoint): vscode.Position {
  if (!point) {
    return new vscode.Position(0, 0);
  }
  return new vscode.Position(point.line - 1, point.column - 1);
}

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
      this.annotateEditor([]);
      this.onDisposed(this);
    });
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'error': {
          const { messages } = message as { messages: any[] };
          const annotations: MarkdownSourceError[] = [];
          const serialized = messages.map((m) => {
            if (typeof m === 'string') {
              return m;
            }
            const msg = m as MarkdownSourceError;
            const directory = path.dirname(this.fileUri());
            console.log(msg);
            if (path.basename(path.joinPath(directory, msg.source)) === path.basename(this.fileUri())) {
              annotations.push(msg);
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
          const directory = path.dirname(this.fileUri());
          const file = path.joinPath(directory, name);
          const content = (await vscode.workspace.openTextDocument(file)).getText();
          this.panel.webview.postMessage({ type: 'result', result: content, id });
          break;
        }
        default:
          break;
      }
    });
    this.panel.webview.html = innerHtml;
    this.update();
  }

  fileUri() {
    return this.editor.document.uri;
  }

  async annotateEditor(messages: MarkdownSourceError[]) {
    this.diagnostics.clear();
    this.diagnostics.set(this.editor.document.uri, messages.map((m) => ({
      message: m.message,
      severity: vscode.DiagnosticSeverity.Error,
      range: new vscode.Range(
        point2Position(m.start),
        point2Position(m.end ?? m.start),
      ),
    })));
  }

  async update() {
    try {
      await this.panel.webview.postMessage({
        type: 'reload',
        file: path.basename(this.fileUri()),
        payload: this.editor.document.getText(),
      });
    } catch (e) {
      vscode.window.showErrorMessage((e as Error).message);
    }
  }
}
