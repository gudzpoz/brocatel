local TablePath = require("table_path")
local history = require("history")

--- Sets up the runtime API.
---@param self VM
return function (self)
    local env = self.env
    local ip = assert(self:get_coroutine()).ip
    local lua = env:get_lua_env()
    lua.IP = ip
    lua.VM = self

    env:set_api("GET", function(path, key)
        path = self.env.is_label(path) and assert(self:lookup_label(path)) or path
        return history.get(self.savedata.stats, path, key)
    end)
    env:set_api("SET", function(path, key, value)
        if type(key) == "string" and #key == 1 then
            local char = key:byte(1)
            if 65 <= char and char <= 90 then
                error("key A-Z reserved")
            end
        end
        path = self.env.is_label(path) and assert(self:lookup_label(path)) or path
        history.set(self.savedata.stats, assert(self:ensure_root(path)), path, key, value)
    end)

    env:set_api("END", function(path)
        local IP = assert(env:get("IP"))
        -- For calls like `END()` or `END(true)`
        if not path or type(path) == "boolean" then
            -- Tries to return to the calling subroutine.
            if not path and self:pop_stack_frame() then
                return
            end
            -- Otherwise (or when `END(true)` is called), terminates the story execution.
            IP:set(TablePath.from({ IP[1] }))
            return
        end
        -- For calls like `END({ "label", "path_name" })`, it breaks that array (which is probably a loop or something).
        path = self.env.is_label(path) and assert(self:lookup_label(path)) or path
        assert(path:is_parent_to(IP))
        local root = assert(self:ensure_root(path))
        path = path:copy()
        path:step(root)
        IP:set(path)
    end)

    env:set_api("EVAL", function(path, extra_env)
        extra_env = extra_env or {}
        path = self.env.is_label(path) and assert(self:lookup_label(path)) or path
        return self:eval_with_env(extra_env, path)
    end)

    --- @param path table|TablePath
    local function visits(path)
        path = self.env.is_label(path) and assert(self:lookup_label(path)) or path
        return history.get(self.savedata.stats, path, "I") or 0
    end
    env:set_api("VISITS", visits)
    env:set_api("VISITED", function(path) return visits(path) > 0 end)

    --- @param args TablePath
    --- @param recur number|boolean
    local function user_select(args, recur)
        local current = self.savedata.current
        local counts = history.get(self.savedata.stats, args, "S") or {}
        local root = assert(self:ensure_root(args))
        if current.input then
            env:get("IP"):set(args:copy():resolve(current.input, 3))
            local count = counts[current.input] or 0
            count = count + 1
            counts[current.input] = count
            history.set(self.savedata.stats, root, args, "S", counts)
            current.input = nil
            return
        end

        env:get("IP"):set(args:copy():resolve(nil))
        recur = recur or 0
        assert(recur == true or recur >= 0)
        local selectables = {} --- @type Selectable[]
        local options = args:get(root)
        for i = 2, #options do
            local count = counts[i] or 0
            local local_env = {
                CHOICE_COUNT = #selectables,
                DEFAULT = #selectables == 0,
                COUNT = count,
                ONCE = count == 0,
                RECUR = function(n)
                    return count <= n
                end,
            }
            local inner = local_env
            local should_recur = recur == true or count <= recur
            if not should_recur then
                local_env = {}
                setmetatable(local_env, {
                    __index = function(_, key)
                        if key == "RECUR" then
                            should_recur = true
                        end
                        return inner[key]
                    end
                })
            end
            local line, tags = self:eval_with_env(local_env, args:copy():resolve(i), self.get_keys(inner))
            if line and should_recur and tags then
                selectables[#selectables + 1] = {
                    option = { text = line, tags = tags },
                    key = i,
                }
            end
        end
        if #selectables == 0 then
            ip:step(root)
            return nil, true
        end
        current.output = { select = selectables, tags = true }
    end
    env:set_api("FUNC", {
        SELECT = user_select,
        S_ONCE = function(args)
            user_select(args, 0)
        end,
        S_RECUR = function(args)
            user_select(args, true)
        end
    })
end