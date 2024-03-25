import path from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';

import { StoryLine, error } from './utils';

let messageId = 0;
const upperLimit32 = 0xfffffff;
function allocateId() {
  if (messageId >= upperLimit32) {
    messageId = 0;
  }
  messageId += 1;
  return messageId;
}

const worker = new Worker(
  pathToFileURL(path.join(__dirname, 'story-worker.mjs')),
  { name: 'story-worker' },
);

interface Promised {
  resolve: (value: unknown) => void;
  reject: (reason: any) => void;
}

function timeOutPromise(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

export default class WorkerInstance {
  promised: Map<number, Promised>;

  constructor() {
    this.promised = new Map();
    worker.on('message', async (message) => {
      const { type, payload, id } = message;
      const handle = this.promised.get(id);
      if (!handle) {
        error('no handle for id', id);
        return;
      }
      if (type === 'error') {
        handle.reject(new Error(type, { cause: payload }));
      } else {
        handle.resolve(payload);
      }
    });
  }

  private send(type: string, payload: any) {
    const id = allocateId();
    const promise = new Promise<any>((resolve, reject) => {
      this.promised.set(id, { resolve, reject });
    });
    worker.postMessage({ type, payload, id });
    return Promise.race([promise, timeOutPromise(5000)]).finally(() => this.promised.delete(id));
  }

  close(sid: number): Promise<void> {
    return this.send('close', { sid });
  }

  echo(message: string): Promise<string> {
    return this.send('echo', message);
  }

  loadStory(file: string): Promise<{ sid: number }> {
    return this.send('load', file);
  }

  next(sid: number, input?: number): Promise<{ output: StoryLine | null }> {
    return this.send('next', { sid, input });
  }

  reload(sid: number): Promise<void> {
    return this.send('reload', { sid });
  }

  remark(markdown: string): Promise<string> {
    return this.send('remark', markdown);
  }

  // eslint-disable-next-line class-methods-use-this
  dispose() {
    worker.terminate();
  }
}
