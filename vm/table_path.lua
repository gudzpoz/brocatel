--- Simplified JSONPath for Lua tables.
---
--- It recognizes basic elements (only arrays for now) in the brocatel runtime format,
--- to allow easier navigation through the tree structure.
---
--- @class TablePath
local TablePath = {}
TablePath.__index = TablePath

--- Creates a path from an array.
---
--- The table is copied into the new path.
---
--- @param t table|TablePath the path
--- @return TablePath
function TablePath.from(t)
    assert(type(t) == "table", "expecting a table")
    local copy = {}
    for i, v in ipairs(t) do
        copy[i] = v
    end
    setmetatable(copy, TablePath)
    return copy
end

--- Creates a new table-path that points to the root table itself.
--- @return TablePath
function TablePath.new()
    return TablePath:from({})
end

--- Returns a copy of the current pointer.
---
--- @return TablePath
function TablePath:copy()
    return TablePath.from(self)
end

--- Returns true if the two paths equal.
---
--- @param path table|TablePath the other path
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
function TablePath:get(t, parents)
    assert(type(t) == "table", "expecting a table")
    if not parents then
        parents = 0
    end
    if parents > #self then
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
--- @vararg string|number|nil the relative path
--- @return TablePath the new current path, *not* a new one
function TablePath:resolve(...)
    local n = select("#", ...)
    local args = {...}
    for i = 1, n do
        local arg = args[i]
        if arg then
            self[#self + 1] = arg
        else
            self[#self] = nil
        end
    end
    return self
end

--- Returns true if the pointer is pointing to an brocatel array.
---
--- @param t table
function TablePath:is_array(t, parents)
    local node = self:get(t, parents)
    if type(node) ~= "table" then
        return false
    end
    return type(node[1]) == "table"
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
--- @return boolean false if the tree is exhausted and no valid next element can be found
function TablePath:step(t, init)
    assert(type(t) == "table", "expecting a table")
    while true do
        if init then
            init = false
        else
            while not self:is_array(t, 1) or #self:get(t, 1) <= self[#self] do
                self:resolve(nil)
                if #self == 0 then
                    return false
                end
            end
            self[#self] = self[#self] + 1
        end
        if not self:is_array(t) then
            return true
        end
        while self:is_array(t) do
            -- Skipping the metadata node
            self:resolve(2)
        end
        if self:get(t) then
            return true
        end
    end
end

function TablePath:__tostring()
    local str = ""
    for _, v in ipairs(self) do
        str = str .. "/" .. v
    end
    return str
end

return TablePath
