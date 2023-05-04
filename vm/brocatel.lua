local TablePath = require("table_path")
local StackedEnv = require("stacked_env")
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
--- @field code table the compiled brocatel scripts
--- @field env StackedEnv the environment handle
--- @field savedata table save data
--- @field gettext Gettext GNU Gettext config
local VM = {}
brocatel.VM = VM
VM.__index = VM
VM.version = 1

--- Creates a VM from compiled brocatel scripts, in brocatel runtime format.
---
--- @param compiled_chunk table the loaded chunk
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
        gettext = {},
    }
    setmetatable(vm, VM)
    vm:init()
    return vm
end

--- Fetches the root, ensuring existence of the specified root node.
---
--- @param name string|TablePath|nil the root node name
--- @return table<string, Element>|nil root the root node
function VM:ensure_root(name)
    if type(name) == "table" then
        assert(#name >= 1)
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

--- Initializes the VM state.
function VM:init()
    if not self.savedata then
        local meta = assert(self:ensure_root(""))[""]  --- @type table
        local ip = TablePath.from({ meta.entry })
        local root = assert(self:ensure_root(ip))
        ip:step(root, true)
        local save = {
            version = meta.version,
            current_thread = "",
            threads = {
                [""] = {
                    current_coroutine = 1,
                    coroutines = {
                        {
                            ip = ip,
                            locals = { keys = {}, values = {} },
                            stack = {},
                        },
                    },
                    thread_locals = { keys = {}, values = {} },
                },
            },
            labels = {},
            globals = {},
        }
        self.savedata = save
    end
    if self.savedata.version > VM.version then
        error("library version outdated")
    end
    self.env:get_lua_env().ip = self:get_coroutine().ip
    self.env:set_global_scope(self.savedata.globals)
    self.env:set_label_lookup(function(keys) return self:lookup_label(keys) end)
    self.env:set_init(false)
end

--- @class Gettext
--- @field gettext fun(msgid: string):string
--- @field ngettext fun(msgid: string, count: number):string

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
--- @field coroutines table
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
--- @field locals table
--- @field stack table

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

--- Yields the next line.
---
---@param input number|nil
---@return string|table|nil
---@return boolean|string[]|nil
function VM:next(input)
    while true do
        local line, tags = self:fetch_and_next(input)
        input = nil
        if line or not tags then
            return line, tags
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
--- @param input number|nil user-selected option index
--- @param ip TablePath|nil the pointer
--- @return string|table|nil result
--- @return string[]|boolean|nil tags `nil` if reaches the end
function VM:fetch_and_next(input, ip)
    ip = ip or assert(self:get_coroutine()).ip
    local root = assert(self:ensure_root(ip))
    if ip:is_done() then
        return nil, nil
    end

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
            self:set_env()
            for k, v in pairs(values) do
                computed[k] = v()
            end
        end
        local text = node.text  --- @type string
        local plural = node.plural
        return self:translate(text, plural and computed[plural] or nil), node.tags or true
    elseif node_type == "link" then
        local new_root_name = node.root_name
        if new_root_name then
            assert(self:ensure_root(new_root_name))
            ip:set({ new_root_name })
        else
            ip:set({ ip[1] })
        end
        ip:resolve(node.link)
        ip:step(root, true)
        return nil, true
    elseif node_type == "if-else" then
        self:set_env()
        ip:resolve(node[1]() and 2 or 3):step(root, true)
        return nil, true
    elseif node_type == "func" then
        self:set_env()
        local args = ip:copy():resolve("args")
        ip:step(root)
        node.func(args)
        return nil, true
    elseif node_type == "select" then
        local select = node.select
        local base = ip:copy()
        if input then
            ip:resolve("select", input, 3):step(root, true)
            return nil, true
        end
        local selectables = {}
        local count = 0
        for i = 1, #select do
            local option_node = assert(ip:resolve("select", i, 2):get(root))
            if self.node_type(option_node) == "if-else" and #option_node <= 2 then
                self:set_env()
                ip:resolve(option_node[1]() and 2 or 3, 2)
                if ip:get(root) then
                    local line, tags = self:next()
                    selectables[i] = { line, tags }
                    count = count + 1
                end
            else
                local line, tags = self:next()
                selectables[i] = { line, tags }
                count = count + 1
            end
            ip:set(base)
        end
        if count == 0 then
            ip:step(root)
            return nil, true
        end
        return selectables, true
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
--- Returns a path to a node and the node itself by their labels.
---
--- The labels should be complete, that is, it should never miss any label in between:
--- - Correct: `part_1.chapter_1.section_1.paragraph_1`,
--- - Incorrect: `part_1.section_1.paragraph_1`, even if there is only one `section_1` under `part_1`.
---
--- @param labels table relative label path
--- @return TablePath|nil
--- @return any
function VM:lookup_label(labels)
    local ptr = assert(self:get_coroutine()).ip:copy()
    local root = assert(self:ensure_root(ptr))
    local first = labels[1]

    local not_found = false
    -- The first key, where the lookup will be relative to.
    while true do
        local is_array, node = ptr:is_array(root)
        if is_array then
            assert(node)
            local metadata = node[1]
            local label_table = metadata.labels
            if label_table and label_table[first] then
                break
            end
        end
        if ptr:is_done() then
            not_found = true
            break
        end
        -- Goes to parent nodes if not found.
        ptr:resolve(nil)
    end

    if not_found then
        if not self:ensure_root(labels[1]) then
            return nil
        end
        ptr = TablePath.from({ labels[1] })
    end

    for i = (not_found and 2 or 1), #labels do
        local label = labels[i]
        local is_array, current = ptr:is_array(root)
        if not is_array or not current then
            return nil
        end
        local relative = current[1].labels[label]
        if not relative then
            return nil
        end
        ptr:resolve(relative)
    end

    return ptr, ptr:get(root)
end

--- Sets the environment up.
function VM:set_env()
    self.env:clear()
    self.env:push(self:get_thread().thread_locals)
    self.env:push(self:get_coroutine().locals)
end

function VM:save()
    return savedata.save(self.savedata)
end

function VM:load(s)
    self.savedata = savedata.load(s)
    self:init()
end

--- @param content string the compile brocatel chunk
--- @param save string|nil the savedata content
--- @return VM vm
function brocatel.load_vm(content, save)
    local env = StackedEnv.new()
    env:set_lua_env(_G)
    local chunk = savedata.load_with_env(env.env, content)()
    local vm = VM.new(chunk, env)
    if save then
        VM:load(save)
    end
    return vm
end

return brocatel
