// @ts-ignore
import bundle from '../../../vm/vm-bundle.lua?raw';
import { wasmoon } from '@brocatel/mdc';

type LuaEngine = InstanceType<typeof wasmoon.LuaEngine>;

export default class Story {
  L: LuaEngine;
  code: string;

  constructor(story: string, L: LuaEngine) {
    this.code = story;
    this.L = L;
    this.L.global.loadString(bundle, 'brocatel.lua');
    this.L.global.assertOk(this.L.global.lua.lua_pcallk(this.L.global.address, 0, -1, 0, 0, null));
    this.L.global.lua.lua_setglobal(this.L.global.address, 'vm');
    this.L.global.set('s', story);
    this.L.doStringSync('story=vm.load_vm(s)');
  }

  next(option?: number) {
    this.L.global.set('option', option);
    const top = this.L.global.getTop();
    const result = this.L.doStringSync('return story:next(option)');
    this.L.global.setTop(top);
    return result;
  }
}
