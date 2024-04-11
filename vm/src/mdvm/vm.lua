local TablePath = require("mdvm.table_path")
local history = require("mdvm.history")
local lookup = require("mdvm.lookup")
local savedata = require("mdvm.savedata")
local utils = require("mdvm.utils")

--- The brocatel runtime VM.
---
--- Basic usage:
--- ++++++++++++
---
--- * Going through the story with :any:`brocatel.VM.next`
--- * Saving the VM state with :any:`brocatel.VM.save`
--- * Loading the VM state with :any:`brocatel.VM.load`
--- * Supplying a gettext implementation with :any:`brocatel.VM.set_gettext`
---
--- @class brocatel.VM
--- @field code table<string, table> the compiled brocatel scripts
--- @field env StackedEnv the environment handle
--- @field savedata SaveData save data
--- @field flags Flags inner api for data storage, cleaned on each `next` call
--- @field gettext Gettext GNU Gettext config
--- @field config Config the VM config
local VM = {}
VM.__index = VM
VM.version = 1
VM.set_up_env_api = require("mdvm.env_api")

--- Creates a VM from compiled brocatel scripts, in brocatel runtime format.
---
--- The compiled chunk is expected to have been loaded within the stacked environment.
---
--- @param compiled_chunk table<string, table> the loaded chunk
--- @param env StackedEnv the environment used to load the chunk
--- @return brocatel.VM vm the created VM
function VM._new(compiled_chunk, env)
    local meta = compiled_chunk[""]
    assert(meta, "the compiled chunk must contain a meta node")
    assert(meta.entry and meta.version, "invalid meta node for the compiled chunk")
    --- @type brocatel.VM
    local vm = {
        code = compiled_chunk,
        env = env,
        flags = {},
        gettext = {},
        savedata = savedata.init(assert(compiled_chunk[""], "invalidate runtime format")),
        config = {
            detect_too_many_jumps = 4096,
        },
    }
    setmetatable(vm, VM)
    vm:_init(true)
    return vm
end

--- @param co Coroutine
function VM:_set_up_listener(co)
    co.ip:set_listener(function(old, new)
        assert(self:_ensure_root(new), "invalid ip assigned")
        local current_co = assert(self:_get_coroutine())
        history.record_simple(self.savedata.stats, self.code, current_co.prev_ip, old)
        current_co.prev_ip = old:copy()
    end)
end

--- Initializes the VM state.
--- @param init_ip boolean whether to re-adjust the IP pointer (false if loading savedata)
function VM:_init(init_ip)
    if self.savedata.version > VM.version then
        error("library version outdated")
    end
    -- Re-attaches type info (TablePaths stored as plain table in savedata).
    for _, thread in pairs(self.savedata.threads) do
        for _, co in pairs(thread.coroutines) do
            co.ip = TablePath.from(co.ip)
            if co.prev_ip then
                co.prev_ip = TablePath.from(co.prev_ip)
            end
            self:_set_up_listener(co)
        end
    end
    self:set_up_env_api()
    self.env:set_global_scope(self.savedata.globals)
    self.env:set_label_lookup(function(keys)
        return self:lookup_label(keys)
    end)
    self.env:set_init(false)
    local ip = assert(self:_get_coroutine()).ip
    local root = assert(self:_ensure_root(ip))
    if init_ip then
        ip:step(root, true)
    end
    self:_set_env()
end

