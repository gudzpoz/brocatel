local TablePath = require("table_path")
local StackedEnv = require("stacked_env")
local savedata = require("savedata")
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

-- Env and if-else.
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
                { {}, { link = { 2 } } }
            },
            "Hi",
            { link = {}, root_name = "file2" }
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
vm_with_env:load(vm_with_env:save())
assert(lua_env["a"] == 3)
vm_with_env:load(vm_with_env:save())
assert(vm_with_env.savedata.globals["a"], 7)

--[[
    Savedata tests
]]--

local complex = {}
local layer = 5
local function foreach_index(func)
    for i = 1, math.pow(layer, layer) do
        local indices = {}
        local j = i
        for _ = 1, layer do
            local mod = j % layer
            indices[#indices + 1] = mod + 1
            j = (j - mod) / layer
        end
        func(i, indices)
    end
end
foreach_index(function(i, indices)
    local t = complex
    for _, index in ipairs(indices) do
        if not t[index] then
            t[index] = {}
        end
        t = t[index]
    end
    t[1] = i
end)
complex = savedata.load(savedata.save(complex))
foreach_index(function(i, indices)
    local t = complex
    for _, index in ipairs(indices) do
        t = t[index]
    end
    assert(t[1] == i)
end)


--[[
    VM tests
]]--
-- Basic.
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

-- Links.
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
assert(line.link)
_, line = vm:lookup_label({ "curious", "first" })
assert(#line == 1)
assert(#line[1] == 0)

-- Translation and function calls.
local call_count = 0
vm = brocatel.VM.new({
    [""] = { version = 1, entry = "main" },
    main = {
        {},
        { function() call_count = call_count + 1 end },
        {
            func = function(args)
                call_count = call_count + 1
                assert(args:equals(TablePath.from({ 3, "args" })))
            end,
            args = {},
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

-- Select.
call_count = 0
vm = brocatel.VM.new({
    [""] = { version = 1, entry = "main" },
    main = {
        {},
        {
            select = {
                {},
                { {}, "Selection #1", "Result #1" },
                { {}, { function() call_count = call_count + 1; return false end, "Selection #2" }, "Result #2" },
                { {}, { function() call_count = call_count + 1; return true end }, "Never" },
                { {}, { function() call_count = call_count + 1; return true end, "Selection #3" }, "Result #3" },
                { {}, { function() call_count = call_count + 1; return true end, "Selection #4" }, "Result #4" },
            },
        },
        "Hello",
    }
}, StackedEnv.new())
local selections = vm:next()
assert(type(selections) == "table")
for k, _ in pairs(selections) do
    assert(k == 2 or k == 5 or k == 6)
end
assert(selections[2][1] == "Selection #1")
assert(selections[5][1] == "Selection #3")
assert(selections[6][1] == "Selection #4")
assert(vm:next(5) == "Result #3")
assert(vm:next() == "Hello")
