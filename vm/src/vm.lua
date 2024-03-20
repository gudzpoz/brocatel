local TablePath = require("table_path")
local StackedEnv = require("stacked_env")
local history = require("history")
local lookup = require("lookup")
local savedata = require("savedata")

--- The brocatel module, containing the core brocatel.VM implementation.
---
--- @see VM
local brocatel = {}
brocatel.StackedEnv = StackedEnv
brocatel.TablePath = TablePath

--- The brocatel runtime VM.
---
--- @class VM
--- @field code table<string, table> the compiled brocatel scripts
--- @field env StackedEnv the environment handle
--- @field savedata SaveData save data
--- @field flags table inner api for data storage, cleaned on each `next` call
--- @field gettext Gettext GNU Gettext config
local VM = {}
brocatel.VM = VM
VM.__index = VM
VM.version = 1
VM.set_up_env_api = require("env_api")

--- Creates a VM from compiled brocatel scripts, in brocatel runtime format.
---
--- @param compiled_chunk table<string, table> the loaded chunk
--- @param env StackedEnv the environment used to load the chunk
--- @return VM vm the created VM
function VM.new(compiled_chunk, env)
    local meta = compiled_chunk[""]
    assert(meta, "the compiled chunk must contain a meta node")
    assert(meta.entry and meta.version, "invalid meta node for the compiled chunk")
    --- @type VM
    local vm = {
        code = compiled_chunk,
        env = env,
        flags = {},
        gettext = {},
        savedata = savedata.init(assert(compiled_chunk[""], "invalidate runtime format")),
    }
    setmetatable(vm, VM)
    vm:init()
    return vm
end

--- Initializes the VM state.
function VM:init()
    if self.savedata.version > VM.version then
        error("library version outdated")
    end
    -- Re-attaches type info (TablePaths stored as plain table in savedata).
    for _, thread in pairs(self.savedata.threads) do
        for _, co in ipairs(thread.coroutines) do
            co.ip = TablePath.from(co.ip)
            if co.prev_ip then
                co.prev_ip = TablePath.from(co.prev_ip)
            end
            co.ip:set_listener(function(old, new)
                assert(self:ensure_root(new), "invalid ip assigned")
                local current_co = assert(self:get_coroutine())
                history.record_simple(self.savedata.stats, self.code, current_co.prev_ip, old)
                current_co.prev_ip = old:copy()
            end)
        end
    end
    self:set_up_env_api()
    self.env:set_global_scope(self.savedata.globals)
    self.env:set_label_lookup(function(keys)
        return self:lookup_label(keys)
    end)
    self.env:set_init(false)
    local ip = assert(self:get_coroutine()).ip
    local root = assert(self:ensure_root(ip))
    ip:step(root, true)
    self:set_env()
end

