--- Simplified JSONPath for Lua tables.
---
--- It recognizes basic elements (only arrays for now) in the brocatel runtime format,
--- to allow easier navigation through the tree structure.
---
--- @class TablePath
local TablePath = {}
TablePath.__index = TablePath

--- @alias TablePathSeg string|number segment of a TablePath

--- @class Interpolatable
--- @field text string the text to interpolate
--- @field values table<string, function> the arguments to interpolate

--- @alias Array (Node|string)[]

--- @class Node
---
--- @field text string|nil text of a text node
--- @field tags table<string, string|Interpolatable>|nil tags of a text node
--- @field plural string|nil key of an interpolated value that is used to pluralize the text
--- @field values table<string, function>|nil interpolated values of a text node
---
--- @field func function|nil the function of a function node
--- @field args Array[]|nil the arguments of a function node
---
--- @field link TablePath|nil the destination labels of a link node
--- @field root string|nil the root node name of a link node
--- @field params function|boolean|nil the routine-call parameters of a link node
--- @field coroutine boolean|nil the coroutine flag of a link node
---
--- @field label string|nil the label of an array metadata node
--- @field labels table<string, TablePath>|nil the label lookup table in an array metadata node
--- @field routine string[]|nil the routine params of an array metadata node
--- @field debug string[]|nil the debug info of an array metadata node
---
--- @field I number|nil read counts in history stats for array nodes
--- @field R table<number, number>|nil read bitmap in history stats for text nodes

--- @alias Element Node|Array

