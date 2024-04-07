import {
  BrocatelCompiler, StoryLine, StoryRunner,
  debug,
} from '@brocatel/mdc';
import { Ref, ref } from 'vue';

import sample from '../assets/sample.md?raw';
import useVsCode from './useVsCode';

const vscode = useVsCode();
let file: debug.VFile | null = null;

export type Message = Exclude<ReturnType<typeof debug.luaErrorToSource>, null>;

function reportError(err: Message | null) {
  vscode?.postMessage({
    type: 'error',
    messages: err ? [err] : [],
  });
}

type TryResult = Message | null;

function tryCatchLua(func: () => Promise<void>): Promise<TryResult>;
function tryCatchLua(func: () => void): TryResult;
function tryCatchLua(func: () => Promise<void> | void) {
  try {
    const result = func();
    if (result instanceof Promise) {
      return result.catch((e) => tryCatchLua(() => {
        throw e;
      }));
    }
    reportError(null);
    return null;
  } catch (e) {
    if (!file) {
      throw e;
    }
    const err = debug.luaErrorToSource(debug.getRootData(file), e as Error);
    reportError(err);
    if (!err) {
      throw e;
    }
    return err;
  }
}

export class BrocatelStory {
  private err: Message | null;

  private errPosted: boolean;

  private story: StoryRunner;

  constructor() {
    this.err = null;
    this.errPosted = false;
    this.story = new StoryRunner();
  }

  private setErr(err: Message | null) {
    this.err = err;
    this.errPosted = false;
  }

  async loadStory(storyLua: string, savedata?: string, extern?: any): Promise<void> {
    this.setErr(await tryCatchLua(() => this.story.loadStory(storyLua, savedata, extern)));
  }

  reload(): void {
    if (!this.story.isLoaded()) {
      return;
    }
    this.setErr(tryCatchLua(() => this.story.reload()));
  }

  next(optionKey?: number): StoryLine | Message | null {
    if (this.err && !this.errPosted) {
      this.errPosted = true;
      return this.err;
    }
    if (!this.story.isLoaded()) {
      return null;
    }
    let result: StoryLine | null = null;
    this.setErr(tryCatchLua(() => {
      result = this.story.next(optionKey);
    }));
    return result;
  }

  save(): string | null {
    if (!this.story.isLoaded()) {
      return null;
    }
    let data = null;
    this.setErr(tryCatchLua(() => {
      data = this.story.save();
    }));
    return data;
  }

  load(data: string) {
    if (!this.story.isLoaded()) {
      return;
    }
    this.setErr(tryCatchLua(() => {
      this.story.load(data);
    }));
  }
}

const compiler = new BrocatelCompiler({});
const story: Ref<BrocatelStory> = ref(new BrocatelStory()) as any;

async function updateStory(source: string, fetcher?: (fileName: string) => Promise<string>) {
  let lua;
  if (fetcher) {
    file = await compiler.compileAll(source, fetcher);
    lua = file.value.toString();
  } else {
    lua = source;
  }
  const newStory = new BrocatelStory();
  await newStory.loadStory(lua);
  story.value = newStory;
}

const luaScript = document.head.querySelector('script[type="application/lua"]');
if (luaScript) {
  updateStory(luaScript.innerHTML);
} else {
  updateStory('main', async (f) => (f === 'main' ? sample : ''));
}

let incrementingId = 1;
const promises: Map<number, (result: any) => void> = new Map();
function sendRequest<T>(type: string, payload: any) {
  return new Promise<T>((resolve) => {
    const thisId = incrementingId;
    incrementingId += 1;
    promises.set(thisId, resolve);
    vscode?.postMessage({ type, payload, id: thisId });
  });
}

if (vscode) {
  window.addEventListener('message', ({ data }) => {
    const { type } = data;
    switch (type) {
      case 'reload': {
        updateStory(data.file, (name) => sendRequest('read', name));
        break;
      }
      case 'result': {
        const { id, result } = data;
        const resolve = promises.get(id);
        resolve?.(result);
        break;
      }
      default:
        break;
    }
  });
}

export function useStory(): Ref<BrocatelStory> {
  return story;
}
