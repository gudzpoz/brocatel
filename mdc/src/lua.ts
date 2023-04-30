import fengari from 'fengari';

export function detectLuaErrors(lua: string): Error | null {
  const L = fengari.lauxlib.luaL_newstate();
  if (fengari.lauxlib.luaL_loadstring(L, fengari.to_luastring(lua)) === fengari.lua.LUA_OK) {
    return null;
  }
  return new SyntaxError(fengari.lua.lua_tojsstring(L, -1));
}

export function runLua(lua: string) {
  const L = fengari.lauxlib.luaL_newstate();
  fengari.lauxlib.luaL_dostring(L, fengari.to_luastring(lua));
}
