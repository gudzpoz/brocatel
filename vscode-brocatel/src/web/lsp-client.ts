import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

import { log } from './utils';

export default async function newClient(context: vscode.ExtensionContext) {
  const serverMain = vscode.Uri.joinPath(
    context.extensionUri,
    'node_modules/@brocatel/mdls/dist/server.js',
  );
  const worker = new Worker(serverMain.toString(true));
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'markdown' }],
    markdown: {
      isTrusted: true,
      supportHtml: true,
    },
  };
  const client = new LanguageClient('brocatel', 'Brocatel', clientOptions, worker);
  await client.start();
  log('brocatel language server started');
  return client;
}
