local savedata = require("savedata")

--- @param func function
---@param layer number
local function foreach_index(func, layer)
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

describe("Module savedata", function()
    it("saves and loads large table", function ()
        local complex = generate_complex_table()
        assert.same(complex, savedata.load(savedata.save(complex)))
    end)
end)
