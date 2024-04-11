import {
  BrocatelCompiler, StoryLine, StoryRunner,
  debug,
} from '@brocatel/mdc';
import { Ref, nextTick, ref } from 'vue';

import sample from '../assets/sample.md?raw';
import useVsCode from './useVsCode';

const vscode = useVsCode();

export type Message = Exclude<ReturnType<typeof debug.luaErrorToSource>, null>;

function reportErrorVsCode(err: Message[] | null, runtime?: boolean) {
  if (runtime) {
    vscode?.postMessage({
      type: 'error',
      messages: err ?? [],
    });
  }
}

const compiler = new BrocatelCompiler({});

type TryResult = Message | null;

export class StoryContainer {
  file: debug.VFile | null = null;

  ref: Ref<BrocatelStory> = ref(new BrocatelStory(this)) as any;

  errorHandler?: typeof reportErrorVsCode;

  tryCatchLua(func: () => Promise<void>): Promise<TryResult>;
  tryCatchLua(func: () => void): TryResult;
  tryCatchLua(func: () => Promise<void> | void) {
    try {
      const result = func();
      if (result instanceof Promise) {
        return result.catch((e) => this.tryCatchLua(() => {
          throw e;
        }));
      }
      this.handleError(null, true);
      return null;
    } catch (e) {
      if (!this.file) {
        throw e;
      }
      const err = debug.luaErrorToSource(debug.getRootData(this.file), e as Error);
      this.handleError(err ? [err] : null, true);
      if (!err) {
        throw e;
      }
      return err;
    }
  }

  handleError(err: Message[] | null, runtime: boolean) {
    if (this.errorHandler) {
      this.errorHandler(err, runtime);
    }
  }

  async updateStory(source: string, fetcher?: (fileName: string) => Promise<string>) {
    let lua;
    if (fetcher) {
      this.file = await compiler.compileAll(source, fetcher);
      this.handleError(
        this.file.messages.length === 0 ? null : this.file.messages.map((msg) => ({
          message: msg.message,
          source: 'main.md',
          start: debug.point2Position(msg.place)?.start ?? { line: 1, column: 1 },
          end: debug.point2Position(msg.place)?.end,
        })),
        false,
      );
      lua = this.file.value.toString();
    } else {
      lua = source;
    }
    const newStory = this.newStory();
    await newStory.loadStory(lua);
    this.ref.value = newStory;
  }

  reloadStory() {
    const s = this.ref.value;
    this.ref.value = this.newStory();
    s.reload();
    nextTick(() => {
      this.ref.value = s;
    });
  }

  newStory() {
    return new BrocatelStory(this);
  }
}

export class BrocatelStory {
  private err: Message | null;

  private errPosted: boolean;

  private container: StoryContainer;

  private story: StoryRunner;

  constructor(container: StoryContainer) {
    this.container = container;
    this.err = null;
    this.errPosted = false;
    this.story = new StoryRunner();
  }

  private setErr(err: Message | null) {
    this.err = err;
    this.errPosted = false;
  }

  async loadStory(storyLua: string, savedata?: string, extern?: any): Promise<void> {
    this.setErr(await this.container.tryCatchLua(
      () => this.story.loadStory(storyLua, savedata, extern),
    ));
  }

  reload(): void {
    if (!this.story.isLoaded()) {
      return;
    }
    this.setErr(this.container.tryCatchLua(() => this.story.reload()));
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
    this.setErr(this.container.tryCatchLua(() => {
      result = this.story.next(optionKey);
    }));
    return result;
  }

  save(): string | null {
    if (!this.story.isLoaded()) {
      return null;
    }
    let data = null;
    this.setErr(this.container.tryCatchLua(() => {
      data = this.story.save();
    }));
    return data;
  }

  load(data: string) {
    if (!this.story.isLoaded()) {
      return;
    }
    this.setErr(this.container.tryCatchLua(() => {
      this.story.load(data);
    }));
  }
}

const story = new StoryContainer();
story.errorHandler = reportErrorVsCode;

const luaScript = document.head.querySelector('script[type="application/lua"]');
if (luaScript) {
  story.updateStory(luaScript.innerHTML);
} else {
  story.updateStory('main', async (f) => (f === 'main' ? sample : ''));
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
        story.updateStory(data.file, (name) => sendRequest('read', name));
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

export function useContainer(): StoryContainer {
  return story;
}
