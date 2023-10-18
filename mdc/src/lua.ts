import { LuaFactory, type LuaEngine } from 'wasmoon';

const factory = new LuaFactory();
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
