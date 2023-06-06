local TablePath = require("table_path")

describe("TablePath", function()
    describe("creation", function()
        it("with arrays", function()
            assert.no_error(function() TablePath.from({ "root" }) end)
        end)
        it("rejects non-arrays", function()
            --- @diagnostic disable-next-line: param-type-mismatch
            assert.error(function() TablePath.from(1) end)
        end)
        it("rejects empty arrays", function()
            assert.is_false(pcall(function() TablePath.from({}) end))
        end)
        it("rejects arrays starting with a non-string element", function()
            assert.is_false(pcall(function() TablePath.from({ 0 }) end))
            assert.is_false(pcall(function() TablePath.from({ 42 }) end))
        end)
    end)

    it("comparison", function()
        assert.is_true(TablePath.from({ "a" }):equals(TablePath.from({ "a" })))
        assert.is_false(TablePath.from({ "a" }):equals(TablePath.from({ "b" })))
    end)

    it("tostring", function()
        assert.equals("/root/1/2/3", TablePath.from({ "root", 1, 2, 3 }):__tostring())
    end)

    it("copy", function()
        local path = TablePath.from({ "root", 1, 2, 3 })
        assert.is_true(path:copy():copy():equals(path))
    end)

    it("resolving", function()
        assert.same({ "root", 1, 2, 3 }, TablePath.from({ "root" }):resolve(1, 2, 3))
        assert.same({ "root", 1, 2, 3 }, TablePath.from({ "root" }):resolve({ 1, 2, 3 }))
        assert.same({ "root", 1 }, TablePath.from({ "root", 1, 2 }):resolve(nil))
        assert.same({ "root", 1 }, TablePath.from({ "root", 1, 2 }):resolve(nil, { nil }))
        assert.same({ "root", 1, 3 }, TablePath.from({ "root", 1, 2 }):resolve(nil, 3))
        assert.same({ "root", 1, 3 }, TablePath.from({ "root", 1, 2 }):resolve(nil, { 3 }))
    end)

    it("is done", function()
        assert.is_true(TablePath.from({ "root" }):is_done())
        assert.is_false(TablePath.from({ "root", 2 }):is_done())
    end)

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
    local root = { r = tree }
    describe("table retrieval", function()
        it("with absolute path", function()
            assert.equals("!", TablePath.from({ "r", 4, 2 }):get(root))
            assert.equals("Hello", TablePath.from({ "r", 2, 2, 2 }):get(root))
            assert.equals("Hi", TablePath.from({ "r", 2, 2, 2 }):get(root, 1)[3])
            assert.same({ {} }, TablePath.from({ "r", 2, 3 }):get(root))
            assert.is_nil(TablePath.from({ "r", 1, 1 }):get(root))
        end)

        it("with relatively resolved path", function()
            assert.equals("Hello", TablePath.from({ "r", 4, 2 }):resolve(nil, nil, 2, 2, 2):get(root))
        end)
    end)

    describe("stepping", function()
        it("with a moderate table", function()
            local path = TablePath.from({ "r" })
            local results = {}
            path:step(root, true)
            repeat
                results[#results + 1] = path:get(root)
            until not path:step(root)
            -- Not actually a path, but we just use it to compare tables for convenience.
            assert.same({ "Hello", "Hi", "!" }, TablePath.from(results))
        end)

        describe("with simple tables", function()
            it("like a empty one", function()
                local path = TablePath.from({ "r" })
                assert.is_false(path:step({}))
                assert.is_true(path:is_done())
            end)
            it("within arrays", function()
                local path = TablePath.from({ "r", 2 })
                local t = { r = { {}, 2, 3, 4, 5, 6 } }
                for i = 3, 6 do
                    assert.is_true(path:step(t))
                    assert.equals(i, path:get(t))
                    assert.same({ "r", i }, path)
                end
            end)
            it("exiting arrays", function()
                local path = TablePath.from({ "r", 2, 2 })
                local t = { r = { {}, { {}, 2 }, 3 } }
                assert.equals(2, path:get(t))
                assert.is_true(path:step(t))
                assert.is_false(path:is_done())
                assert.equals(3, path:get(t))
            end)
            it("entering arrays", function()
                local path = TablePath.from({ "r", 2 })
                local t = { r = { {}, 2, { {}, { {}, 3 } } } }
                assert.equals(2, path:get(t))
                assert.is_true(path:step(t))
                assert.is_false(path:is_done())
                assert.equals(3, path:get(t))
            end)
            it("crossing arrays", function()
                local path = TablePath.from({ "r", 2, 2 })
                local t = { r = { {}, { {}, 2 }, { {}, 3 } } }
                assert.equals(2, path:get(t))
                assert.is_true(path:step(t))
                assert.is_false(path:is_done())
                assert.equals(3, path:get(t))
            end)
            it("with non-existent paths", function()
                local path = TablePath.from({ "r", "o", 1 })
                assert.is_false(path:step({ r = { o = {} } }))
                assert.is_true(path:is_done())
                path = TablePath.from({ "r", 1, "o", 2 })
                assert.is_false(path:step({ r = { { o = {} } } }))
                assert.is_true(path:is_done())
            end)
        end)

        describe("with special values", function()
            it("like function args", function()
                local path = TablePath.from({ "r", 2, "args", 2 })
                local t = { r = { {}, { args = { {}, 2, 3 } } } }
                assert.equals(2, path:get(t))
                assert.is_false(path:step(t))
                assert.is_true(path:is_done())
            end)
            it("like root nodes named args", function()
                local path = TablePath.from({ "args", 2 })
                local t = { args = { {}, 2, 3 } }
                assert.equals(2, path:get(t))
                assert.is_true(path:step(t))
                assert.is_false(path:is_done())
                assert.equals(3, path:get(t))
            end)
        end)

        describe("during initialization", function()
            it("should stay in place if already pointing to a value", function()
                assert.is_false(TablePath.from({ "r", 2 }):step({ r = { {}, 2 } }))
                assert.is_true(TablePath.from({ "r", 2 }):step({ r = { {}, 2 } }, true))
            end)
            it("should step into an array if pointing to one", function()
                assert.is_false(TablePath.from({ "r" }):step({ r = { {}, 2 } }))
                local path = TablePath.from({ "r" })
                assert.is_true(path:step({ r = { {}, 2 } }, true))
                assert.same({ "r", 2 }, path)
            end)
        end)
    end)

    describe("listeners", function()
        it("are stored in that path", function()
            local path = TablePath.from({ "r" })
            assert.same({ "r" }, path)
            path:set_listener(function() end)
            assert.not_same({ "r" }, path)
            assert.is_true(path:equals({ "r" }))
        end)
        it("are called on change", function()
            local history = {}
            local path = TablePath.from({ "r" })
            path:set_listener(function(old, new)
                history[#history + 1] = { old:copy(), new }
            end)
            path:set({ "s" }):resolve(1):resolve(nil)
            path:step({ s = { {}, 1 } }, true)
            path:step({ s = { {}, 1 } }, true)
            path:step({ s = { {}, 1 } })
            assert.same({
                { { "r" }, { "s" } },
                { { "s" }, { "s", 1 } },
                { { "s", 1 }, { "s" } },
                { { "s" }, { "s", 2 } },
                { { "s", 2 }, { "s", 2 } },
                { { "s", 2 }, { "s" } },
            }, history)
        end)
    end)
end)