--- Fetches the root, ensuring existence of the specified root node.
---
--- @param name string|TablePath|nil the root node name
--- @return table<string, Element>|nil root the root node
function VM:_ensure_root(name)
    if type(name) == "table" then
        assert(#name >= 1, "not a valid TablePath")
        name = name[1]
    elseif not name then
        return self:_ensure_root(self:_get_coroutine().ip)
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
        return self:_ensure_root(name)
    end
    error("expecting a table or a function")
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
    self.env:push(utils.get_keys(env), env)
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
    ip:step(assert(self:_ensure_root(ip)), true)
    env = env or {}
    env_keys = env_keys or utils.get_keys(env)
    self.env:push(env_keys, env)
    while true do
        local line, tags = self:_fetch_and_next(ip)
        if line or not tags or self.flags["if-else"] == false or self.flags["empty"] then
            self.env:pop()
            return line, tags
        end
    end
end

--- @class Gettext
---
--- GNU gettext interface supplied by the user to offload translation to GNU gettext.
---
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
--- See also `gettext(3) <https://www.man7.org/linux/man-pages/man3/gettext.3.html>`_
--- and `ngettext(3) <https://www.man7.org/linux/man-pages/man3/ngettext.3.html>`_.
---
--- @param gettext fun(msgid: string):string see ``gettext(3)``
--- @param ngettext fun(msgid: string, count: number):string see ``ngettext(3)``
function VM:set_gettext(gettext, ngettext)
    assert(gettext)
    assert(ngettext)
    self.gettext.gettext = gettext
    self.gettext.ngettext = ngettext
end

--- @class Config
---
--- Runtime VM config.
---
--- @field detect_too_many_jumps number|nil whether to throw an error if the VM yields no text after too many jumps

--- Configures the VM.
---
--- The supplied config will be merged with the default config.
---
--- @param config Config the config
function VM:set_config(config)
    self.config = {}
    for k, v in pairs(config) do
        self.config[k] = v
    end
end

--- Fetches a thread by name.
---
--- @param thread_name string|nil the thread name
--- @return Thread|nil thread
function VM:_get_thread(thread_name)
    if not thread_name then
        thread_name = self.savedata.current_thread
    end
    return self.savedata.threads[thread_name]
end

--- Fetches a coroutine by thread name and id.
---
--- @param thread_name string|nil the thread name
--- @param coroutine_id number|nil the coroutine id
--- @return Coroutine|nil co
function VM:_get_coroutine(thread_name, coroutine_id)
    local thread = self:_get_thread(thread_name)
    if not thread then
        return nil
    end
    if not coroutine_id then
        coroutine_id = thread.current_coroutine
    end
    return thread.coroutines[coroutine_id]
end

--- @param params table coroutine-local variables
--- @param target TablePath the target routine
function VM:_set_up_coroutine(params, target)
    local thread = assert(self:_get_thread())
    local id = 1
    while thread.coroutines[id] do
        id = id + 1
    end
    local co = savedata.new_coroutine(target)
    thread.coroutines[id] = co
    for key, value in pairs(params) do
        co.locals.keys[key] = true
        co.locals.values[key] = value
    end
    local current = thread.current_coroutine
    self:_switch_coroutine(id)
    local ip = assert(self:_get_coroutine()).ip
    local root = assert(self:_ensure_root())
    self:_set_up_listener(co)
    ip:step(root, true)
    self:_switch_coroutine(current)
end

--- Performs a function call by pushing a new stack frame (with return address and params)
--- and jumping to the supplied ip.
---
--- @param params table the parameters
--- @param ip TablePath the return address
--- @param extra_keys string[] names of function local variables
function VM:push_stack_frame(params, ip, extra_keys)
    local co = assert(self:_get_coroutine())
    local keys = utils.get_keys(params)
    for _, key in ipairs(extra_keys) do
        keys[key] = true
    end
    co.stack[#co.stack + 1] = {
        keys = keys,
        values = params,
        ret = ip:copy(),
    }
    self.env:push(keys, params)
end

--- Pops a stack frame and jumps to the return address.
---
--- @return boolean success false if no function call in stack
function VM:pop_stack_frame()
    local co = assert(self:_get_coroutine())
    if #co.stack == 0 then
        return false
    end
    local ip = TablePath.from(co.stack[#co.stack].ret)
    co.stack[#co.stack] = nil
    self.env:pop()
    local root = assert(self:_ensure_root(ip))
    ip:step(root)
    co.ip:set(ip)
    return true
end

--- @param id number
function VM:_switch_coroutine(id)
    local thread = assert(self:_get_thread())
    thread.current_coroutine = id
    self:_set_env()
end

--- @return boolean success false if no other coroutine left
function VM:_kill_coroutine()
    local thread = assert(self:_get_thread())
    local another = nil --- @type number|nil
    for id, _ in pairs(thread.coroutines) do
        if id ~= thread.current_coroutine then
            another = id
        end
    end
    if type(another) == "nil" then
        return false
    end
    thread.coroutines[thread.current_coroutine] = nil
    self:_switch_coroutine(another)
    return true
end

--- Yields the next line.
---
--- @param input number|nil the input when the previous line is a list of options
--- @return Output|nil line the next line or nil if the story has ended
function VM:next(input)
    local current = self.savedata.current
    if input then
        current.input = input
    end
    current.output = nil
    return self:current()
end

--- Returns the current line.
---
--- @return Output|nil the current line or nil if the story has ended
function VM:current()
    local current = self.savedata.current
    local output = current.output
    if output then
        return output
    end

    while true do
        local line, tags = self:_fetch_and_next()
        if not tags then
            return nil
        end
        if line then
            output = { text = line, tags = tags }
            current.output = output
        end
        output = current.output
        local jump_limit = self.config.detect_too_many_jumps
        if output then
            self.flags["jumps"] = 0
            return output
        elseif jump_limit and self.flags["jumps"] > jump_limit then
            return error("no text yielded after " .. jump_limit .. " jumps")
        end
    end
end

--- Interpolates the text with the supplied values.
---
--- @param text string
--- @param values table<string, function>
--- @param translate boolean
--- @param plural string|nil
function VM:interpolate(text, values, translate, plural)
    local computed = {}
    if values then
        for k, v in pairs(values) do
            computed[k] = v()
        end
    end
    if translate then
        text = self:translate(text, plural and computed[plural] or nil)
    end
    for key, value in pairs(computed) do
        -- The key should be a valid Lua identifier and need no regex-escaping.
        text = string.gsub(text, "{" .. key .. "}", tostring(value))
    end
    return text
end

--- @class Flags
--- @field jumps number|nil
--- @field empty boolean|nil
--- @field if-else boolean|nil

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
--- @return string|nil result
--- @return table<string, string>|boolean|nil tags `nil` if reaches the end
function VM:_fetch_and_next(ip)
    ip = ip or assert(self:_get_coroutine()).ip
    local root = assert(self:_ensure_root(ip))
    if ip:is_done() then
        if self:_kill_coroutine() then
            return nil, true
        end
        return nil, nil
    end

    self.flags = {
        jumps = self.flags["jumps"] or 0,
    }

    local node = assert(ip:get(root))
    local node_type = VM._node_type(node)

    if node_type == "text" and type(node) == "string" then
        ip:step(root)
        return self:translate(node), true
    elseif node_type == "tagged_text" then
        ip:step(root)
        local formatted = self:interpolate(node.text, node.values, true, node.plural)
        local tags = {} --- @type table<string, string>
        for k, v in pairs(type(node.tags) == "table" and node.tags or {}) do
            if type(v) == "table" then
                tags[k] = self:interpolate(v.text, v.values, false)
            else
                tags[k] = tostring(v)
            end
        end
        return formatted, tags or true
    elseif node_type == "link" then
        local new_root_name = node.root
        if new_root_name then
            assert(self:_ensure_root(new_root_name))
        end
        local found = lookup.find_by_labels(root, new_root_name or ip, node.link)
        assert(#found == 1, "not found / found too many: " .. tostring(#found))
        if node.params then
            local is_array, target = found[1]:is_array(root)
            if is_array and target and target[1].routine then
                local params = type(node.params) == "function" and node.params() or {}
                if node.coroutine then
                    -- Coroutine call.
                    self:_set_up_coroutine(params, found[1])
                    ip:step(root)
                    found[1] = ip
                else
                    -- Function call.
                    self:push_stack_frame(params, ip, target[1].routine or {})
                end
            end
        end
        ip:set(found[1])
        ip:step(root, true)
        self.flags["jumps"] = self.flags["jumps"] + 1
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
            ip:step(assert(self:_ensure_root(ip)), true)
        end
        return nil, true
    end
    error("not implemented")
end

--- Returns "text", "tagged_text", "func", "if-else", or "link" depending on the node type.
---
--- @param node Node
function VM._node_type(node)
    local t = type(node)
    if t == "string" then
        return "text"
    elseif t == "table" then
        if node.text then
            return "tagged_text"
        elseif node.func then
            return "func"
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
--- @return Element|nil
function VM:lookup_label(keys)
    local results = lookup.deep_lookup(assert(self:_get_coroutine()).ip, keys, self.code)
    if #results == 0 and self.code[keys[1]] then
        local root = keys[1]
        if self:_ensure_root(root) then
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

--- Returns the debug information of the current IP or the supplied pointer.
---
--- @param ip TablePath|nil the pointer (defaults to the current IP)
--- @return InvalidNode info the current node info
function VM:ip_debug_info(ip)
    if not ip then
        ip = assert(self:_get_coroutine()).ip
    end
    local root = assert(self:_ensure_root(ip))
    local parent = assert(ip:get(root, 1))
    local node = assert(ip:get(root))
    local debug_info = parent[1] and parent[1].debug or {}
    local position = debug_info[ip[#ip]]
    if type(position) ~= "nil" then
        local i = ip[#ip]
        while position == "" do
            i = i - 1
            position = debug_info[i]
        end
    end
    return {
        node = node,
        root = ip[1],
        source = position,
    }
end

--- @class InvalidNode
--- @field node Node the invalid link node
--- @field root string the root name
--- @field source string|nil the source position

--- Checks if there is any invalid links.
---
--- The function is mainly called by the compiler to detect invalid links.
--- The users need not to check link validity themselves.
---
--- @return InvalidNode[] incorrect incorrect link nodes
function VM:validate_links()
    local incorrect = {} --- @type { node: Node, root: string, source: string|nil }[]
    for root_name, _ in pairs(self.code) do
        if root_name ~= "" then
            self:_ensure_root(root_name)
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
                    elseif node.link then
                        local new_root_name = node.root
                        local found = {}
                        if not new_root_name or self:_ensure_root(new_root_name) then
                            found = lookup.find_by_labels(self.code, new_root_name or path, node.link)
                        end
                        if #found ~= 1 then
                            incorrect[#incorrect + 1] = self:ip_debug_info(path)
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
function VM:_set_env()
    self.env:clear()
    self.env:push(self:_get_thread().thread_locals.keys, self:_get_thread().thread_locals.values)
    local co = assert(self:_get_coroutine())
    self.env:push(co.locals.keys, self:_get_coroutine().locals.values)
    for _, frame in ipairs(co.stack) do
        self.env:push(frame.keys, frame.values)
    end
end

--- Returns a string that can be loaded to restore the VM state.
---
--- Internally, the returned string is just a serialized Lua table,
--- without any obfuscation.
---
--- @return string state the VM state serialized to a string
function VM:save()
    return savedata.save(self.savedata)
end

--- Loads a string generated by `save()` to restore to a certain VM.
---
--- @param state string the VM state serialized to a string
function VM:load(state)
    self.savedata = savedata.load(state)
    self:_init(false)
end

return VM
