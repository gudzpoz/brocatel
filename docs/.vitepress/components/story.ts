// @ts-ignore
import bundle from '../cache/vm-bundle.lua?raw';

export default class Story {
  fengari: any;
  L: any;
  code: string;

  constructor(story: string, fengari: any) {
    this.fengari = fengari;
    this.code = story;
    const { lauxlib, lualib, lua, to_luastring } = fengari;
    const L = lauxlib.luaL_newstate();
    this.L = L;
    lualib.luaL_openlibs(L);
    lauxlib.luaL_requiref(L, 'js', fengari.js.luaopen_js, false);
    this.doString(bundle);
    lua.lua_setglobal(L, 'vm');
    lua.lua_pushstring(L, to_luastring(story));
    lua.lua_setglobal(L, 's');
    this.doString('story=vm.load_vm(s)');
  }

  doString(s: string) {
    const { lauxlib, lua, to_luastring } = this.fengari;
    if (lauxlib.luaL_dostring(this.L, to_luastring(s)) !== lua.LUA_OK) {
      console.log(new Error(`${lua.lua_tojsstring(this.L, -1)}:\n${s}`));
      console.log(this.code);
    }
  }

  next(option?: number) {
    const { lua, tojs } = this.fengari;
    if (option) {
      lua.lua_pushnumber(this.L, option);
    } else {
      lua.lua_pushnil(this.L);
    }
    lua.lua_setglobal(this.L, 'option');
    this.doString('return story:next(option)');
    const content = tojs(this.L, -1);
    lua.lua_pop(this.L, 1);
    return content;
  }
}
