local TablePath = require("table_path")

describe("TablePath", function()
    describe("creation", function()
        it("with arrays", function()
            assert.is_true(pcall(function() TablePath.from({ "root" }) end))
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
        end)

        it("with relatively resolved path", function()
            assert.equals("Hello", TablePath.from({ "r", 4, 2 }):resolve(nil, nil, 2, 2, 2):get(root))
        end)
    end)

    it("table iteration", function()
        local path = TablePath.from({ "r" })
        local results = {}
        path:step(root, true)
        repeat
            results[#results + 1] = path:get(root)
        until not path:step(root)
        -- Not actually a path, but we just use it to compare tables for convenience.
        assert.same({ "Hello", "Hi", "!" }, TablePath.from(results))
    end)
end)
