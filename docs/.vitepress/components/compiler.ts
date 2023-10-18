import { BrocatelCompiler, wasmoon } from '@brocatel/mdc';

const compiler = new BrocatelCompiler({ autoNewLine: true });
const factory = new wasmoon.LuaFactory();

export function useCompiler() {
  return compiler;
}

export async function newLuaEngine() {
  return factory.createEngine({
    openStandardLibs: true,
    injectObjects: false,
    enableProxy: true,
  });
}
