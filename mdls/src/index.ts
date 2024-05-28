import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentSyncKind,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItemKind,
  DidChangeConfigurationNotification,
  BrowserMessageReader,
  BrowserMessageWriter,
  CompletionItem,
} from 'vscode-languageserver/browser';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils as path } from 'vscode-uri';

import { BrocatelCompiler, debug, util } from '@brocatel/mdc';

interface Settings {
  lintAllMarkdownFiles: boolean;
}
const defaultSettings: Settings = {
  lintAllMarkdownFiles: false,
};
let globalSettings: Settings = defaultSettings;
const documentSettings: Map<string, Thenable<Settings>> = new Map();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

declare const self: DedicatedWorkerGlobalScope;
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);
const connection = createConnection(messageReader, messageWriter);

const documents = new TextDocuments(TextDocument);

connection.onInitialize(({ capabilities }) => {
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: false,
      completionProvider: {
        triggerCharacters: [
          '#', // Markdown chars
          '.', ':', '`', // Lua chars
        ],
        resolveProvider: false,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = change.settings.languageServerExample as Settings || defaultSettings;
  }
});

function getDocumentSettings(resource: string): Thenable<Settings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'brocatel',
    });
    documentSettings.set(resource, result);
  }
  return result;
}

const compiler = new BrocatelCompiler({
  autoNewLine: true,
});

type VFile = Awaited<ReturnType<BrocatelCompiler['compileAll']>>;
type Tracked = {
  document: TextDocument,
  compiled?: VFile,
  /**
   * Used to clear previous diagnotics.
   */
  files: string[],
};

const trackedContents = new Map<string, Tracked>();

function norm(uri: string) {
  return URI.parse(uri).toString();
}
function split(uri: string) {
  const file = URI.parse(uri);
  return {
    directory: path.dirname(file),
    fileName: path.basename(file),
  };
}

async function compileDocument(document: TextDocument) {
  const { directory, fileName } = split(document.uri);
  const compiled = await compiler.compileAll(fileName, async (name: string) => {
    const file = path.joinPath(directory, `${name}.md`);
    if (trackedContents.has(file.toString())) {
      const content = trackedContents.get(file.toString());
      if (content) {
        return content.document.getText();
      }
    }
    const response = await fetch(file.toString());
    const content = await response.text();
    return content;
  });
  return compiled;
}

function point2Point(point?: { line: number, column: number }) {
  return {
    line: Math.max(point ? point.line - 1 : 0, 0),
    character: Math.max(point ? point.column - 1 : 0, 0),
  };
}

function newRange(start: Position, end: Position) {
  let left = start;
  let right = end;
  if (left.line === right.line && left.character === right.character) {
    right.character += 1;
  }
  if (left.line > right.line || (left.line === right.line && left.character > right.character)) {
    [left, right] = [right, left];
  }
  return {
    start: left,
    end: right,
  };
}

async function sendDiagnostics(tracked: Tracked, empty?: boolean) {
  const { document, compiled, files: prevFiles } = tracked;
  if (!empty && !compiled) {
    return [];
  }
  const groups: Record<string, VFile['messages']> = Object.fromEntries(
    prevFiles.map((file) => [file, []]),
  );
  if (!empty) {
    compiled!.messages.forEach((message) => {
      if (!message.file) {
        return;
      }
      if (!groups[message.file]) {
        groups[message.file] = [];
      }
      groups[message.file].push(message);
    });
  }
  const { directory } = split(document.uri);
  const files = await Promise.all(Object.entries(groups).map(async ([file, messages]) => {
    const fileUri = path.joinPath(directory, file);
    return connection.sendDiagnostics({
      uri: fileUri.toString(),
      diagnostics: messages.map((message) => {
        const range = newRange(
          point2Point(debug.point2Position(message.place)?.start),
          point2Point(debug.point2Position(message.place)?.end),
        );
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range,
          message: message.message,
        };
        return diagnostic;
      }),
    }).then(() => (messages.length === 0 ? [] : [file]));
  }));
  return files.flat();
}

