local savedata = require("savedata")

--- @param func function
---@param layer number
local function foreach_index(func, layer)
    ---@diagnostic disable-next-line: deprecated
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

local function generate_complex_table()
    local complex = {}
    foreach_index(function(i, indices)
        local t = complex
        for _, index in ipairs(indices) do
            if not t[index] then
                t[index] = {}
            end
            t = t[index]
        end
        t[1] = i
    end, 5)
    return complex
end

--- @param table any
--- @param saved string|nil
--- @param loaded table|nil
local function test_save_load(table, saved, loaded)
    local s = savedata.save(table)
    if saved then
        assert.equal(saved, s)
    end
    if type(table) == "function" then
        assert.same(loaded, savedata.load(s))
    else
        assert.same(loaded or table, savedata.load(s))
    end
end

describe("Module savedata", function()
    it("saves simple values", function()
        test_save_load(nil, "return _\n")
        test_save_load(function() end, "return _\n", nil)

        test_save_load(0, "_=0\nreturn _\n")
        test_save_load(1, "_=1\nreturn _\n")
        test_save_load(0.5, "_=0.5\nreturn _\n")

        test_save_load(false, "_=false\nreturn _\n")
        test_save_load(true, "_=true\nreturn _\n")

        test_save_load("a", "_=\"a\"\nreturn _\n")

        test_save_load({}, "_={}\n_=_\nreturn _\n")
        test_save_load({ "array" }, "_={}\n_=_\n_[1]=\"array\"\nreturn _\n")
        test_save_load({ key = "value" }, "_={}\n_=_\n_[\"key\"]=\"value\"\nreturn _\n")
    end)

    it("saves no invalid keys or values", function()
        test_save_load({ [{}] = {} }, "_={}\n_=_\nreturn _\n", {})
        test_save_load({ func = function() end }, "_={}\n_=_\nreturn _\n", {})
        test_save_load({ { function() end } }, "_={}\n_=_\n_b={}\n_[1]=_b\nreturn _\n", { {} })
    end)

    it("saves and loads large table", function()
        test_save_load(generate_complex_table())
    end)

    it("loads with environment", function()
        assert.equal("helloworld", savedata.load_with_env({ a = "hello" }, "return a .. 'world'")())
        assert.error(function() savedata.load("return assert({})") end)
        assert.no_error(function() savedata.load_with_env({ assert = assert }, "return assert({})") end)
    end)
end)
