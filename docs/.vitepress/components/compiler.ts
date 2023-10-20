import { BrocatelCompiler } from '@brocatel/mdc';

const compiler = new BrocatelCompiler({ autoNewLine: true });

export function useCompiler() {
  return compiler;
}
