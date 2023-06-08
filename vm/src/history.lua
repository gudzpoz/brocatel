local history = {}

--- Creates inner table, similar to `mkdir -p`.
---
--- @param save table
--- @param name number|string
--- @return table inner
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

local bits_per_number = 31

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

--- Records the path change.
---
--- - For text nodes, it simply marks the line as read.
--- - For arrays (probably with labeled ones), it increments their visited counter.
--- @param save table
--- @param root table
--- @param old TablePath
--- @param new TablePath
function history.record_simple(save, root, old, new)
    local i = 1
    local j = 1
    -- No counter incrementation for common parts.
    while old[i] == new[j] and i <= #old and j <= #new do
        local segment = old[i]
        save = makedir(save, segment)
        if type(segment) == "number" then
            if not save[1] then
                save[1] = { i = 1 }
            end
        end
        i = i + 1
        j = j + 1
    end
    -- Increment counters for new parts.
    -- An array just pointed to is not seen as read,
    -- which is why we use `j < #new` instead of `j <= #new`.
    local segment = nil
    local meta = nil
    while j <= #new do -- The last
        segment = new[j]
        if type(segment) == "number" then
            meta = save[1]
            if not meta then
                meta = { i = 0 }
                save[1] = meta
            end
            meta.i = meta.i + 1
        end
        save = makedir(save, segment)
        j = j + 1
    end
    if new:is_array(root) and type(segment) == "number" then
        local read = meta.r
        if not read then
            read = {}
            meta.r = read
        end
        history.set_bit(read, segment)
    end
end

--- Returns the visited count.
--- @param save table
--- @param path TablePath
function history.get_recorded_count(save, path)
    local is_array, node = path:is_array(save)
    if is_array then
        return assert(node)[1].i or 0
    end
    local parent
    is_array, parent = path:is_array(save, 1)
    if is_array then
        local bitset = assert(parent)[1].m
        return bitset and history.get_bit(bitset, path[#path]) or 0
    end
    return 0
end

return history
