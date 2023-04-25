local TablePath = require("table_path")
local StackedEnv = require("stacked_env")

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
local lua_env = { a = 1 }
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

--[[
    VM tests
]]--
local brocatel = require("brocatel")
local vm = brocatel.VM.new({
    [""] = {
        version = 1,
        entry = "main",
    },
    main = tree,
}, StackedEnv.new())
results = {}
while true do
    local line, _ = vm:next()
    if line then
        results[#results + 1] = line
    else
        break
    end
end
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
            link = { 2 },
        },
    }
}, StackedEnv.new())
results = {}
for _ = 1, 10 do
    local line, _ = vm:next()
    results[#results + 1] = line
end
-- Not actually a path, but we just use it to compare tables for convenience.
assert(TablePath.from(results):equals(
        { "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", }
))
local _, line = vm:get_by_label(nil, "first")
assert(line == "Hello")
_, line = vm:get_by_label(nil, "last")
assert(line.type == "link")
_, line = vm:get_by_label(nil, "curious", "first")
assert(#line == 1)
assert(#line[1] == 0)
