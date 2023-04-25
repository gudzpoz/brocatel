--[[
    TablePath tests
]]--
local TablePath = require("table_path")

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
    VM tests
]]--
local brocatel = require("brocatel")
local vm = brocatel.VM.new({
    [""] = {
        version = 1,
        entry = "main",
    },
    main = tree,
})
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
})
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
