import { assert, test } from 'vitest';
import { LuaFactory } from 'wasmoon';

import { luaErrorDetector, luaRunner } from '../src/lua';

async function runLua(
  arg: any,
  code: string[],
  functions?: { [name: string]: (...args: any) => any },
) {
  return (await luaRunner())(arg, code, functions);
}

test('Wasmoon interop', async () => {
  // This config should stop any Lua side variables from leaking to JS side,
  // while keeping variables on the Lua side all proxied.
  // We need this for our macros: we want the AST transformed by Lua pure.
  //
  // Well, wasmoon is really badly documented and here is also where I test their API.
  const lua = await (new LuaFactory().createEngine({
    openStandardLibs: true,
    // Whether to inject some JS global values (like `Error` and `Promise`).
    injectObjects: false,
    // Achieves exactly the proxy behavior we want.
    enableProxy: true,
  }));
  assert.isFunction(lua.global.get('assert'));
  assert.equal(lua.global.getTop(), 0);

  assert.throws(() => lua.doStringSync('('), 'unexpected symbol near <eof>');
  lua.global.pop();
  assert.equal(lua.global.getTop(), 0);

  lua.global.set('s', 'string');
  assert.doesNotThrow(() => lua.doStringSync('assert(type(s) == "string")'));
  assert.equal(lua.doStringSync('return s'), 'string');
  assert.equal(lua.doStringSync('return "string"'), 'string');
  // Utility functions like doString do not pop elements from the stack.
  assert.equal(lua.global.getTop(), 2);

  const arr = [1, 2, 3, 4];
  lua.global.set('arr', arr);
  assert.equal(lua.doStringSync('return type(arr)'), 'userdata');
  arr.forEach((i) => assert.doesNotThrow(() => lua.doStringSync(`assert(arr[${i}] == ${i})`)));
  await lua.doString('arr[1] = 100');
  assert.equal(arr[0], 100);

  await lua.doString('t = { 1, 2, 3 }');
  const table = await lua.doString('return t');
  assert.isArray(table);
  assert.lengthOf(table, 3);
  assert.deepEqual(table, [1, 2, 3]);
  table[0] = 100;
  assert.doesNotThrow(() => lua.doStringSync('assert(t[1] == 1)'));

  await lua.doString('t = { a = 1, b = 2, 3, ["1"] = 4 }');
  const obj = await lua.doString('return t');
  assert.deepEqual(obj, { 1: 4, a: 1, b: 2 });
  obj.a = 100;
  assert.doesNotThrow(() => lua.doStringSync('assert(t.a == 1)'));

  lua.global.loadString('return { 1, 2 }');
  lua.global.assertOk(lua.global.lua.lua_pcallk(lua.global.address, 0, -1, 0, 0, null));
  lua.global.lua.lua_setglobal(lua.global.address, 'ret');
  assert.deepEqual(lua.global.get('ret'), [1, 2]);

  lua.global.close();
});

test('Lua checking', async () => {
  assert.isNotNull((await luaErrorDetector())('('));
  assert.isNull((await luaErrorDetector())('return ""'));
  try {
    await runLua({}, ['assert(false)']);
    assert.fail('exception expected');
  } catch (e) {
    assert.include((e as Error).message, 'assertion failed');
  }
});

test('Convert from Lua values', async () => {
  assert.strictEqual(await runLua(null, ['return 0']), 0);
  assert.strictEqual(await runLua(undefined, ['return 0.5']), 0.5);
  assert.strictEqual(await runLua(0, ['return "string" .. arg']), 'string0');
  assert.strictEqual(await runLua(0.1, ['return "string" .. arg']), 'string0.1');
  assert.strictEqual(await runLua(1.5, ['return true']), true);
  assert.strictEqual(await runLua('a', ['return arg .. "b"']), 'ab');

  assert.deepStrictEqual(
    await runLua('', ['return { a = true, b = 0, c = 0.5, d = "s", e = { 1, 2 }, f = { [1.5] = "" } }']),
    {
      a: true, b: 0, c: 0.5, d: 's', e: [1, 2], f: { 1.5: '' },
    },
  );
  const v = { a: [1, 2, 3] };
  assert.deepEqual(await runLua(v, ['return arg']), v);
  assert.strictEqual(await runLua(v, ['return arg']), v);
  assert.deepEqual(
    await runLua([1, 2, 3], ['arg[4] = { a = 1, b = "c" }; return arg']),
    [1, 2, 3, { a: 1, b: 'c' }],
  );
});

test('JS function wrap', async () => {
  assert.deepEqual(await runLua(undefined, ['return a({b = "c"})'], {
    a: (b: any) => b,
  }), { b: 'c' });
  assert.deepEqual(await runLua(undefined, ['return a({7, 8, 9})'], {
    a: (b: any) => b,
  }), [7, 8, 9]);

  let results;
  assert.strictEqual(await runLua(undefined, ['return a(1, 2.5, "42", {b = "c"}, {7, 8, 9})'], {
    a: (b: any, c: any, d: any, e: any, f: any) => {
      results = [b, c, d, e, f];
      return 1024;
    },
  }), 1024);
  assert.deepEqual(results, [1, 2.5, '42', { b: 'c' }, [7, 8, 9]]);
});
