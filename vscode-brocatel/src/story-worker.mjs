import { promises as fs } from 'fs';
import path from 'path';
import { parentPort } from 'worker_threads';

import remarkHtml from 'remark-html';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { BrocatelCompiler, StoryRunner, debug } from '@brocatel/mdc';

const remark = unified().use(remarkParse).use(remarkHtml);

let idAllocator = 0;
const upperLimit32 = 0xfffffff;
function allocateId() {
  if (idAllocator >= upperLimit32) {
    idAllocator = 0;
  }
  idAllocator += 1;
  return idAllocator;
}

/**
 * @param {string} file
 */
function splitPath(file) {
  const name = path.basename(file);
  const directory = path.dirname(file);
  return { name, directory };
}

const compiler = new BrocatelCompiler({});
/**
 * @typedef {Awaited<ReturnType<typeof compiler.compileAll>>} VFile
 */
/**
 * @param {string} file
 * @returns {Promise<VFile>}
 */
async function storyFromSource(file) {
  const { name, directory } = splitPath(file);
  const output = await compiler.compileAll(
    name,
    (ident) => fs.readFile(path.join(directory, `${ident}.md`), 'utf8'),
  );
  return output;
}

if (!parentPort) {
  throw new Error('parentPort not found');
}

/**
 * @param {number} id
 * @param {string} type
 * @param {any} payload
 */
function send(id, type, payload) {
  if (!parentPort) {
    return;
  }
  parentPort.postMessage({ type, payload, id });
}
/**
 * @param {number} id
 * @param {string|any[]} message
 */
function error(id, message) {
  send(id, 'error', { messages: Array.isArray(message) ? message : [message] });
}
/**
 * @param {number} id
 * @param {VFile} file
 * @param {() => void} func
 */
function captureLuaError(id, file, func) {
  try {
    func();
  } catch (e) {
    const err = debug.luaErrorToSource(
      debug.getRootData(file),
      /** @type {Error} */ (e),
    );
    if (!err) {
      throw e;
    }
    error(id, [err]);
  }
}

/**
 * @type {Map<number, { runner: StoryRunner, file: VFile }>}
 */
const stories = new Map();
/**
 * @param {number} sid
 */
function getStory(sid) {
  const story = stories.get(sid);
  if (!story) {
    throw new Error(`story ${sid} not found`);
  }
  return story;
}
/**
 * @param {number} id
 * @param {string} type
 * @param {any} payload
 */
async function process(id, type, payload) {
  switch (type) {
    case 'echo': {
      send(id, 'echo', payload);
      break;
    }
    case 'load': {
      const sid = allocateId();
      const story = await storyFromSource(payload);
      const runner = new StoryRunner();
      captureLuaError(id, story, () => {
        runner.loadStory(story.value.toString());
        stories.set(sid, { runner, file: story });
        send(id, 'loaded', { sid });
      });
      break;
    }
    case 'reload': {
      const { runner, file } = getStory(payload.sid);
      captureLuaError(id, file, () => {
        runner.reload();
        send(id, 'reloaded', { sid: payload.sid });
      });
      break;
    }
    case 'next': {
      const { runner, file } = getStory(payload.sid);
      captureLuaError(id, file, () => {
        send(id, 'output', { output: runner.next(payload.input) });
      });
      break;
    }
    case 'close': {
      const { sid } = payload;
      stories.delete(sid);
      send(id, 'closed', { sid });
      break;
    }
    case 'remark': {
      const html = (await remark.process(payload)).value.toString();
      send(id, 'remark', html);
      break;
    }
    default: {
      error(id, 'unknown message type');
      break;
    }
  }
}

parentPort.on('message', async ({ id, type, payload }) => {
  try {
    if (typeof type !== 'string' || typeof id !== 'number') {
      error(id, 'invalid message');
      return;
    }
    await process(id, type, payload);
  } catch (e) {
    // @ts-ignore
    error(id, e.toString());
  }
});
