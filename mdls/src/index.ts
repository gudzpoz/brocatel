import debounce from 'debounce';
import { Content, Parent, Root } from 'mdast';
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
} from 'vscode-languageserver/browser';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils as path } from 'vscode-uri';

import { BrocatelCompiler, debug } from '@brocatel/mdc';

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
      definitionProvider: true,
      completionProvider: {
        resolveProvider: true,
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

const validateBrocatelDocument = debounce(async (document: TextDocument) => {
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
}, 1000);

documents.onDidOpen(async ({ document }) => {
  trackedContents.set(norm(document.uri), { document, files: [] });
  await validateBrocatelDocument(document);
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
  await validateBrocatelDocument(change.document);
});

interface Point {
  line: number;
  column: number;
}

function comparePoints(a: Point, b: Point) {
  return a.line - b.line || a.column - b.column;
}

function findNodeByPoint(root: Root, point: Point) {
  const candidates: (Content | Root)[] = [root];
  while (candidates.length > 0) {
    const candidate = candidates.pop()!;
    if (!(candidate as any).children) {
      if (candidate.position) {
        // Auto-completable node should have a position
        if (comparePoints(point, candidate.position.start) > 0
          && comparePoints(point, candidate.position.end) < 0
        ) {
          return candidate;
        }
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    const { children } = candidate as Parent;
    // Bisect by position
    let left = 0;
    let right = children.length;
    while (right - left > 1) {
      const center = Math.floor((left + right) / 2);
      // Find a child around mid whose position is defined
      let mid = center;
      while (left < mid && !children[mid].position) {
        mid -= 1;
      }
      if (mid === left) {
        // The other direction
        mid = center + 1;
        while (mid < right - 1 && !children[mid].position) {
          mid += 1;
        }
        if (mid === right - 1) {
          // All, undefined, are, candidates.
          break;
        }
      }
      const child = children[mid];
      const position = child.position!;
      const cmp = comparePoints(point, position.start);
      // mid is in (left, right - 1), narrowing the range
      if (cmp < 0) {
        right = mid;
      } else if (cmp > 0) {
        left = mid + 1;
      } else {
        left = mid;
      }
    }
    candidates.push(...children.slice(left, right));
  }
  return null;
}

function headingsToAnchor(heading: debug.LuaHeadingTree, prefix: string = ''): string[] {
  const headings = Object.entries(heading.children).flatMap(([name, h]) => {
    const children = headingsToAnchor(h, `${prefix}${name}#`);
    children.push(`${prefix}${name}`);
    return children;
  });
  return headings;
}

connection.onCompletion((param: TextDocumentPositionParams) => {
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
      const node = findNodeByPoint(data.markdown, point);
      switch (node?.type) {
        case 'link': {
          if (node.url.startsWith('#')) {
            if (data.headings) {
              return headingsToAnchor(data.headings).map((anchor) => ({
                label: anchor,
                kind: CompletionItemKind.Reference,
              }));
            }
          }
          break;
        }
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
