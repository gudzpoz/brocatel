import {
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

import serverJs from '@brocatel/mdls/dist/server.js?raw';

import { log } from './utils';

const serverJsBlob = new Blob([serverJs], { type: 'text/javascript' });

export default async function newClient() {
  const worker = new Worker(URL.createObjectURL(serverJsBlob), { type: 'classic' });
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'markdown' }],
    synchronize: {},
    initializationOptions: {},
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
