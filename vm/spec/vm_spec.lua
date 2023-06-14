local brocatel = require("vm")
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

describe("VM", function()
    describe("basic structures", function()
        it("like arrays", function()
            assert.same({ "Line 1", "Line 2" }, utils.gather_til_end(wrap({
                {},
                "Line 1",
                "Line 2",
            })))
        end)
        it("like templates", function()
            assert.same({ "Results: 42" }, utils.gather_til_end(wrap({
                {},
                {
                    text = "Results: {v1}",
                    values = {
                        v1 = function() return 42 end
                    },
                }
            })))
        end)
        it("like conditionals", function()
            for i = 1, 2 do
                assert.same({ i == 1 and "a" or "b", "c" }, utils.gather_til_end(wrap({
                    {},
                    {
                        function() return i == 1 end,
                        { {}, "a", "c" },
                        { {}, "b", "c" },
                    },
                })))
            end
        end)
        it("like function calls", function()
            assert.same({}, utils.gather_til_end(wrap({
                {},
                {
                    func = function(args) assert.same({ "main", 2, "args" }, args) end,
                },
            })))
        end)
    end)

    describe("provides a runtime for functions", function()
        it("like a global IP (instruction pointer)", function()
            local vm = nil
            vm = wrap({
                {},
                {
                    func = function(args)
                        vm.env:get("IP"):set(args:resolve(3))
                    end,
                    args = {
                        {},
                        { {}, "arg 1" },
                        { {}, "arg 2" },
                        { {}, "arg 3" },
                    }
                },
                "end",
            })
            assert.same({ "arg 2", "end" }, utils.gather_til_end(vm))
        end)
        it("like manual evaluation", function()
            local vm = nil
            vm = wrap({
                {},
                {
                    func = function(args)
                        local eval = vm.env:get("EVAL")
                        assert.equals("arg 1", eval(args:copy():resolve(2)))
                        assert.equals("arg 2", eval(args:copy():resolve(3)))
                        assert.is_nil(eval(args:copy():resolve(4)))
                    end,
                    args = {
                        {},
                        { {}, "arg 1" },
                        { {}, { function() return true end, "arg 2" } },
                        { {}, { function() return false end, "arg 3" } },
                    }
                },
                "end",
            })
            assert.same({ "end" }, utils.gather_til_end(vm))
        end)
        it("like custom data storage", function()
            local vm = nil
            vm = wrap({
                { labels = { a = { 2, "args", 2 } } },
                {
                    func = function(args)
                        local get = vm.env:get("GET")
                        local set = vm.env:get("SET")
                        local ip = vm.env:get("IP")
                        assert.is_nil(get(args, "k"))
                        set(args, "k", "v")
                        ip:set(args:resolve(2))
                    end,
                    args = { {}, { {}, "Hello" } },
                },
                {
                    func = function(args)
                        local get = vm.env:get("GET")
                        assert.is_nil(get(args, "k"))
                        assert.equals("v", get(args:resolve(nil, nil, 2, "args"), "k"))
                        local visited = vm.env:get("VISITED")
                        assert.equals(1, visited(vm.env:get("a")))
                        assert.error(function() vm.env:set("GET", 0) end)
                        assert.no_error(function() vm.env:set("_GET", 0) end)
                    end
                },
                "end",
            })
            assert.same({ "Hello", "end" }, utils.gather_til_end(vm))
            assert.same({ main = {
                { I = 1, R = { 0xe } },
                { args = { { I = 1, k = "v", R = { 2 } }, { { I = 1, R = { 2 } } } } },
            } }, vm.savedata.stats)
        end)
    end)

    it("runs simple arrays", function()
        assert.same({ "Hello", "Hi", "!" }, utils.gather_til_end(wrap({
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

    it("jumps with links", function()
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
        local as_is = function(msgid) return msgid end
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

    it("with translation", function()
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

    it("with select function", function()
        local call_count = 0
        local vm = nil
        vm = wrap({
            {},
            {
                func = function(args) vm.env:get("FUNC").S_ONCE(args) end,
                args = {
                    {},
                    { {}, "Selection #1", "Result #1" },
                    { {}, { function()
                        call_count = call_count + 1; return false
                    end,
                        { {}, "Selection #2" } }, "Result #2" },
                    { {}, { function()
                        call_count = call_count + 1; return true
                    end }, "Never" },
                    { {}, { function()
                        call_count = call_count + 1; return true
                    end,
                        { {}, "Selection #3" } }, "Result #3" },
                    { {}, { function()
                        call_count = call_count + 1; return vm.env:get("RECUR")(1)
                    end,
                        { {}, "Selection #4" } }, "Result #4" },
                },
            },
            "Hello",
            { func = function() vm.env:get("IP"):set(TablePath.from({ "main", 2 })) end },
        })
        local output = assert(vm:next())
        assert.same({
            tags = true,
            select = {
                { key = 2, option = "Selection #1" },
                { key = 5, option = "Selection #3" },
                { key = 6, option = "Selection #4" },
            },
        }, output)
        assert.equals("Result #3", vm:next(5).text)
        assert.equals("Hello", vm:next().text)

        assert.same({
            tags = true,
            select = {
                { key = 2, option = "Selection #1" },
                { key = 6, option = "Selection #4" },
            },
        }, vm:next())
        assert.equals("Result #4", vm:next(6).text)
        assert.equals("Hello", vm:next().text)
        assert.same({
            tags = true,
            select = {
                { key = 2, option = "Selection #1" },
                { key = 6, option = "Selection #4" },
            },
        }, vm:next())
        assert.equals("Result #4", vm:next(6).text)
        assert.equals("Hello", vm:next().text)

        assert.same({
            tags = true,
            select = {
                { key = 2, option = "Selection #1" },
            },
        }, vm:next())
        assert.equals("Result #1", vm:next(2).text)
        assert.equals("Hello", vm:next().text)
        -- Options exhausted
        assert.equals("Hello", vm:next().text)
    end)
end)