--- Creates a path from an array.
---
--- The table is copied into the new path.
--- Listeners are not copied.
---
--- @param t TablePathSeg[]|TablePath the path
--- @return TablePath
function TablePath.from(t)
    assert(type(t) == "table", "expecting a table")
    assert(#t >= 1 and type(t[1]) == "string", "the first element must be a root node name")
    local copy = {}
    for i, v in ipairs(t) do
        copy[i] = v
    end
    setmetatable(copy, TablePath)
    return copy
end

--- Returns a copy of the current pointer.
---
--- @return TablePath
function TablePath:copy()
    return TablePath.from(self)
end

local LISTENER_KEY = {}

--- Sets the path change listener.
---
--- When the path is changed, it calls the listener, passing the new path and
--- the new path.
---
--- @param listener function|nil
function TablePath:set_listener(listener)
    rawset(self, LISTENER_KEY, listener)
end

--- Calls the change listener of the old path.
---
--- @param old TablePath
--- @param new TablePath
local function call_listener(old, new)
    local listener = rawget(old, LISTENER_KEY)
    if listener then
        listener(old, new)
    end
end

--- Sets the path in place.
---
--- @param t table|TablePath the new path
--- @return TablePath self
function TablePath:set(t)
    call_listener(self, TablePath.from(t))
    local n = #t
    while #self > n do
        self[#self] = nil
    end
    for i = 1, n do
        self[i] = t[i]
    end
    return self
end

--- Returns true if the two paths equal.
---
--- @param path table|TablePath the other path
--- @return boolean eq
function TablePath:equals(path)
    assert(type(path) == "table", "expecting a table")
    if #self ~= #path then
        return false
    end
    for i = 1, #self do
        if self[i] ~= path[i] then
            return false
        end
    end
    return true
end

--- Fetches the element of the table at the current path.
---
--- Sets the `parents` parameter to `1` to fetch the parent node instead,
--- or to `2` to fetch a grandparent node, etc.
---
--- @param t table
--- @param parents number|nil the levels to go up
--- @return Element|nil node
function TablePath:get(t, parents)
    assert(type(t) == "table", "expecting a table")
    if not parents then
        parents = 0
    end
    if parents > #self - 1 then
        return nil
    end
    for i = 1, #self - parents do
        if type(t) == "table" then
            t = t[self[i]]
        else
            return nil
        end
    end
    return t
end

--- Points the path to a new path relative to the current one.
---
--- Use `nil` as a parameter to "go up". Examples:
---
--- - `TablePath.new():resolve("a", b", 1)` points the path to `{"a", "b", 1}`.
--- - `TablePath.from({1, 1, 1}):resolve(nil, nil, 2)` points the path to `{1, 2}`.
---
--- @vararg table|string|number|nil the relative path
--- @return TablePath self the new current path, *not* a new one
function TablePath:resolve(...)
    local n = select("#", ...)
    local new = self:copy()
    local args = {...}
    for i = 1, n do
        local arg = args[i]
        if type(arg) == "table" then
            for _, v in ipairs(arg) do
                new:resolve(v)
            end
        elseif arg then
            new[#new + 1] = arg
        elseif #new > 1 then
            new[#new] = nil
        end
    end
    return self:set(new)
end

--- Returns true if the pointer is pointing to an brocatel array.
---
--- @param t table
--- @param parents number|nil
--- @return boolean is_array
--- @return Element|nil node
function TablePath:is_array(t, parents)
    local node = self:get(t, parents)
    if type(node) ~= "table" then
        return false, nil
    end
    return type(node[1]) == "table", node
end

--- @param path TablePath
--- @return boolean
function TablePath:is_parent_to(path)
    if #path <= #self then
        return false
    end
    for i, segment in ipairs(self) do
        if segment ~= path[i] then
            return false
        end
    end
    return true
end

--- Points the path to the next element.
---
--- The iteration follows the brocatel runtime format specification.
--- It repeats the following until it finds a valid "next element".
---
--- ## Procedure
---
--- (1). If the parent node of the current element is not an *array* node, go to that parent node and start over.
---
--- (2). If it is an *array* node:
---
--- (2.1). If the current element is the last child node, go to that parent node and start over from (1).
---
--- (2.2). If the current element is not the last child node, go to the next sibling and
---
--- (2.2.1). If we are now at an *non-array* node, then it is a valid "next element". *Returns*.
---
--- (2.2.2). If we are now at an *array* node and
---
--- (2.2.2.1). If its first element (excluding the metadata element) is `nil`, start over from (1).
---
--- (2.2.2.2). If its first element is an *array*, go there and start over from (2.2.2).
---
--- (2.2.2.3). If its first element is an *non-array* node, go there and we are done. *Returns*.
---
--- ## Details
---
--- It tells whether a Lua table node is an *array*, by looking at its first element.
--- An *array* expects a metadata element (a Lua table), while others never.
---
--- ## Usage
---
--- The function steps the pointer to the next valid element.
--- For a root node like `{{}, "A", "B"}`, a pointer `{2}` points to `"A"`.
--- And stepping the pointer makes it point to `"B"`.
---
--- However, you cannot step any pointer to point to the first valid element,
--- which is not "the next element" to any. In order to initialize a pointer
--- by letting it point to the first valid element, call `step` with its `init`
--- parameter set to `true` on an empty pointer.
---
--- It may be clearer to state it this way:
--- - `init = false`: looks up the next valid element, current element **excluded**, while
--- - `init = true`: looks up the next valid element, current element **included**.
---
--- @param t table
--- @param init boolean|nil see the above usage tips
--- @return boolean success false if the tree is exhausted and no valid next element can be found
--- @return boolean gone_up true if the process exhausted at least one array and started looking at its siblings
function TablePath:step(t, init)
    assert(type(t) == "table", "expecting a table")
    local new = self:copy()
    local gone_up = false
    while true do
        if init then
            init = false
        else
            local is_array, parent = new:is_array(t, 1)
            while (
                #new > 1 and (
                    not is_array
                    or #parent <= new[#new]
                    or (
                        #new > 2 and (
                            new[#new - 1] == "select"
                            or new[#new - 1] == "args"
                        )
                    )
                )
            ) do
                gone_up = true
                new:resolve(nil)
                if #new <= 1 then
                    assert(#new == 1)
                    self:set(new)
                    return false, true
                end
                is_array, parent = new:is_array(t, 1)
            end
            if new:is_done() then
                self:set(new)
                return false, gone_up
            else
                new[#new] = new[#new] + 1
            end
        end
        while new:is_array(t) do
            -- Incremental updates to make read counts consistent
            self:set(new)
            -- Skipping the metadata node
            new:resolve(2)
        end
        if new:get(t) then
            self:set(new)
            return true, gone_up
        end
    end
end

--- Returns true if the pointer cannot get further incremented (pointing to the root).
---
--- @return boolean done
function TablePath:is_done()
    return #self <= 1
end

--- Concatenates path segments with `/`.
---
--- @param sep string|nil the separator
--- @return string path the concatenated string
function TablePath:__tostring(sep)
    sep = sep or "/"
    local str = ""
    for _, v in ipairs(self) do
        str = str .. sep .. v
    end
    return str
end

return TablePath
