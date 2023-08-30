local history = require("history")
local TablePath = require("table_path")

describe("Module history", function()
    describe("uses bitsets", function()
        it("to store states", function()
            local set = {}
            for i = 1, 20 do
                history.set_bit(set, i)
                assert.same({ 2 ^ i - 1 }, set)
            end
            for i = 1, 40 do
                history.set_bit(set, i)
                assert.same(i <= 24
                    and { 2 ^ (i <= 20 and 20 or i) - 1 }
                    or { 2 ^ 24 - 1, 2 ^ (i - 24) - 1 }, set)
            end
            for i = 1, 80 do
                assert.equal(i <= 40, history.get_bit(set, i))
            end
        end)
    end)

    describe("allows saving custom data", function()
        it("bound to an array node", function()
            local root = { r = { {}, "A", "B" } }
            local save = {}
            local path = TablePath.from({ "r" })
            history.set(save, root, path, "k", "v")
            assert.same({ r = { { k = "v" } } }, save)
            assert.equal("v", history.get(save, path, "k"))
        end)
        it("to array nodes only, fails otherwise", function()
            local root = { r = { {}, "A", "B" } }
            local save = {}
            local path = TablePath.from({ "r", 2 })
            assert.error(function() history.set(save, root, path, "k", "v") end)
        end)
        it("bound to non-existent args node", function()
            local root = { r = { {}, "A", "B", { func = function() end } } }
            local save = {}
            local path = TablePath.from({ "r", 4, "args" })
            history.set(save, root, path, "k", "v")
            assert.same({ r = { [4] = { args = { { k = "v" } } } } }, save)
            assert.equal("v", history.get(save, path, "k"))
            path = TablePath.from({ "r", 3, "args" })
            assert.error(function() history.set(save, root, path, "k", "v") end)
        end)
    end)
end)