--- Fetches the root, ensuring existence of the specified root node.
---
--- @param name string|TablePath|nil the root node name
--- @return table<string, Element>|nil root the root node
function VM:ensure_root(name)
    if type(name) == "table" then
        assert(#name >= 1, "not a valid TablePath")
        name = name[1]
    elseif not name then
        return self:ensure_root(self:get_coroutine().ip)
    end
    local root = self.code[name]
    if not root then
        return nil
    end
    if type(root) == "table" then
        return self.code
    end
    if type(root) == "function" then
        self.env:set_init(true)
        self.code[name] = root()
        self.env:set_init(false)
        return self:ensure_root(name)
    end
    error("expecting a table or a function")
end

--- @param values table
--- @return table keys
function VM.get_keys(values)
    local keys = {}
    for key, _ in pairs(values) do
        keys[key] = true
    end
    return keys
end


--- Calls a function with the supplied environment pushed into the stacked env.
---
--- It simply executes `push(env); result = func(...); pop()` and returns the result.
--- However, the actual environment of the function is not changed, which means
--- it should already bind to vm.env.env to make the environment change effective.
--- @param env table|nil
--- @param func function
function VM:call_with_env(env, func, ...)
    env = env or {}
    self.env:push(self.get_keys(env), env)
    local result = { func(...) }
    self.env:pop()
    ---@diagnostic disable-next-line: deprecated
    return (unpack or table.unpack)(result)
end

--- Evaluates a node at the supplied pointer with the environment pushed.
---
--- It yields values just like `next`, unless any `if-else` statement yields false,
--- when it will return nil instead.
--- @param env table|nil
--- @param ip TablePath
--- @param env_keys table|nil
function VM:eval_with_env(env, ip, env_keys)
    ip:step(assert(self:ensure_root(ip)), true)
    env = env or {}
    env_keys = env_keys or self.get_keys(env)
    self.env:push(env_keys, env)
    while true do
        local line, tags = self:fetch_and_next(ip)
        if line or not tags or self.flags["if-else"] == false or self.flags["empty"] then
            self.env:pop()
            return line, tags
        end
    end
end

--- @class Gettext
--- @field gettext nil | fun(msgid: string):string
--- @field ngettext nil | fun(msgid: string, count: number):string

--- Configures the gettext functionality.
---
--- Although GNU Gettext requires `msgid-plural` for ngettext,
--- you don't always write your plots in languages with a plural form
--- (nor have we a way to write this in Markdown in a neat way).
--- If you are wrapping gettext library calls and using PO fields
--- generated by our `lgettext`, you can just pass an empty string as
--- `msgid-plural`.
---
--- @param gettext fun(msgid: string):string
--- @param ngettext fun(msgid: string, count: number):string
function VM:set_gettext(gettext, ngettext)
    assert(gettext)
    assert(ngettext)
    self.gettext.gettext = gettext
    self.gettext.ngettext = ngettext
end

--- @class Thread
--- @field current_coroutine number
--- @field coroutines table<number, Coroutine>
--- @field thread_locals table

--- Fetches a thread by name.
---
--- @param thread_name string|nil the thread name
--- @return Thread thread
function VM:get_thread(thread_name)
    if not thread_name then
        thread_name = self.savedata.current_thread
    end
    return self.savedata.threads[thread_name]
end

--- @class Coroutine
--- @field ip TablePath
--- @field prev_ip TablePath|nil
--- @field locals table
--- @field stack table

--- @class SaveData
--- @field version number
--- @field current_thread string
--- @field threads table<string, Thread>
--- @field stats table
--- @field globals table<string, any>
--- @field current IOCache

--- @class IOCache
--- @field input number|nil
--- @field output any

--- Fetches a coroutine by thread name and id.
---
--- @param thread_name string|nil the thread name
--- @param coroutine_id number|nil the coroutine id
--- @return Coroutine|nil co
function VM:get_coroutine(thread_name, coroutine_id)
    local thread = self:get_thread(thread_name)
    if not thread then
        return nil
    end
    if not coroutine_id then
        coroutine_id = thread.current_coroutine
    end
    return thread.coroutines[coroutine_id]
end

--- @param params table the parameters
--- @param ip TablePath the return address
function VM:push_stack_frame(params, ip)
    local co = assert(self:get_coroutine())
    local keys = self.get_keys(params)
    co.stack[#co.stack + 1] = {
        keys = keys,
        values = params,
        ret = ip:copy(),
    }
    self.env:push(keys, params)
end

--- @return boolean success false if no function call in stack
function VM:pop_stack_frame()
    local co = assert(self:get_coroutine())
    if #co.stack == 0 then
        return false
    end
    local ip = TablePath.from(co.stack[#co.stack].ret)
    co.stack[#co.stack] = nil
    self.env:pop()
    local root = assert(self:ensure_root(ip))
    ip:step(root)
    co.ip:set(ip)
    return true
end

--- Yields the next line.
---
---@param input number|nil
function VM:next(input)
    local current = self.savedata.current
    if input then
        current.input = input
    end
    current.output = nil
    return self:current()
end

--- Returns the current line.
function VM:current()
    local current = self.savedata.current
    local output = current.output
    if output then
        return output
    end

    while true do
        local line, tags = self:fetch_and_next()
        if not tags then
            return nil
        end
        if line then
            output = { text = line, tags = tags }
            current.output = output
        end
        output = current.output
        if output then
            return output
        end
    end
end

--- Returns the current node and goes to the next.
---
--- For normal users, use `VM.next` instead.
---
--- Returns:
--- - `nil, nil` when the tree reaches the end,
--- - `line, true` on a line without tags,
--- - `line, tags` on a tagged line,
--- - `nil, true` when the caller should call again to fetch the next line.
---
--- @param ip TablePath|nil the pointer
--- @return string|table|nil result
--- @return table<string, string>|boolean|nil tags `nil` if reaches the end
function VM:fetch_and_next(ip)
    ip = ip or assert(self:get_coroutine()).ip
    local root = assert(self:ensure_root(ip))
    if ip:is_done() then
        return nil, nil
    end

    self.flags = {}

    local node = assert(ip:get(root))
    local node_type = VM.node_type(node)

    if node_type == "text" and type(node) == "string" then
        ip:step(root)
        return self:translate(node), true
    elseif node_type == "tagged_text" then
        local values = node.values
        local computed = {}
        ip:step(root)
        if values then
            for k, v in pairs(values) do
                computed[k] = v()
            end
        end
        local text = node.text --- @type string
        local plural = node.plural
        local formatted = self:translate(text, plural and computed[plural] or nil)
        for key, value in pairs(computed) do
            -- The key should be a valid Lua identifier and need no regex-escaping.
            formatted = string.gsub(formatted, "{" .. key .. "}", tostring(value))
        end
        return formatted, node.tags or true
    elseif node_type == "link" then
        local new_root_name = node.root
        if new_root_name then
            assert(self:ensure_root(new_root_name))
        end
        local found = lookup.find_by_labels(root, new_root_name or ip, node.link)
        assert(#found == 1, "not found / found too many: " .. tostring(#found))
        if node.params then
            local is_array, target = found[1]:is_array(root)
            if is_array and target and target[1].routine then
                local params = type(node.params) == "function" and node.params() or {}
                self:push_stack_frame(params, ip)
            end
        end
        ip:set(found[1])
        ip:step(root, true)
        return nil, true
    elseif node_type == "if-else" then
        local result = node[1]()
        local _
        _, self.flags["empty"] = ip:resolve(result and 2 or 3):step(root, true)
        self.flags["if-else"] = result and true or false
        return nil, true
    elseif node_type == "func" then
        local args = ip:copy():resolve("args")
        ip:step(root)
        node.func(args)
        if not ip:is_done() then
            ip:step(assert(self:ensure_root(ip)), true)
        end
        return nil, true
    end
    error("not implemented")
end

--- Returns "text", "tagged_text", "func", "if-else", "select" or "link" depending on the node type.
---
--- @param node Node
function VM.node_type(node)
    local t = type(node)
    if t == "string" then
        return "text"
    elseif t == "table" then
        if node.text then
            return "tagged_text"
        elseif node.func then
            return "func"
        elseif node.select then
            return "select"
        elseif node.link then
            return "link"
        elseif type(node[1]) == "function" then
            return "if-else"
        end
        -- Arrays are internal structures and we just throw an error here.
    end
    error("unexpected node")
end

--- Translates a message if a gettext backend is configured.
---
--- @param msgid string the message
---@param count number|nil the plural
function VM:translate(msgid, count)
    local gettext = self.gettext
    if not gettext.gettext then
        return msgid
    end
    if count == nil then
        return gettext.gettext(msgid)
    else
        return gettext.ngettext(msgid, count)
    end
end

--- Looks up a label relative to the current IP.
---
--- @param keys table relative label path
--- @return TablePath|nil
--- @return any
function VM:lookup_label(keys)
    local results = lookup.deep_lookup(assert(self:get_coroutine()).ip, keys, self.code)
    if #results == 0 and self.code[keys[1]] then
        local root = keys[1]
        if self:ensure_root(root) then
            local path = {}
            for i = 2, #keys do
                path[i - 1] = keys[i]
            end
            results = lookup.deep_lookup(TablePath.from({ root }), path, self.code)
        end
    end
    if #results == 0 then
        return nil
    end
    return results[1], results[1]:get(self.code)
end

--- @return table incorrect incorrect link nodes
function VM:validate_links()
    local incorrect = {}
    for root_name, _ in pairs(self.code) do
        if root_name ~= "" then
            self:ensure_root(root_name)
            local path = TablePath.from({ root_name })
            while true do
                local node = path:get(self.code)
                if type(node) == "nil" then
                    path:resolve(nil)
                    while #path > 1 and type(path[#path]) == "string" do
                        path:resolve(nil)
                    end
                elseif type(node) == "table" then
                    if #node > 0 then
                        path:resolve(0)
                    elseif node.args then
                        path:resolve("args", 0)
                    elseif node.select then
                        path:resolve("select", 0)
                    elseif node.link then
                        local parent = assert(path:get(self.code, 1))
                        local debug_info = parent[1] and parent[1].debug or {}
                        local new_root_name = node.root
                        if new_root_name then
                            assert(self:ensure_root(new_root_name))
                        end
                        local found = lookup.find_by_labels(self.code, new_root_name or path, node.link)
                        if #found ~= 1 then
                            local position = debug_info[path[#path]]
                            if type(position) ~= "nil" then
                                local i = path[#path]
                                while position == "" do
                                    i = i - 1
                                    position = debug_info[i]
                                end
                            end
                            incorrect[#incorrect + 1] = {
                                node = node,
                                root = root_name,
                                source = position,
                            }
                        end
                    end
                end
                if path:is_done() then
                    break
                end
                path[#path] = path[#path] + 1
            end
        end
    end
    return incorrect
end

--- Sets the environment up.
function VM:set_env()
    self.env:clear()
    self.env:push(self:get_thread().thread_locals.keys, self:get_thread().thread_locals.values)
    local co = assert(self:get_coroutine())
    self.env:push(co.locals.keys, self:get_coroutine().locals.values)
    for _, frame in ipairs(co.stack) do
        self.env:push(frame.keys, frame.values)
    end
end

function VM:save()
    return savedata.save(self.savedata)
end

function VM:load(s)
    self.savedata = savedata.load(s)
    self:init()
end

--- @param t table
--- @return table copy
local function shallow_copy(t)
    local copy = {}
    for key, value in pairs(t) do
        copy[key] = value
    end
    return copy
end

--- @param content string the compile brocatel chunk
--- @param save string|nil the savedata content
--- @param extra_env table|nil extra Lua environment globals (only `extern`, `print` and `require` permitted)
--- @return VM vm
function brocatel.load_vm(content, save, extra_env)
    local env = StackedEnv.new()
    if not extra_env then
        extra_env = {}
    end
    env:set_lua_env({
        assert = assert,
        error = error,
        ipairs = ipairs,
        next = next,
        pairs = pairs,
        select = select,
        ---@diagnostic disable-next-line: deprecated
        unpack = unpack,
        pcall = pcall,
        xpcall = xpcall,
        tonumber = tonumber,
        tostring = tonumber,
        type = type,
        print = extra_env.print,
        require = extra_env.require,
        extern = extra_env.extern,

        os = { time = os.time },
        math = shallow_copy(math),
        string = shallow_copy(string),
        table = shallow_copy(table),
    })
    local chunk = savedata.load_with_env(env.env, content)()
    local vm = VM.new(chunk, env)
    if save then
        vm:load(save)
    end
    return vm
end

return brocatel
