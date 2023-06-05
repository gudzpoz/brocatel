local brocatel = require("brocatel")
local utils = require("spec.test_utils")
local StackedEnv = require("stacked_env")
local TablePath = require("table_path")

--- @param root table
local function wrap(root)
    return brocatel.VM.new({
    [""] = {
        version = 1,
        entry = "main",
    },
    main = root,
}, StackedEnv.new())
end

describe("VM", function ()
    it("runs simple arrays", function ()
        assert.same({"Hello", "Hi", "!"}, utils.gather_til_end(wrap({
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
        })))
    end)

    it("jumps with links", function ()
        local vm = wrap({
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
                link = { "first" }, root_node = "main",
            },
        })
        local as_is = function (msgid) return msgid end
        vm:set_gettext(as_is, as_is)
        assert.same(
            { "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi", "Hello", "Hi" },
            utils.gather_til_end(vm, 10)
        )
        local _, line = vm:lookup_label({ "first" })
        assert.equals("Hello", line)
        _, line = vm:lookup_label({ "main", "last" })
        assert.not_nil(line.link)
        _, line = vm:lookup_label({ "curious", "first" })
        assert.equals(1, #line)
        assert.equals(0, #line[1])
    end)

    it("with translation", function ()
        -- Translation and function calls.
        local call_count = 0
        local vm = wrap({
            {},
            { function() call_count = call_count + 1 end },
            {
                func = function(args)
                    call_count = call_count + 1
                    assert(args:equals(TablePath.from({ "main", 3, "args" })))
                end,
                args = {},
            },
            "Hi",
        })
        local as_is = function() return "is" end
        vm:set_gettext(as_is, as_is)
        assert.same({ "is" }, utils.gather_til_end(vm))
        assert.equals(2, call_count)
    end)

    it("with select statements", function ()
        local call_count = 0
        local vm = wrap({
            {},
            {
                select = {
                    { {}, "Selection #1", "Result #1" },
                    { {}, { function() call_count = call_count + 1; return false end,
                        {{}, "Selection #2" } }, "Result #2" },
                    { {}, { function() call_count = call_count + 1; return true end }, "Never" },
                    { {}, { function() call_count = call_count + 1; return true end,
                        {{}, "Selection #3" } }, "Result #3" },
                    { {}, { function() call_count = call_count + 1; return true end,
                        {{}, "Selection #4" } }, "Result #4" },
                },
            },
            "Hello",
        })
        --- @type table
        --- @diagnostic disable-next-line: assign-type-mismatch
        local selections = vm:next()
        assert.is_table(selections)
        for k, _ in pairs(selections) do
            assert(k == 1 or k == 4 or k == 5)
        end
        assert.equals("Selection #1", selections[1][1])
        assert.equals("Selection #3", selections[4][1])
        assert.equals("Selection #4", selections[5][1])
        assert.equals("Result #3", vm:next(4))
        assert.equals("Hello", vm:next())
    end)
end)
