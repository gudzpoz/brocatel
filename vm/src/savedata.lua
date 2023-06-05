local string = require("string")
local table = require("table")

local savedata = {}

--- Checks if the key has a savable type.
---
--- @param key any
local function is_key_valid(key)
    local t = type(key)
    return t == "number" or t == "string"
end

--- Checks if the value is primitive.
---
--- @param value any
local function is_value_primitive(value)
    local t = type(value)
    return t == "number" or t == "string" or t == "boolean"
end

--- Generates a unique Lua name from i.
---
--- @param i number
local function id(i)
    local a = string.byte("a")
    local A = string.byte("A")
    local zero = string.byte("0")
    -- Avoid colliding with Lua keywords
    local t = { "_" }
    local range = 26 * 2 + 10 + 1
    while i ~= 0 do
        local mod = i % range
        i = (i - mod) / range
        local c
        if mod < 26 then
            c = string.char(a + mod)
        elseif mod < 26 * 2 then
            c = string.char(A + mod - 26)
        elseif mod < 26 * 2 + 10 then
            c = string.char(zero + mod - 26 * 2)
        else
            c = "_"
        end
        t[#t + 1] = c
    end
    return table.concat(t)
end

--- Converts a value to string.
---
--- @param v any
--- @return string serialized
local function str(v)
    if type(v) == "string" then
        return string.format("%q", v)
    else
        return tostring(v)
    end
end

--- Saves a table.
---
--- Note that the generated Lua code writes the environment
--- by declaring global intermediate variables. It should be
--- safe to supply an empty environment though.
---
--- @param t table
--- @return string saved Lua code that returns the restored table once it gets run
function savedata.save(t)
    local builder = {}
    local count = 0
    local saved = {}
    --- Writes to the string builder.
    --- @vararg string
    local function write(...)
        for _, v in ipairs({...}) do
            builder[#builder + 1] = v
        end
    end
    --- Saves a table recursively.
    local function save(name, value)
        if is_value_primitive(value) then
            write(name, "=", str(value), "\n")
        elseif type(value) == "table" then
            if saved[value] then
                write(name, "=", saved[value], "\n")
            else
                local short_name = id(count)
                count = count + 1
                write(short_name, "={}\n", name, "=", short_name, "\n")
                saved[value] = short_name
                for k, v in pairs(value) do
                    if is_key_valid(k) then
                        local fieldname = string.format("%s[%s]", short_name, str(k))
                        save(fieldname, v)
                    end
                end
            end
        else
            write("nil")
        end
      end

    save("_", t)
    write("return _\n")
    return table.concat(builder)
end

--- Loads a table.
---
--- @param s string
--- @return table loaded
function savedata.load(s)
    return savedata.load_with_env({}, s)()
end

--- @param env table the environment
--- @param s string code
--- @return function
function savedata.load_with_env(env, s)
    if setfenv then
        local chunk = assert(loadstring(s))
        setfenv(chunk, env)
        return chunk
    else
        return assert(load(s, nil, nil, env))
    end
end

return savedata
