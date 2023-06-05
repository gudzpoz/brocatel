local brocatel = require("brocatel")
local savedata = require("savedata")
local utils = require("spec.test_utils")
local StackedEnv = require("stacked_env")

describe("StackedEnv", function()
    it("without environment", function()
        assert.is_nil(StackedEnv.new():get(""))
    end)
    it("with lua environment by set_lua_env", function()
        local env = StackedEnv:new()
        local lua_env = { a = 1, type = type, assert = assert, print = print }
        assert.is_nil(env:get(""))
        env:set_lua_env(lua_env)
        assert.equals(1, env:get("a"))
        env:set("a", 2)
        assert.equals(2, lua_env["a"])
    end)
    it("with global environment by set_global_scope", function()
        local env = StackedEnv:new()
        local glob = {}
        env:set_global_scope(glob)
        env:set_init(false)
        env:set("b", 1)
        assert.equals(1, glob["b"])
        assert.equals(1, env:get("b"))
    end)
    it("with dynamic labels", function()
        local env = StackedEnv:new()
        env:set_label_lookup(function(s)
            if s[1] == "some" then
                return { 1 }
            end
        end)
        assert.is_nil(env:get("some"))
        env:set_init(false)
        assert.is_table(env:get("some"))
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
        assert.equals(1, env:get("a"))
        env:set("b", 1)
        -- Globals
        assert.equals(1, glob["b"])
        assert.is_nil(lua_env["b"])
        -- Writing to labels
        assert.is_false(pcall(function() env:set("some", 0) end))
        assert.is_false(pcall(function() env:get("some").other = 0 end))
        return env, lua_env, glob
    end
    it("with multiple environment", function()
        test_with_environments()
    end)
    it("with stacked environment", function()
        local env = test_with_environments()
        local t1 = { keys = { k1 = true, k2 = true }, values = { k1 = "ok" } }
        local t2 = { keys = { k1 = true }, values = {} }
        env:push(t1)
        env:push(t2)
        assert.is_nil(env:get("k1"))
        env:set("k1", 1)
        env:set("k2", 2)
        assert.equals("ok", t1.values.k1)
        assert.equals(2, t1.values.k2)
        assert.equals(1, t2.values.k1)
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
                    { link = {}, root_name = "file2" }
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
        assert.equals(3, lua_env["a"])
        local vm_with_env = brocatel.VM.new(chunk(), env)
        env:set_init(false)
        local results = utils.gather_til_end(vm_with_env)
        assert.same({ "Hello", "Hi", "End" }, results)
        vm_with_env:load(vm_with_env:save())
        assert.equals(3, lua_env["a"])
        vm_with_env:load(vm_with_env:save())
        assert.equals(7, vm_with_env.savedata.globals["a"])
    end)
end)
