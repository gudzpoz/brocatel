local history = require("history")

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
                assert.same(i <= 31
                    and { 2 ^ (i <= 20 and 20 or i) - 1 }
                    or { 2 ^ 31 - 1, 2 ^ (i - 31) - 1 }, set)
            end
            for i = 1, 80 do
                assert.equals(i <= 40, history.get_bit(set, i))
            end
        end)
    end)
end)