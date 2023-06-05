--- @param vm VM
--- @param limit number|nil
local function gather_til_end(vm, limit)
    limit = limit or 1e6
    local lines = {}
    for _ = 1, limit do
        local line, _ = vm:next()
        if line then
            lines[#lines + 1] = line
        else
            break
        end
    end
    return lines
end

return {
    gather_til_end = gather_til_end,
}
