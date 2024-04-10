local TablePath = require("mdvm.table_path")

local tree = {}

--- Basically `t = t + another`, array part only (ipairs).
--- @param t table
--- @param another table
local function extend(t, another)
    for _, v in ipairs(another) do
        t[#t + 1] = v
    end
end

--- Looks up `Broc atel` from `broc-atel`.
---
--- @param t table
--- @param key string
local function fuzzy_lookup(t, key)
    local v = t[key]
    if v then
        return v
    end
    key = string.lower(key)
    key = string.gsub(key, '_', ' ')
    key = string.gsub(key, '%p', '')
    key = string.gsub(key, ' ', '-')
    return t[key]
end

--- Deduplicates paths.
--- @param paths TablePath[]
--- @return TablePath[]
local function deduplicate(paths)
    local set = {}
    for _, path in ipairs(paths) do
        local s = path:__tostring("\n")
        local stored = set[s]
        if not stored then
            set[s] = path
        else
            assert(path:equals(stored))
        end
    end
    local output = {}
    for _, path in pairs(set) do
        output[#output + 1] = path
    end
    return output
end

--- Finds labels that are directly accessible to the current location.
---
--- @param current TablePath
--- @param label string
--- @param root Array
--- @return TablePath[] paths
function tree.direct_lookup(current, label, root)
    local ptr = current:copy()
    local matches = {}
    while true do
        local is_array, node = ptr:is_array(root)
        if is_array and node then
            local metadata = node[1]
            local labels = metadata.labels
            if labels then
                local rel = fuzzy_lookup(labels, label)
                if rel then
                    matches[#matches + 1] = ptr:copy():resolve(rel)
                end
            end
        end
        if ptr:is_done() then
            return matches
        end
        -- Goes to parent nodes if not found.
        ptr:resolve(nil)
    end
end

--- Finds children of parent nodes matching the label.
---
--- @param current TablePath
--- @param label string
--- @param root Array
--- @param depth number|nil the recursion levels (see child_lookup)
--- @return TablePath[] paths
function tree.sibling_lookup(current, label, root, depth)
    local ptr = current:copy():resolve(nil)
    while true do
        local found = tree.child_lookup(ptr, label, root, depth)
        if #found ~= 0 then
            return found
        end
        if ptr:is_done() then
            return {}
        end
        -- Goes to parent nodes if not found.
        ptr:resolve(nil)
    end
end

--- Finds children (maybe indirect) with a certain label.
---
--- @param current TablePath
--- @param label string
--- @param root Array
--- @param depth number|nil
--- @return TablePath[] paths
function tree.child_lookup(current, label, root, depth)
    local matches = {}
    local lookups = { { current:copy(), 1 } }
    while #lookups ~= 0 do
        local lookup = lookups[#lookups]
        local ptr = lookup[1]
        local i = lookup[2]
        lookups[#lookups] = nil
        local is_array, node = ptr:is_array(root)
        if is_array and node then
            local labels = node[1].labels
            if labels then
                local rel = fuzzy_lookup(labels, label)
                if rel then
                    if #rel > 0 then
                        matches[#matches + 1] = ptr:resolve(rel)
                    end
                elseif not depth or i < depth then
                    for _, relative in pairs(labels) do
                        lookups[#lookups + 1] = { ptr:copy():resolve(relative), i + 1 }
                    end
                end
            end
        end
    end
    return matches
end

--- @param current TablePath
--- @param labels string[]
--- @param root Array
--- @return TablePath[] paths
function tree.deep_lookup(current, labels, root)
    if #labels == 0 then
        return { current }
    end
    local lookups = { { current, 1 } }
    local found = {}
    while #lookups ~= 0 do
        local lookup = lookups[#lookups]
        lookups[#lookups] = nil
        local path = lookup[1]
        local i = lookup[2]
        local label = labels[i]
        -- Try look up in child nodes.
        local results = tree.child_lookup(path, label, root)
        if i == 1 then
            -- Direct elements.
            extend(results, tree.direct_lookup(path, label, root))
            if #results == 0 then
                -- More possibilities, discouraged though.
                results = tree.sibling_lookup(current, label, root, 2)
            end
        end
        if i == #labels then
            extend(found, results)
        else
            for _, ptr in ipairs(results) do
                lookups[#lookups + 1] = { ptr, i + 1 }
            end
        end
    end
    return deduplicate(found)
end

--- @param root table
--- @param current TablePath|string either the name of the root node or path to the current node
--- @param labels string[]
--- @return TablePath[] paths
function tree.find_by_labels(root, current, labels)
    if type(current) == "string" then
        return tree.deep_lookup(
            TablePath.from({ current }),
            labels,
            root
        )
    else
        return tree.deep_lookup(current, labels, root)
    end
end

return tree
