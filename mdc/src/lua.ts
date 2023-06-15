import {
  lauxlib, lua, lualib, to_luastring,
} from 'fengari';
import {
  checkjs, luaopen_js, push, tojs,
} from 'fengari-interop';

export function detectLuaErrors(code: string): Error | null {
  const L = lauxlib.luaL_newstate();
  if (lauxlib.luaL_loadstring(L, to_luastring(code)) === lua.LUA_OK) {
    return null;
  }
  return new SyntaxError(lua.lua_tojsstring(L, -1));
}

function convertSingleLuaValue(L: any, index: number): any {
  const i = lua.lua_absindex(L, index);
  if (!lua.lua_istable(L, i)) {
    return tojs(L, index);
  }
  const table: any = lauxlib.luaL_len(L, i) === 0 ? {} : [];
  lua.lua_checkstack(L, 2);
  lua.lua_pushnil(L);
  while (lua.lua_next(L, i)) {
    const key = convertSingleLuaValue(L, -2);
    const value = convertSingleLuaValue(L, -1);
    table[Number.isInteger(key) ? key - 1 : key] = value;
    lua.lua_pop(L, 1);
  }
  return table;
}

/**
 * Converts a Lua value on stack into a fully JavaScript one.
 *
 * @param L the Lua state
 * @param index the stack index
 * @returns the converted value
 */
function convertLuaValue(L: any, index: number): any {
  const root = convertSingleLuaValue(L, index);
  let partial = [[root, null, null]];
  while (partial.length !== 0) {
    partial = partial.filter(([e]) => e).flatMap(([element, key, p]) => {
      const parent = p;
      switch (typeof element) {
        case 'object':
          if (Array.isArray(element)) {
            return element.map((v, i, arr) => [v, i, arr]);
          }
          return Object.entries(element).map(([k, v]) => [v, k, element]);
        case 'function':
          lua.lua_checkstack(L, 1);
          push(L, element);
          if (!lua.lua_istable(L, -1)) {
            throw new TypeError('unable to convert value');
          }
          parent[key] = convertSingleLuaValue(L, -1);
          lua.lua_pop(L, 1);
          return [[parent[key], null, null]];
        default:
          return [];
      }
    });
  }
  return root;
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


/**
 * Runs Lua snippets, passing the `arg` argument as the global value `arg`.
 *
 * @returns what the last snippet returns
 */
export function runLua(
  arg: any,
  codes: string[],
  functions?: { [name: string]: (L: any) => number },
): any {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lauxlib.luaL_requiref(L, 'js', luaopen_js, false);
  // Let fengari-interop simulate Lua tables: start indices from 1.
  lauxlib.luaL_getmetatable(L, to_luastring('js object'));
  lua.lua_pushjsfunction(L, (J: any) => {
    const u = checkjs(J, 1);
    const k = tojs(J, 2);
    push(J, u[Array.isArray(u) ? k - 1 : k]);
    return 1;
  });
  lua.lua_setfield(L, -2, '__index');
  lua.lua_pushjsfunction(L, (J: any) => {
    const u = checkjs(J, 1);
    const k = tojs(J, 2);
    const v = tojs(J, 3);
    u[Array.isArray(u) ? k - 1 : k] = v;
    return 0;
  });
  lua.lua_setfield(L, -2, '__newindex');
  lua.lua_pop(L, 1);
  if (functions) {
    Object.entries(functions).forEach(([k, v]) => {
      lua.lua_pushjsfunction(L, v);
      lua.lua_setglobal(L, to_luastring(k));
    });
  }
  push(L, arg);
  lua.lua_setglobal(L, 'arg');
  codes.forEach((code) => {
    if (lauxlib.luaL_dostring(L, to_luastring(code)) !== lua.LUA_OK) {
      throw new Error(`error running ${code}: ${lua.lua_tojsstring(L, -1)}`);
    }
  });
  return convertLuaValue(L, -1);
}

export function wrap(f: Function) {
  return function unwrap(L: any) {
    const args: any[] = [];
    const top = lua.lua_gettop(L);
    for (let i = 1; i <= top; i += 1) {
      args.push(convertLuaValue(L, i));
    }
    lua.lua_settop(L, 0);
    const result = f.call(null, ...args);
    push(L, result);
    return 1;
  };
}
