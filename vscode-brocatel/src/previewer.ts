import * as vscode from 'vscode';

import WorkerInstance from './worker-instance';
import { SelectLine, StoryLine, TextLine } from './utils';

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

export default class BrocatelPreviewer {
  private decoration: vscode.TextEditorDecorationType;

  private editor: vscode.TextEditor;

  private panel: vscode.WebviewPanel;

  private worker: WorkerInstance;

  private sid: number = -1;

  onDisposed: (previewer: BrocatelPreviewer) => void;

  constructor(
    decoration: vscode.TextEditorDecorationType,
    editor: vscode.TextEditor,
    worker: WorkerInstance,
    onDisposed: (previewer: BrocatelPreviewer) => void,
  ) {
    this.decoration = decoration;
    this.editor = editor;
    this.worker = worker;
    this.onDisposed = onDisposed;
    this.panel = vscode.window.createWebviewPanel(
      'brocatelPreview',
      'Brocatel Preview',
      vscode.ViewColumn.Beside,
      { enableForms: false, enableScripts: true },
    );
    this.panel.webview.html = `
<!DOCTYPE html>
<html lang="en">
<head>
<title>${editor.document.fileName} Preview</title>
<style>
body {
  font-size: 1em;
  margin: 1em 0;
}

#lines > div > * {
  display: inline;
}
#lines > div > .tags {
  margin-left: 1em;
}
#lines > div > .tags span {
  font-size: 0.8em;
  color: var(--vscode-textLink-foreground);
}
#lines > div > .tags span::before {
  content: ":";
}

#lines > div > ul.select {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  list-style-type: none;
  border: 1px solid var(--vscode-widget-shadow);
  padding: 0;
}
ul.select::before {
  content: "Options:";
  display: block;
  margin-right: 1em
}
ul.select > li {
  list-style-type: none;
  display: inline-block;
  margin: 0.2em;
}
button {
  font-size: 1em;
  padding: 0.2em 1em;
}
button > * {
  display: inline;
}
</style>
</head>
<body>
<div id="lines"></div>
<div class="buttons">
  <button onclick="reload()">Reload</button>
</div>
<script>
const vscode = acquireVsCodeApi();
const lines = document.getElementById('lines');
window.addEventListener('message', ({ data }) => {
  switch (data.type) {
    case 'next':
      if (data.replace) {
        lines.removeChild(lines.lastElementChild);
      }
      const div = document.createElement('div');
      div.innerHTML = data.payload;
      lines.appendChild(div);
      break;
    case 'reload':
      lines.innerHTML = '';
      break;
    default:
      break;
  }
});
function next(input) {
  vscode.postMessage({ type: 'next', input });
}
function reload() {
  vscode.postMessage({ type: 'reload' });
}
</script>
</body>
</html>
`;
    this.panel.onDidDispose(() => {
      this.onDisposed(this);
      this.dispose();
    });
    this.panel.webview.onDidReceiveMessage(async ({ type, input }) => {
      try {
        switch (type) {
          case 'next':
            await this.next(input);
            break;
          case 'reload':
            await this.reload();
            break;
          default:
            break;
        }
      } catch (e) {
        vscode.window.showErrorMessage((e as Error).message);
      }
    });
  }

  fileName() {
    return this.editor.document.fileName;
  }

  async compile() {
    try {
      if (this.sid !== -1) {
        await this.worker.close(this.sid);
      }
      const { sid } = await this.worker.loadStory(this.fileName());
      this.sid = sid;
      await this.annotateEditor([]);
      return true;
    } catch (error) {
      const { cause } = error as Error;
      if (cause && Array.isArray((cause as any).messages)) {
        await this.annotateEditor((cause as any).messages);
      } else {
        throw error;
      }
      return false;
    }
  }

  async annotateEditor(messages: Message[]) {
    this.editor.setDecorations(
      this.decoration,
      messages.map((message) => {
        const start = point2Position(message.position?.start);
        const end = point2Position(message.position?.end);
        const range = new vscode.Range(
          start,
          start.isEqual(end) ? end.translate(0, 1) : end,
        );
        return {
          range,
          hoverMessage: message.message,
        };
      }),
    );
  }

  async pushLine(line: StoryLine | null, replace: boolean) {
    let html;
    if (!line) {
      html = '~~ STORY ENDED ~~';
    } else if ((line as any).select) {
      const { select } = line as SelectLine;
      html = `<ul class="select">
${(
    await Promise.all(
      select.map(
        async (option) => `<li><button onclick="next(${option.key})">
    ${await this.worker.remark(option.option.text)}
  </button></li>`,
      ),
    )
  ).join('\n')}
</ul>`;
    } else {
      const text = line as TextLine;
      html = `${await this.worker.remark(text.text)}${
        text.tags === true
          ? ''
          : `<div class="tags">${Object.entries(text.tags).map(
            ([key, value]) => `<span>${key}${value ? '=' : ''}${value}</span>`,
          )}</div>`
      }`;
    }
    await this.panel.webview.postMessage({
      type: 'next',
      payload: html,
      replace,
    });
  }

  async next(input?: number) {
    if (this.sid === -1) {
      return;
    }
    let replace = input !== undefined;
    let line = await this.worker.next(this.sid, input);
    while (line.output) {
      // eslint-disable-next-line no-await-in-loop
      await this.pushLine(line.output, replace);
      replace = false;
      if ((line.output as any).select) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      line = await this.worker.next(this.sid);
    }
    if (!line.output) {
      await this.pushLine(null, replace);
    }
  }

  async reload() {
    await this.worker.reload(this.sid);
    await this.panel.webview.postMessage({ type: 'reload' });
    await this.next();
  }

  async update() {
    try {
      if (await this.compile()) {
        await this.panel.webview.postMessage({ type: 'reload' });
        await this.next();
      }
    } catch (e) {
      vscode.window.showErrorMessage((e as Error).message);
    }
  }

  dispose() {
    if (this.sid !== -1) {
      this.worker.close(this.sid);
      this.sid = -1;
    }
  }
}
