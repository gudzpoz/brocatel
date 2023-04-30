import {
  lauxlib, lua, lualib, to_luastring,
} from 'fengari';

export function detectLuaErrors(code: string): Error | null {
  const L = lauxlib.luaL_newstate();
  if (lauxlib.luaL_loadstring(L, to_luastring(code)) === lua.LUA_OK) {
    return null;
  }
  return new SyntaxError(lua.lua_tojsstring(L, -1));
}

/**
 * Converts a Lua value on stack into a JavaScript one.
 *
 * @param L the Lua state
 * @param index the stack index
 * @returns the converted value
 */
function convertLuaValue(L: any, index: number): any {
  switch (lua.lua_type(L, index)) {
    case lua.LUA_TTABLE: {
      lua.lua_checkstack(L, 2);
      const i = lua.lua_absindex(L, index);
      const table = lauxlib.luaL_len(L, i) !== 0 ? [] : ({} as { [key: string]: any });
      lua.lua_pushnil(L);
      while (lua.lua_next(L, i)) {
        const key = convertLuaValue(L, -2);
        const value = convertLuaValue(L, -1);
        table[Number.isInteger(key) ? key - 1 : key] = value;
        lua.lua_pop(L, 1);
      }
      return table;
    }
    case lua.LUA_TNUMBER:
      return lua.lua_tonumber(L, index);
    case lua.LUA_TBOOLEAN:
      return lua.lua_toboolean(L, index);
    case lua.LUA_TSTRING:
      return lua.lua_tojsstring(L, index);
    case lua.LUA_TNIL:
    default:
      return null;
  }
}

/**
 * Compares between object entries.
 */
function entryCompare(a: [string, any], b: [string, any]): number {
  return a[0].localeCompare(b[0]);
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

function isIdentifier(s: string): boolean {
  return !LUA_KEYWORDS.has(s) && LUA_IDENTIFIER.test(s);
}

/**
 * Recursively converts a node into Lua table.
 *
 * There is a special node: `{ raw: string_element }`.
 * The content of the string element will be dumped as is, so as to
 * generate Lua functions.
 *
 * @param root the node
 * @param special turns on special node processing and empty node stripping
 */
export function convertValue(root: any, special: boolean = false): string {
  const builder: string[] = [];
  function format(value: any) {
    if (value === null || value === undefined) {
      builder.push('nil');
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      builder.push(JSON.stringify(value));
    } else if (value instanceof Array) {
      builder.push('{');
      value.forEach((e, i) => {
        if (i) {
          builder.push(',');
        }
        format(e);
      });
      builder.push('}');
    } else if (value instanceof Object) {
      if (special && typeof value.raw === 'string') {
        builder.push(value.raw);
      } else {
        builder.push('{');
        let entries = Object.entries(value);
        if (special) {
          entries = entries.filter(([k, v]) => !(k === 'type' && typeof v === 'string') && !allEmpty(v));
        }
        // To provide reproducible serialization (while maybe locale-dependent).
        entries = entries.sort(entryCompare);
        entries.forEach(([k, v], i) => {
          builder.push(
            i ? ',' : '',
            isIdentifier(k) ? k : JSON.stringify([k]),
            '=',
          );
          format(v);
        });
        builder.push('}');
      }
    } else {
      throw new TypeError(`unexpected ${value}: ${builder.join('')}`);
    }
  }
  format(root);
  return builder.join('');
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
  if (functions) {
    Object.entries(functions).forEach(([k, v]) => {
      lua.lua_pushjsfunction(L, v);
      lua.lua_setglobal(L, to_luastring(k));
    });
  }
  if (lauxlib.luaL_dostring(L, to_luastring(`arg = ${convertValue(arg)}`)) !== lua.LUA_OK) {
    throw new Error(`unable to serialize ${arg}`);
  }
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
    for (let i = 1; i <= lua.lua_gettop(L); i += 1) {
      args.push(convertLuaValue(L, i));
    }
    lua.lua_settop(L, 0);
    const result = f.call(null, ...args);
    lauxlib.luaL_dostring(L, to_luastring(`return ${convertValue(result)}`));
    return 1;
  };
}
