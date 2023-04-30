import { assert, test } from 'vitest';
import { convertValue, detectLuaErrors, runLua } from '../src/lua';

test('Lua checking', () => {
  assert.isNotNull(detectLuaErrors('('));
  assert.isNull(detectLuaErrors('return ""'));
});

test('Lua run', () => {
  assert.strictEqual(runLua(null, ['return 0']), 0);
  assert.strictEqual(runLua(undefined, ['return 0.5']), 0.5);
  assert.strictEqual(runLua(0, ['return "string"']), 'string');
  assert.strictEqual(runLua(1.5, ['return true']), true);
  assert.deepStrictEqual(
    runLua('', ['return { a = true, b = 0, c = 0.5, d = "s", e = { 1, 2 }, f = { [1.5] = "" } }']),
    {
      a: true, b: 0, c: 0.5, d: 's', e: [1, 2], f: { 1.5: '' },
    },
  );
  const v = { a: [1, 2, 3] };
  assert.deepEqual(runLua(v, ['return arg']), v);
  assert.throw(() => runLua({}, ['assert(false)']), 'assertion failed');
});

test('Lua convert', () => {
  assert.equal(
    convertValue({ if: 'else', while: 'do', end: 'function' }),
    '{["end"]="function",["if"]="else",["while"]="do"}',
  );
});
