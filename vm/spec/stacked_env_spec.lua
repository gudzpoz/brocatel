local VM = require("mdvm.vm")
local savedata = require("mdvm.savedata")
local utils = require("spec.test_utils")
local StackedEnv = require("mdvm.stacked_env")

describe("StackedEnv", function()
    it("rejects setting non-table as environments", function()
        --- @diagnostic disable-next-line: param-type-mismatch
        assert.error(function() StackedEnv.new():set_lua_env(true) end)
        --- @diagnostic disable-next-line: param-type-mismatch
        assert.error(function() StackedEnv.new():set_global_scope(true) end)
    end)
    it("without environment", function()
        local env = StackedEnv.new()
        assert.is_nil(env:get(""))
        env:set_init(false)
        assert.is_nil(env:get(""))
    end)
    it("with lua environment by set_lua_env", function()
        local env = StackedEnv:new()
        local lua_env = { a = 1, type = type, assert = assert, print = print }
        assert.is_nil(env:get(""))
        env:set_lua_env(lua_env)
        assert.equal(1, env:get("a"))
        env:set("a", 2)
        assert.equal(2, lua_env["a"])
    end)
    it("with global environment by set_global_scope", function()
        local env = StackedEnv:new()
        local glob = {}
        env:set_global_scope(glob)
        env:set("b", 1)
        assert.is_nil(glob["b"])
        assert.equal(1, env:get_lua_env()["b"])
        env:set_init(false)
        env:set("b", 1)
        assert.equal(1, glob["b"])
        assert.equal(1, env:get("b"))
    end)
    it("with dynamic labels", function()
        local env = StackedEnv:new()
        env:set_label_lookup(function(s)
            if s[1] == "some" then
                return { 1 }
            elseif #s == 0 then
                return {}
            end
        end)
        assert.is_nil(env:get("some"))
        env:set_init(false)
        assert.is_table(env:get("some"))
        assert.same(env:get("some"), env:get("ROOT").some)
    end)
    it("rejects writing to api fields", function()
        local env = StackedEnv:new()
        assert.error(function() env:set("ROOT", "") end)
        env:set_init(false)
        assert.error(function() env:set("ROOT", "") end)
    end)

    local function test_with_environments()
        local env = StackedEnv:new()
        local lua_env = { a = 1, type = type, assert = assert, print = print }
        env:set_lua_env(lua_env)
        local glob = {}
        env:set_global_scope(glob)
        env:set_label_lookup(function(s)
            if s[1] == "some" then
                return { 1 }
            end
        end)
        env:set_init(false)

        -- Lua
        assert.equal(1, env:get("a"))
        env:set("b", 1)
        -- Globals
        assert.equal(1, glob["b"])
        assert.is_nil(lua_env["b"])
        -- Writing to labels
        assert.is_false(pcall(function() env:set("some", 0) end))
        assert.is_false(pcall(function() env:get("some").other = 0 end))
        return env, lua_env, glob
    end
    it("with multiple environment", function()
        test_with_environments()
    end)
    describe("with stacked environment", function()
        it("in a simple case", function()
            local env = StackedEnv.new()
            env:set_init(false)
            local t1 = { k1 = 1 }
            local t2 = {}
            env:push({ k1 = true }, t1)
            env:push({ k2 = true }, t2)
            assert.equal(1, env:get("k1"))
            assert.is_nil(env:get("k2"))
            env:set("k1", 2)
            env:set("k2", 3)
            assert.equal(2, env:get("k1"))
            assert.equal(2, t1["k1"])
            assert.equal(3, env:get("k2"))
            assert.equal(3, t2["k2"])
            env:push({ k1 = true, k3 = true }, { k3 = 3 })
            assert.is_nil(env:get("k1"))
            assert.equal(3, env:get("k3"))
            env:pop()
            assert.is_nil(env:get("k3"))
            assert.equal(2, env:get("k1"))
        end)
        it("in a normal env", function()
            local env = test_with_environments()
            local t1 = { k1 = "ok" }
            local t2 = {}
            env:push({ k1 = true, k2 = true }, t1)
            env:push({ k1 = true }, t2)
            assert.is_nil(env:get("k1"))
            env:set("k1", 1)
            env:set("k2", 2)
            assert.equal("ok", t1.k1)
            assert.equal(2, t1.k2)
            assert.equal(1, t2.k1)
        end)
    end)

    it("used in tree iteration", function()
        -- Env and if-else.
        local code = [[
            a = 3
            return {
                [""] = { version = 1, entry = "main" },
                main = {
                    { labels = { b = { 2 } }, label = "main" },
                    {
                        function()
                            a = a + 1
                            assert(type(main) == "table")
                            assert(#main == 1)
                            assert(not not_found)
                            return a > 6
                        end,
                        { {}, "Hello" },
                        { {}, { link = { "b" } } }
                    },
                    "Hi",
                    { link = {}, root = "file2" }
                },
                file2 = { {}, "End" },
            }
        ]]


        local env = StackedEnv:new()
        local lua_env = { assert = assert, type = type }
        local glob = {}
        env:set_lua_env(lua_env)
        env:set_global_scope(glob)
        local chunk = savedata.load_with_env(env.env, code)
        chunk()
        assert.equal(3, lua_env["a"])
        local vm_with_env = VM._new(chunk(), env)
        env:set_init(false)
        local results = utils.gather_til_end(vm_with_env)
        assert.same({ "Hello", "Hi", "End" }, results)
        vm_with_env:load(vm_with_env:save())
        assert.equal(3, lua_env["a"])
        vm_with_env:load(vm_with_env:save())
        assert.equal(7, vm_with_env.savedata.globals["a"])
    end)
end)
