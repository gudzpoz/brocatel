import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

import serverJs from '@brocatel/mdls/dist/server.js?raw';

import { log } from './utils';

const serverJsBlob = new Blob([serverJs], { type: 'text/javascript' });
const virtualDocumentContents = new Map<string, string>();
const codeBlockRegex = /(```|~~~)lua/g;
const inlineCodeRegex = /([^A-Za-z_:]*`+)([^`]*?)`$/;

function stripNonLuaCode(markdown: string) {
  const lines = markdown.split('\n');
  let codeBlockIndent = -1;
  let codeBlockStyle = '';
  return lines.map((line) => {
    if (codeBlockIndent !== -1) {
      const code = line.slice(codeBlockIndent);
      if (code === codeBlockStyle) {
        codeBlockIndent = -1;
        return '';
      }
      return ' '.repeat(codeBlockIndent) + line.slice(codeBlockIndent);
    }
    const match = line.match(codeBlockRegex);
    if (match) {
      codeBlockIndent = match.index!;
      codeBlockStyle = match[1];
      return '';
    }
    if (line.includes('`') || line.includes('{')) {
      const match = line.match(inlineCodeRegex);
      if (match) {
        return ' '.repeat(match.index! + match[1].length) + match[2];
      }
      let level = 0;
      let escaped = false;
      return line.split('').map((c, i) => {
        if (escaped) {
          return ' ';
        }
        if (c === '{') {
          level += 1;
          if (level === 1) {
            return '(';
          }
          return '{';
        }
        if (c === '}') {
          level -= 1;
          if (level === 0) {
            return ')';
          }
          return '}';
        }
        // TODO: Handle `` ` ``
        if (c === '`') {
          if (level === 0) {
            level = 1;
            return '(';
          }
          level = 0;
          return ')';
        }
        if (c === '\\' && level === 0) {
          escaped = true;
        }
        return level === 0 ? ' ' : c;
      }).join('') + '()';
    }
    return '';
  }).join('\n');
}

export default async function newClient() {
  const handle = vscode.workspace.registerTextDocumentContentProvider('embedded-content', {
    provideTextDocumentContent: uri => {
      // Remove leading `/` and ending `.css` to get original URI
      const originalUri = uri.path.slice(1).slice(0, -4);
      const decodedUri = decodeURIComponent(originalUri);
      return virtualDocumentContents.get(decodedUri);
    }
  });

  const worker = new Worker(URL.createObjectURL(serverJsBlob), { type: 'classic' });
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'markdown' }],
    synchronize: {},
    initializationOptions: {},
    markdown: {
      isTrusted: true,
      supportHtml: true,
    },
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        const result = await next(document, position, context, token);
        if (!result) {
          return result;
        }
        const array = Array.isArray(result) ? result : result.items;
        const item = array[0];
        if (!item) {
          return result;
        }
        if (!item.command || item.command.command !== 'intercept') {
          return result;
        }
        const originalUri = document.uri.toString(true);
        virtualDocumentContents.set(
          originalUri,
          stripNonLuaCode(document.getText()),
        );
        const vdocUriString = `embedded-content://lua/${encodeURIComponent(originalUri)}.lua`;
        const vdocUri = vscode.Uri.parse(vdocUriString);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          vdocUri,
          position,
          context.triggerCharacter
        );
        return list;
      },
    },
  };
  const client = new LanguageClient('brocatel', 'Brocatel', clientOptions, worker);
  await client.start();
  log('brocatel language server started');
  return {
    dispose: async () => {
      handle.dispose();
      await client.dispose();
    },
  };
}
