import { LuaFactory, type LuaEngine } from 'wasmoon';
import wasmoonWasm from 'wasmoon/dist/glue.wasm?url';

import vmBundle from '../../vm/vm-bundle.lua?raw';

const factory = new LuaFactory(typeof window === 'undefined' ? undefined : wasmoonWasm);
function newLuaState(): Promise<LuaEngine> {
  return factory.createEngine({
    openStandardLibs: true,
    injectObjects: false,
    enableProxy: true,
  });
}

export type LuaErrorDetector = {
  (code: string): SyntaxError | null;
  close(): void;
};

export async function luaErrorDetector(): Promise<LuaErrorDetector> {
  const L = await newLuaState();
  const f = (code: string) => {
    const top = L.global.getTop();
    try {
      L.global.loadString(code);
      return null;
    } catch (e) {
      return new SyntaxError((e as Error).message);
    } finally {
      L.global.setTop(top);
    }
  };
  f.close = () => L.global.close();
  return f;
}

export function allEmpty(...objects: any[]): boolean {
  return objects.every((o) => o === null || o === undefined
    || o === '' || (typeof o === 'object' && Object.keys(o).length === 0));
}

const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end',
  'false', 'for', 'function', 'goto', 'if', 'in',
  'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
]);

const LUA_IDENTIFIER = /^[A-Za-z_]\w*$/;

/**
 * Returns true if the string is a valid Lua identifier.
 *
 * @param s the string
 */
export function isIdentifier(s: string): boolean {
  return !LUA_KEYWORDS.has(s) && LUA_IDENTIFIER.test(s);
}

export type LuaRunner = {
  (
    arg: any,
    codes: string[],
    functions?: { [name: string]: (...args: any) => any },
  ): any;
  close(): void;
};

/**
 * Runs Lua snippets, passing the `arg` argument as the global value `arg`.
 *
 * @returns what the last snippet returns
 * @throws when error happened during evaluation
 */
export async function luaRunner(): Promise<LuaRunner> {
  const L = await newLuaState();
  const f = function runLua(
    arg: any,
    codes: string[],
    functions?: { [name: string]: (...args: any) => any },
  ): any {
    const top = L.global.getTop();
    if (functions) {
      Object.entries(functions).forEach(([k, v]) => {
        L.global.set(k, v);
      });
    }
    L.global.set('arg', arg);
    const result = codes.reduce((_, code) => {
      try {
        return L.doStringSync(code);
      } catch (e) {
        L.global.setTop(top);
        throw new Error(`error running ${code}: ${(e as Error).message}`);
      }
    }, null as any);
    L.global.setTop(top);
    return result;
  };
  f.close = () => L.global.close();
  return f;
}

export type TextLine = { text: string, tags: true | Record<string, string> };

export type SelectLine = { select: { key: number, option: TextLine }[] };

export type StoryLine = TextLine | SelectLine;

export class StoryRunner {
  L?: LuaEngine;

  async loadStory(story: string, savedata?: string, extern?: any) {
    this.close();
    const L = await newLuaState();
    this.L = L;
    L.global.loadString(vmBundle, 'vm.lua');
    L.global.lua.lua_pcallk(L.global.address, 0, -1, 0, 0, null);
    L.global.lua.lua_setglobal(L.global.address, 'vm');
    L.global.set('s', story.toString());
    L.global.set('extern', extern);
    L.global.set('save', savedata);
    await L.doString('story = vm.load_vm(s, save, { extern = extern })');
  }

  isLoaded() {
    return this.L !== undefined;
  }

  private checkL() {
    if (this.L) {
      return this.L;
    }
    throw new Error('story not loaded yet');
  }

  load(savedata: string) {
    const L = this.checkL();
    L.global.set('save', savedata);
    L.doStringSync('story:load(save)');
  }

  save(): string {
    return this.checkL().doStringSync('return story:save()');
  }

  next(optionKey?: number): StoryLine | null {
    const L = this.checkL();
    L.global.set('option', optionKey);
    const top = L.global.getTop();
    const result = L.doStringSync('return story:next(option)');
    L.global.setTop(top);
    return result;
  }

  close() {
    if (this.L) {
      this.L.global.close();
    }
    this.L = undefined;
  }
}
