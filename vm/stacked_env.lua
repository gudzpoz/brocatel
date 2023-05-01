--- An environment table that supports scoped lookups with stacked tables.
---
--- File-local scopes are not supported yet.
---
--- @class StackedEnv
--- @field lua table the Lua environment
--- @field global table the global scope
--- @field label fun(table):table label lookup function
--- @field stack table some normal scopes that pose no requirements
--- @field env table the environment to be used
--- @field init boolean whether in initialing state
local StackedEnv = {}
StackedEnv.__index = StackedEnv

--- Constructs a new environment controller.
---
--- @return StackedEnv
function StackedEnv.new()
    local stacked = {
        lua = {},
        global = {},
        label = nil,
        stack = {},
        env = {},
        init = true,
    }
    setmetatable(stacked, StackedEnv)
    setmetatable(stacked.env, {
        __index = function(_, key)
            return stacked:get(key)
        end,
        __newindex = function(_, key, value)
            stacked:set(key, value)
        end
    })
    return stacked
end

--- @param init boolean initialing state
function StackedEnv:set_init(init)
    self.init = init
end

--- @return table env the Lua environment
function StackedEnv:get_lua_env()
    return self.lua
end

--- @param env table the Lua environment
function StackedEnv:set_lua_env(env)
    self.lua = env
end

--- @param global table the global scope
function StackedEnv:set_global_scope(global)
    self.global = global
end

--- @param label function the label lookup function
function StackedEnv:set_label_lookup(label)
    self.label = label
end

--- @param scope table a table with `keys` and `values` fields
function StackedEnv:push(scope)
    local stack = self.stack
    stack[#stack + 1] = scope
end

--- Clears all normal scopes in the environment.
function StackedEnv:clear()
    local stack = self.stack
    for i = #stack, 1, -1 do
        stack[i] = nil
    end
end

--- @param scope table
--- @param key any
local function get_with(scope, key)
    if scope.keys[key] then
        return scope.values[key], true
    end
    return nil, false
end

--- @param scope table
--- @param key any
--- @param value any
local function set_with(scope, key, value)
    if scope.keys[key] then
        scope.values[key] = value
        return true
    end
    return false
end

local LABEL_PATH_INDEX = {}
local LABELER_INDEX = {}
local Label = {}
function Label.new(path, labeler)
    local label = labeler(path)
    if not label then
        return nil
    end
    rawset(label, LABEL_PATH_INDEX, path)
    rawset(label, LABELER_INDEX, labeler)
    setmetatable(label, Label)
    return label
end
function Label:__index(key)
    local path = {}
    for i, v in ipairs(rawget(self, LABEL_PATH_INDEX)) do
        path[i] = v
    end
    path[#path + 1] = key
    local labeler = rawget(self, LABELER_INDEX)
    return Label.new(path, labeler)
end
function Label.__newindex()
    error("writing to a label value is not supported")
end

--- Does a scoped search.
---
--- @param key any the key to look up
function StackedEnv:get(key)
    if self.init then
        return self.lua[key]
    end
    -- Function-locals and thread-locals.
    local stack = self.stack
    for i = #stack, 1, -1 do
        local scope = stack[i]
        local value, ok = get_with(scope, key)
        if ok then
            return value
        end
    end
    -- Labels.
    local label = Label.new({ key }, self.label)
    if label then
        return label
    end
    -- File-local: not implemented.
    -- Global.
    local value = self.global[key]
    if value ~= nil then
        return value
    end
    -- Lua.
    return self.lua[key]
end

function StackedEnv:set(key, value)
    if self.init then
        self.lua[key] = value
        return
    end
    -- Function-locals and thread-locals.
    local stack = self.stack
    for i = #stack, 1, -1 do
        local scope = stack[i]
        if set_with(scope, key, value) then
            return
        end
    end
    -- Labels.
    if self.label({ key }) then
        error("writing to a label value is not supported")
    end
    -- File-local: not implemented.
    -- Global.
    self.global[key] = value
    -- Lua scope is read-only when not initialing.
end

return StackedEnv
