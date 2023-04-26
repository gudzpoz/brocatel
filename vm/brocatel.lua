local TablePath = require("table_path")
local StackedEnv = require("stacked_env")

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
--- @field save table save data
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
    --- @type VM
    local vm = {
        code = compiled_chunk,
        env = env,
    }
    setmetatable(vm, VM)
    vm:init()
    return vm
end

--- Fetches a root node of the specified name
---
--- @param name string the root name
--- @return table root the root node
function VM:get_root(name)
    local root = self.code[name]
    if type(root) == "table" then
        return root
    end
    if type(root) == "function" then
        self.env:set_init(true)
        self.code[name] = root()
        self.env:set_init(false)
        return self:get_root(name)
    end
    error("expecting a table or a function")
end

--- Initializes the VM state.
function VM:init()
    if self.save then
        return
    end
    local meta = self:get_root("")
    if meta.version > VM.version then
        error("library version outdated")
    end
    local root = self:get_root(meta.entry)
    local ip = TablePath.new()
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
                        root_name = meta.entry,
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
    self.save = save
    self.env:set_global_scope(save.globals)
    self.env:set_label_lookup(function(keys) return self:lookup_label(keys) end)
    self.env:set_init(false)
end

--- Looks up a label relative to the current IP.
---
---@param keys table relative label path
---@return TablePath|nil
function VM:lookup_label(keys)
    -- TODO: Relative lookups.
    return self.save.labels[keys[1]]
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
        thread_name = self.save.current_thread
    end
    return self.save.threads[thread_name]
end

--- @class Coroutine
--- @field ip TablePath
--- @field root_name string
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
---@return boolean|table|nil
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
--- @return string|table|nil result
--- @return table|boolean|nil tags `nil` if reaches the end
function VM:fetch_and_next(input)
    if input then
        error("not implemented")
    end
    local co = assert(self:get_coroutine())
    local root = self:get_root(co.root_name)
    --- @type TablePath
    local ip = co.ip
    if ip:is_done() then
        return nil, nil
    end

    local node = assert(ip:get(root))
    local node_type = VM.node_type(node)

    if node_type == "text" then
        ip:step(root)
        return node, true
    elseif node_type == "link" then
        ip:set(node.link)
        local new_root_name = node.root_name
        if new_root_name then
            co.root_name = new_root_name
            root = self:get_root(new_root_name)
        end
        ip:step(root, true)
        return nil, true
    elseif node_type == "if-else" then
        self:set_env()
        ip:resolve(node[1]() and 2 or 3):step(root, true)
        return nil, true
    else
        error("not implemented")
    end
end

--- Returns "text", "tagged_text", "func", "if-else", "select" or "link" depending on the node type.
---
--- @param node any
function VM.node_type(node)
    local t = type(node)
    if t == "string" then
        return "text"
    elseif t == "table" then
        t = node["type"]
        if t == "text" then
            return "tagged_text"
        elseif t == "func" or t == "select" or t == "link" then
            return t
        elseif type(node[1]) == "function" then
            return "if-else"
        end
        -- Arrays are internal structures and we just throw an error here.
    end
    error("unexpected node")
end

--- Computes a path to a node and the node itself by their labels.
---
--- The labels should be absolute and complete, that is, it should start from the root node
--- and never miss any label in between:
--- - Correct: `part_1.chapter_1.section_1.paragraph_1`,
--- - Incorrect: `part_1.section_1.paragraph_1`, even if there is only one `section_1` under `part_1`.
---
--- @return TablePath|nil,any
function VM:get_by_label(root_name, ...)
    if not root_name then
        root_name = self:get_coroutine().root_name
    end
    --- @type any
    local current = self:get_root(root_name)
    local path = TablePath.new()
    local labels = {...}
    for i = 1, #labels do
        local label = labels[i]
        if not TablePath.new():is_array(current) then
            return nil, nil
        end
        local relative = current[1].labels[label]
        -- I just don't want to require("table"), or else we can table.unpack.
        for j = 1, #relative do
            path:resolve(relative[j])
        end
        current = TablePath.from(relative):get(current)
    end
    return path, current
end

--- Sets the environment up.
function VM:set_env()
    self.env:clear()
    self.env:push(self:get_thread().thread_locals)
    self.env:push(self:get_coroutine().locals)
end

return brocatel
