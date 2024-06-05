local savedata = {}

local TablePath = require("mdvm.table_path")

--- @class LocalEnv
--- @field keys table<string, boolean> the keys caught by the environment
--- @field values table<string, any> the values in the environment

--- @class Coroutine
--- @field ip TablePath the current instruction pointer (IP) of the coroutine
--- @field prev_ip TablePath|nil the previous instruction pointer (IP) of the coroutine, used for history tracking
--- @field locals LocalEnv the coroutine-local variables
--- @field stack table the coroutine routine-call stack

--- @class Thread
--- @field current_coroutine number the index of the current coroutine
--- @field coroutines table<number, Coroutine> the coroutines of the thread
--- @field thread_locals LocalEnv the thread-local variables

--- @class Text
---
--- A text line.
---
--- @field tags table<string, string>|boolean|nil tags
--- @field text string|nil the translated and interpolated text
--- @field visited boolean whether the text has been visited

--- @class Selectable
---
--- A selectable option.
---
--- @field key number a number referring to the option, to be passed to `VM.next` to select to option
--- @field option Text the displayed text

--- @class Output
---
--- The output of a `VM.next` call. It is either a `Text` line or an array of `Selectable` options.
--- (The `text/tags` field and the select field is mutually exclusive.)
---
--- @field tags table<string, string>|boolean|nil tags
--- @field text string|nil the translated and interpolated text
--- @field visited boolean whether the text or the select has been visited
--- @field select Selectable[]|nil the selectable options

--- @class IOCache
--- @field input number|nil the user input (selected options)
--- @field output Output|nil last output of the current `VM.next` call

--- @class SaveData
--- @field checksum string the story checksum serving as a identifier
--- @field version number the version of the savedata format
--- @field current_thread string the name of the current thread
--- @field threads table<string, Thread> the threads of the game
--- @field stats table history and stats of the game
--- @field globals table<string, any> the global variables of the game
--- @field current IOCache the current IO cache of the game

--- @class StoryMetadata
--- @field checksum string a checksum to the story, serving as a identifier
--- @field entry string the story entry root node name
--- @field version number the version of the savedata format
--- @field IFID string[]|string|nil IFIDs

--- Initializes a savedata table from metadata.
---
--- @param meta StoryMetadata
--- @return SaveData
function savedata.init(meta)
    local ip = TablePath.from({ meta.entry })
    --- @type SaveData
    return {
        checksum = meta.checksum,
        version = meta.version,
        current_thread = "",
        current = {
            input = nil,
            output = nil,
        },
        threads = {
            [""] = savedata.new_thread(ip),
        },
        stats = {},
        globals = {},
    }
end

--- @param ip TablePath
--- @return Coroutine
function savedata.new_coroutine(ip)
    --- @type Coroutine
    return {
        ip = ip,
        locals = { keys = {}, values = {} },
        stack = {},
    }
end

--- @param ip TablePath
--- @return Thread
function savedata.new_thread(ip)
    --- @type Thread
    return {
        current_coroutine = 1,
        coroutines = {
            savedata.new_coroutine(TablePath.from(ip)),
        },
        thread_locals = { keys = {}, values = {} },
    }
end

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
        end
      end

    save("_", t)
    write("return _\n")
    return table.concat(builder)
end

--- Loads a table.
---
--- @param s string
--- @return SaveData loaded
function savedata.load(s)
    return savedata.load_with_env({}, s)()
end

--- @param env table the environment
--- @param s string code
--- @return function
function savedata.load_with_env(env, s)
    ---@diagnostic disable-next-line: deprecated
    local setfenv = setfenv
    if setfenv then
        ---@diagnostic disable-next-line: deprecated
        local chunk = assert(loadstring(s, '<input>'))
        setfenv(chunk, env)
        return chunk
    else
        return assert(load(s, '<input>', nil, env))
    end
end

return savedata
