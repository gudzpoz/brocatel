import { type BrocatelCompiler } from '@brocatel/mdc/src/index';

let brocatel: Promise<typeof import('@brocatel/mdc/src/index')> | null = null;
let compiler: Promise<BrocatelCompiler> | null = null;
let fengari: Promise<any> | null = null;

function useMdc() {
  if (!brocatel) {
    brocatel = import('@brocatel/mdc/src/index');
  }
  return brocatel;
}

export function useCompiler() {
  if (!compiler) {
    compiler = useMdc().then((mdc) => new mdc.BrocatelCompiler({
      autoNewLine: true,
    }));
  }
  return compiler;
}

export function useFengari() {
  if (!fengari) {
    fengari = useMdc().then((mdc) => mdc.fengari);
  }
  return fengari;
}
