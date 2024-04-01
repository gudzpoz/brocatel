import path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

import { log } from './utils';

export default async function newClient(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('..', 'mdls', 'dist', 'index.js'));
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.pipe },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'markdown' }],
    markdown: {
      isTrusted: true,
      supportHtml: true,
    },
  };
  const client = new LanguageClient('brocatel', 'Brocatel', serverOptions, clientOptions);
  await client.start();
  log('brocatel language server started');
  return client;
}
