local TablePath = require("table_path")
local StackedEnv = require("stacked_env")
local brocatel = require("brocatel")

--[[
    TablePath tests
]]--

assert(TablePath.new():equals(TablePath.from({})))
assert(not TablePath.new():equals(TablePath.from({ 1 })))
assert(TablePath.from({ 1, 2, 3 }):__tostring() == "/1/2/3")

local path = TablePath.from({ 1, 2, 3 })
assert(path:copy():copy():equals(path))

local tree = {
    {},
    {
        {},
        {
            {},
            "Hello",
            "Hi",
        },
        { {} },
    },
    { {}, { {}, { {} } } },
    {
        {},
        "!",
    }
}
assert(TablePath.from({ 4, 2 }):get(tree) == "!")
assert(TablePath.from({ 2, 2, 2 }):get(tree) == "Hello")
assert(TablePath.from({ 2, 2, 2 }):get(tree, 1)[3] == "Hi")
assert(TablePath.from({ 4, 2 }):resolve(nil, nil, 2, 2, 2):get(tree) == "Hello")

path = TablePath.new()
local results = {}
path:step(tree, true)
repeat
    results[#results + 1] = path:get(tree)
until not path:step(tree)
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals({ "Hello", "Hi", "!" }))

--[[
    StackedEnv tests
]]--

local env = StackedEnv.new()
local lua_env = { a = 1, type = type, assert = assert }
local glob = {}
assert(not env:get(""))
env:set_lua_env(lua_env)
assert(env:get("a") == 1)
env:set("a", 2)
assert(lua_env["a"] == 2)

env:set_global_scope(glob)
env:set_label_lookup(function (s)
    if s[1] == "some" then
        return {1}
    end
end)
env:set_init(false)
-- Globals
env:set("b", 1)
assert(not lua_env["b"])
assert(glob["b"] == 1)
assert(env:get("a") == 2)
-- Labels.
assert(type(env:get("some")) == "table")
assert(not pcall(function () env:set("some", 0) end))
assert(not pcall(function () env:get("some").other = 0 end))
-- Stacked.
local t1 = { keys = { k1 = true, k2 = true }, values = { k1 = "ok" } }
local t2 = { keys = { k1 = true }, values = {} }
env:push(t1)
env:push(t2)
assert(not env:get("k1"))
env:set("k1", 1)
env:set("k2", 2)
assert(t1.values.k1 == "ok")
assert(t1.values.k2 == 2)
assert(t2.values.k1 == 1)

local chunk
local code = [[
    a = 3
    return {
        [""] = { version = 1, entry = "main" },
        main = {
            {},
            {
                function()
                    a = a + 1
                    assert(type(main) == "table")
                    assert(#main == 1)
                    assert(not not_found)
                    return a > 6
                end,
                { {}, "Hello" },
                { {}, { type = "link", link = { 2 } } }
            },
            "Hi",
            { type = "link", link = {}, root_name = "file2" }
        },
        file2 = { {}, "End" },
    }
]]

--- @param vm VM
--- @param limit number|nil
local function gather_til_end(vm, limit)
    limit = limit or 1e6
    local lines = {}
    for _ = 1, limit do
        local line, _ = vm:next()
        if line then
            lines[#lines + 1] = line
        else
            break
        end
    end
    return lines
end
if setfenv then
    chunk = assert(loadstring(code))
    setfenv(chunk, env.env)
else
    chunk = assert(load(code, nil, nil, env.env))
end
env:set_init(true)
local vm_with_env = brocatel.VM.new(chunk(), env)
assert(lua_env["a"] == 3)
results = gather_til_end(vm_with_env)
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals({ "Hello", "Hi", "End" }))
assert(lua_env["a"] == 3)
assert(vm_with_env.save.globals["a"], 7)

--[[
    VM tests
]]--
local vm = brocatel.VM.new({
    [""] = {
        version = 1,
        entry = "main",
    },
    main = tree,
}, StackedEnv.new())
results = gather_til_end(vm)
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals({ "Hello", "Hi", "!" }))

vm = brocatel.VM.new({
    [""] = {
        version = 1,
        entry = "main",
    },
    main = {
        {
            labels = {
                first = { 2 },
                last = { 5 },
                curious = { 3 },
            }
        },
        "Hello",
        { { labels = { first = { 2 } } }, { {} } },
        "Hi",
        {
            type = "link",
            link = {},
        },
    }
}, StackedEnv.new())
local as_is = function (msgid) return msgid end
vm:set_gettext(as_is, as_is)
results = gather_til_end(vm, 10)
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals(
        { "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", }
))
local _, line = vm:lookup_label({ "first" })
assert(line == "Hello")
_, line = vm:lookup_label({ "main", "last" })
assert(line.type == "link")
_, line = vm:lookup_label({ "curious", "first" })
assert(#line == 1)
assert(#line[1] == 0)

local call_count = 0
vm = brocatel.VM.new({
    [""] = { version = 1, entry = "main" },
    main = {
        {},
        { function() call_count = call_count + 1 end },
        {
            type = "func",
            func = function(args)
                call_count = call_count + 1
                assert(args:equals(TablePath.from({ 3, "args" })))
            end,
            args = { {} },
        },
        "Hi",
    }
}, StackedEnv.new())
as_is = function() return "is" end
vm:set_gettext(as_is, as_is)
results = gather_til_end(vm)
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals({ "is" }))
assert(call_count == 2)
