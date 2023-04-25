local TablePath = require("table_path")

--- The brocatel module, containing the core brocatel.VM implementation.
--- @module brocatel
--- @see VM
local brocatel = {}

--- The brocatel runtime VM.
--- @class VM
--- @field code table the compiled brocatel scripts
--- @field save table save data
local VM = {}
brocatel.VM = VM
VM.__index = VM
VM.version = 1

--- Creates a VM from compiled brocatel scripts, in brocatel runtime format.
---
--- @param compiled_chunk table
--- @return VM
function VM.new(compiled_chunk)
    local vm = {
        code = compiled_chunk,
    }
    setmetatable(vm, VM)
    vm:init()
    return vm
end

--- Fetches a root node of the specified name
--- @param name string the root name
function VM:get_root(name)
    local root = self.code[name]
    if type(root) == "table" then
        return root
    end
    if type(root) == "function" then
        self.code[name] = root()
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
    self.save = {
        version = meta.version,
        current_thread = "",
        threads = {
            [""] = {
                current_coroutine = 1,
                coroutines = {
                    {
                        ip = ip,
                        root_name = meta.entry,
                        locals = {},
                        stack = {},
                    },
                },
                thread_locals = {},
            },
        },
        labels = {},
        globals = {},
    }
end

--- @param thread_name string|nil the thread name
--- @param coroutine_id number|nil the coroutine id
function VM:get_coroutine(thread_name, coroutine_id)
    if not thread_name then
        thread_name = self.save.current_thread
    end
    local thread = self.save.threads[thread_name]
    if not thread then
        return nil
    end
    if not coroutine_id then
        coroutine_id = thread.current_coroutine
    end
    return thread.coroutines[coroutine_id]
end

--- Yields the next line.
function VM:next(input)
    while true do
        local line, tags = self:fetch_next_node(input)
        input = nil
        if line or not tags then
            return line, tags
        end
    end
end

--- Returns the next node of text.
---
--- For normal users, use `VM.next` instead.
---
--- Returns:
--- - `nil, nil` when the tree reaches the end,
--- - `line, nil` on a line without tags,
--- - `line, tags` on a tagged line,
--- - `nil, true` when the caller should call again to fetch the next line.
---
--- @param input number|nil user-selected option index
--- @return string|table|nil,table|boolean|nil
function VM:fetch_next_node(input)
    if input then
        error("not implemented")
    end
    local co = self:get_coroutine()
    local root = self:get_root(co.root_name)
    --- @type TablePath
    local ip = co.ip
    if ip:is_done() then
        return nil, nil
    end

    local node = ip:get(root)
    ip:step(root)
    local node_type = self:node_type(node)

    if node_type == "text" then
        return node, true
    else
        return nil, true
    end
end

--- Returns "text", "tagged_text", "func", "if-else", "select" or "link" depending on the node type.
---
--- @param node any
function VM:node_type(node)
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

return brocatel
