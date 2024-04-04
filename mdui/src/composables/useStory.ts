import { BrocatelCompiler, StoryRunner, debug } from '@brocatel/mdc';
import { type Ref, ref } from 'vue';

import sample from '../assets/sample.md?raw';
import useVsCode from './useVsCode';

const compiler = new BrocatelCompiler({});
const story: Ref<Omit<StoryRunner, 'L'>> = ref(new StoryRunner());
const vscode = useVsCode();
let file: debug.VFile | null = null;

function reportError(err: ReturnType<typeof debug.luaErrorToSource>) {
  vscode?.postMessage({
    type: 'error',
    messages: err ? [err] : [],
  });
}

async function updateStory(source: string, fetcher?: (fileName: string) => Promise<string>) {
  let lua;
  if (fetcher) {
    file = await compiler.compileAll(source, fetcher);
    lua = file.value.toString();
  } else {
    lua = source;
  }
  const newStory = new StoryRunner();
  try {
    await newStory.loadStory(lua);
  } catch (e) {
    if (!file) {
      return;
    }
    const err = debug.luaErrorToSource(debug.getRootData(file), e as Error);
    if (err) {
      reportError(err);
    }
  }
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

export function useStory(): typeof story {
  return story;
}

export type Message = Exclude<ReturnType<typeof debug.luaErrorToSource>, null>;

export function tryCatchLua<T>(
  func: () => T,
  handler: (e: Message) => void,
): T | null {
  try {
    const result = func();
    reportError(null);
    return result;
  } catch (e) {
    if (!file) {
      throw e;
    }
    const err = debug.luaErrorToSource(debug.getRootData(file), e as Error);
    reportError(err);
    if (!err) {
      throw e;
    }
    handler(err);
    return null;
  }
}