const HTML_COMMENT_REGEX = /^<!--\s*brocatel\s*-->/i;
const FRONT_MATTER_REGEX = /^---\nbrocatel:/m;
async function isBrocatelDocument(document: TextDocument) {
  const settings = await getDocumentSettings(document.uri);
  if (settings.lintAllMarkdownFiles) {
    return true;
  }
  const text = document.getText({
    start: { line: 0, character: 0 },
    end: { line: 15, character: 0 },
  });
  if (HTML_COMMENT_REGEX.test(text)) {
    return true;
  }
  if (FRONT_MATTER_REGEX.test(text)) {
    return true;
  }
  return false;
}

async function validateBrocatelDocument(document: TextDocument) {
  const tracked = trackedContents.get(norm(document.uri));
  if (!tracked) {
    return;
  }
  if (!(await isBrocatelDocument(document))) {
    await sendDiagnostics(tracked, true);
    return;
  }
  const compiled = await compileDocument(document);
  tracked.compiled = compiled;
  tracked.files = await sendDiagnostics(tracked);
}
const validatingDocuments = new Map<string, number>();
const validationListeners: (() => void)[] = [];
async function validateDocument(document: TextDocument) {
  let concurrency = validatingDocuments.get(document.uri) ?? 0;
  validatingDocuments.set(document.uri, concurrency + 1);
  await validateBrocatelDocument(document);
  concurrency = validatingDocuments.get(document.uri) ?? 0;
  if (concurrency > 1) {
    validatingDocuments.set(document.uri, concurrency - 1);
  } else {
    validatingDocuments.delete(document.uri);
    if (validatingDocuments.size === 0) {
      validationListeners.forEach((listener) => listener());
      validationListeners.length = 0;
    }
  }
}
async function afterAllValidated() {
  if (validatingDocuments.size === 0) {
    return Promise.resolve();
  }
  const promise = new Promise<void>((resolve) => {
    validationListeners.push(resolve);
  });
  return promise;
}

documents.onDidOpen(async ({ document }) => {
  trackedContents.set(norm(document.uri), { document, files: [] });
  await validateDocument(document);
});
documents.onDidClose(({ document }) => {
  trackedContents.delete(norm(document.uri));
});
documents.onDidChangeContent(async (change) => {
  const { document } = change;
  const tracked = trackedContents.get(norm(document.uri));
  if (!tracked) {
    return;
  }
  tracked.document = document;
  await validateDocument(change.document);
});

function headingsToAnchor(heading: debug.LuaHeadingTree, prefix: string = ''): string[] {
  const headings = Object.entries(heading.children).flatMap(([name, h]) => {
    const children = headingsToAnchor(h, `${prefix}${name}#`);
    children.push(`${prefix}${name}`);
    return children;
  });
  return headings;
}

function interceptCompletion(): CompletionItem[] {
  return [{
    label: '_',
    kind: CompletionItemKind.Text,
    command: {
      title: '',
      command: 'intercept',
    },
  }];
}

connection.onCompletion(async (param: TextDocumentPositionParams) => {
  await afterAllValidated();
  const document = trackedContents.get(norm(param.textDocument.uri));
  if (!document) {
    return [];
  }
  const { compiled } = document;
  if (!compiled) {
    return [];
  }
  const rootData = debug.getRootData(compiled);
  const point = {
    line: param.position.line + 1,
    column: param.position.character + 1,
  };
  const name = compiled.path.endsWith('.lua') ? compiled.path.slice(0, -4) : compiled.path;
  const input = rootData.inputs?.[name];
  if (input) {
    const data = debug.getData(input);
    if (data.markdown) {
      const node = util.pinpoint(data.markdown, point);
      switch (node?.type) {
        case 'link': {
          if (node.url.startsWith('#')) {
            if (data.headings) {
              const range = {
                start: {
                  line: param.position.line,
                  character: param.position.character - node.url.length,
                },
                end: param.position,
              };
              return headingsToAnchor(data.headings, '#').map((anchor) => ({
                label: anchor,
                kind: CompletionItemKind.Reference,
                textEdit: {
                  range,
                  newText: anchor,
                },
              } as CompletionItem));
            }
          }
          break;
        }
        case 'mdxTextExpression' as 'code':
        case 'code':
        case 'inlineCode':
          return interceptCompletion();
        default: {
          break;
        }
      }
    }
  }
  return [];
});

documents.listen(connection);
connection.listen();
