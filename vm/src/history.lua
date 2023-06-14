local history = {}

--- Creates inner table, similar to `mkdir -p`.
---
--- @param save table
--- @param name number|string
--- @return Element inner
local function makedir(save, name)
    local inner = save[name]
    if inner then
        return inner
    else
        inner = {}
        save[name] = inner
        return inner
    end
end

-- Max safe integer bits for floats (single precision).
local bits_per_number = 24

--- Sets a bit in a bit set.
--- @param bitset table<number>
--- @param index number
function history.set_bit(bitset, index)
    local offset = (index - 1) % bits_per_number
    local i = (index - 1 - offset) / bits_per_number + 1
    for j = 1, i do
        if not bitset[j] then
            bitset[j] = 0
        end
    end
    local n = bitset[i]
    -- Pecular way to do `n | mask` in Lua.
    local mask = 2 ^ offset
    local residue = n % mask
    local shifted = (n - residue) / mask  -- shifted = n >> offset
    if shifted % 2 == 0 then
        shifted = shifted + 1
    end
    bitset[i] = shifted * mask + residue
end

--- Fetches a bit in a bit set.
--- @param bitset table<number>
--- @param index number
function history.get_bit(bitset, index)
    local offset = (index - 1) % bits_per_number
    local i = (index - 1 - offset) / bits_per_number + 1
    local n = bitset[i]
    if not n then
        return false
    end
    local mask = 2 ^ offset
    -- Pecular way to do `n & mask` in Lua.
    n = n - n % mask  -- n / mask == n >> offset
    return (n / mask) % 2 == 1
end

--- Fetches a key-value pair bound to a path.
---
--- @param save table
--- @param path TablePath
--- @param key string
--- @returns string|number|boolean|nil
function history.get(save, path, key)
    for _, segment in ipairs(path) do
        save = save[segment]
        if type(save) ~= "table" then
            return nil
        end
    end
    local meta = save[1]
    if meta then
        assert(type(meta) == "table")
        return meta[key]
    end
    return nil
end

--- Saves a key-value pair bound to a path.
---
--- @param save table
--- @param root table
--- @param path TablePath
--- @param key string
--- @param value string|number|boolean
function history.set(save, root, path, key, value)
    assert(#path > 0 and key ~= "R" and key ~= "I")
    if path[#path] == "args" then
        local node = path:get(root, 1)
        assert(node and node.func)
    else
        assert(path:is_array(root))
    end
    for _, segment in ipairs(path) do
        save = makedir(save, segment)
    end
    local meta = save[1]
    if not meta then
        meta = {}
        save[1] = meta
    end
    meta[key] = value
end

--- Records the path change.
---
--- - For text nodes, it simply marks the line as read.
--- - For arrays (probably with labeled ones), it increments their visited counter.
--- @param save table
--- @param root table
--- @param old TablePath|nil
--- @param new TablePath
function history.record_simple(save, root, old, new)
    if old and old:equals(new) then
        return
    end
    local i = 1
    while i < #new do
        local segment = new[i]
        save = makedir(save, segment)
        if new:is_array(root, #new - i) then
            local meta = save[1]
            if old and old[i] ~= segment then
                old = nil
            end
            if not meta then
                meta = { I = 0 }
                save[1] = meta
            elseif not meta.I then
                meta.I = 0
            end
            if not old or meta.I == 0 then
                meta.I = meta.I + 1
            end

            local read = meta.R
            if not read then
                read = {}
                meta.R = read
            end
            history.set_bit(read, new[i + 1])
        end
        i = i + 1
    end
end

--- Returns the visited count.
--- @param save table
--- @param path TablePath
function history.get_recorded_count(save, path)
    local is_array, node = path:is_array(save)
    if is_array then
        return assert(node)[1].I or 0
    end
    local parent
    is_array, parent = path:is_array(save, 1)
    if is_array then
        local bitset = assert(parent)[1].R
        return bitset and history.get_bit(bitset, path[#path]) or 0
    end
    return 0
end

return history
