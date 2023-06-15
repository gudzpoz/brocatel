import { assert, test } from 'vitest';
import { detectLuaErrors, runLua, wrap } from '../src/lua';

test('Lua checking', () => {
  assert.isNotNull(detectLuaErrors('('));
  assert.isNull(detectLuaErrors('return ""'));
  assert.throw(() => runLua({}, ['assert(false)']), 'assertion failed');
});

test('Convert from Lua values', () => {
  assert.strictEqual(runLua(null, ['return 0']), 0);
  assert.strictEqual(runLua(undefined, ['return 0.5']), 0.5);
  assert.strictEqual(runLua(0, ['return "string" .. arg']), 'string0.0');
  assert.strictEqual(runLua(1.5, ['return true']), true);
  assert.strictEqual(runLua('a', ['return arg .. "b"']), 'ab');

  assert.deepStrictEqual(
    runLua('', ['return { a = true, b = 0, c = 0.5, d = "s", e = { 1, 2 }, f = { [1.5] = "" } }']),
    {
      a: true, b: 0, c: 0.5, d: 's', e: [1, 2], f: { 1.5: '' },
    },
  );
  const v = { a: [1, 2, 3] };
  assert.deepEqual(runLua(v, ['return arg']), v);
  assert.strictEqual(runLua(v, ['return arg']), v);
  assert.deepEqual(
    runLua([1, 2, 3], ['arg[4] = { a = 1, b = "c" }; return arg']),
    [1, 2, 3, { a: 1, b: 'c' }],
  );
});

test('JS function wrap', () => {
  assert.deepEqual(runLua(undefined, ['return a({b = "c"})'], {
    a: wrap((b: any) => b),
  }), { b: 'c' });
  assert.deepEqual(runLua(undefined, ['return a({7, 8, 9})'], {
    a: wrap((b: any) => b),
  }), [7, 8, 9]);

  let results;
  assert.strictEqual(runLua(undefined, ['return a(1, 2.5, "42", {b = "c"}, {7, 8, 9})'], {
    a: wrap((b: any, c: any, d: any, e: any, f: any) => {
      results = [b, c, d, e, f];
      return 1024;
    }),
  }), 1024);
  assert.deepEqual(results, [1, 2.5, '42', { b: 'c' }, [7, 8, 9]]);
});
