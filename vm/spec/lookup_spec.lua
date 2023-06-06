local lookup = require("lookup")
local TabelPath = require("table_path")

describe("Module labels", function()
    local root = {
        r = {
            { labels = { a = { 2 } } },
            {
                { labels = { a = { 2 }, e = { 3 } } },
                {
                    { labels = { b = { 2 } } },
                    {
                        { labels = { a = { 2 }, c = { 3 } } },
                        "",
                        {
                            { labels = { a = { 2 } } },
                            "",
                        }
                    }
                },
                {
                    { labels = { c = { 2 } } },
                    "",
                }
            }
        }
    }
    it("looks up direct labels", function()
        local results = lookup.direct_lookup(TabelPath.from({ "r", 2, 2, 2, 2 }), "a", root)
        assert.same({
            { "r", 2, 2, 2, 2 },
            { "r", 2, 2 },
            { "r", 2 },
        }, results)
        results = lookup.direct_lookup(TabelPath.from({ "r", 2, 2, 2, 2 }), "b", root)
        assert.same({
            { "r", 2, 2, 2 },
        }, results)
    end)
    it("looks up child labels", function()
        assert.same({}, lookup.child_lookup(TabelPath.from({ "r" }), "b", root, 0))
        assert.same({}, lookup.child_lookup(TabelPath.from({ "r" }), "b", root, 1))
        assert.same({}, lookup.child_lookup(TabelPath.from({ "r" }), "b", root, 2))
        assert.same({ { "r", 2, 2, 2 } }, lookup.child_lookup(TabelPath.from({ "r" }), "b", root, 3))
        assert.same({ { "r", 2, 2, 2 } }, lookup.child_lookup(TabelPath.from({ "r" }), "b", root, 4))
        local results = lookup.child_lookup(TabelPath.from({ "r" }), "c", {
            r = {
                { labels = { a = { 2 }, b = { 3 } } },
                { { labels = { c = { 2 } } },       "" },
                { { labels = { c = { 2 } } },       "" },
            }
        }, 2)
        assert.equals(2, #results)
        assert.equals(3, #results[1])
        -- Not necessarily in order
        if results[1][2] == 2 then
            assert.same({
                { "r", 2, 2 },
                { "r", 3, 2 },
            }, results)
        else
            assert.same({
                { "r", 3, 2 },
                { "r", 2, 2 },
            }, results)
        end
    end)
    it("looks up sibling labels", function()
        assert.same({ { "r", 2, 2, 2, 3 } }, lookup.sibling_lookup(TabelPath.from({ "r", 2, 2, 2, 2 }), "c", root, 2))
        assert.same({ { "r", 2, 2, 2, 3 } }, lookup.sibling_lookup(TabelPath.from({ "r", 2, 2, 2 }), "c", root, 2))
        assert.same({}, lookup.sibling_lookup(TabelPath.from({ "r", 2, 2, 2 }), "c", root, 1))
        assert.same({ { "r", 2, 3, 2 } }, lookup.sibling_lookup(TabelPath.from({ "r", 2, 2 }), "c", root, 2))
    end)
    it("looks up quite freely", function()
        assert.same({ { "r", 2, 3, 2 } }, lookup.deep_lookup(TabelPath.from({ "r", 2, 2, 2, 2 }), { "e", "c" }, root))
        assert.same({}, lookup.deep_lookup(TabelPath.from({ "r", 2, 2, 2, 2 }), { "e", "a" }, root))
    end)
    it("looks up within a root node", function()
        assert.same({}, lookup.find_by_labels(root, "s", { "a" }))
        assert.same({ { "r", 2 }}, lookup.find_by_labels(root, TabelPath.from({ "r" }), { "a" }))
    end)
    it("computes labels to a node", function()
        assert.same({ "r", "a", "b" }, lookup.get_path_labels(TabelPath.from({ "r", 2, 2 }), {
            r = {
                {},
                {
                    { label = "a" },
                    {
                        { label = "b" },
                    },
                },
            },
        }))
    end)
end)
