local brocatel = require("vm")

if #arg ~= 1 then
  print("usage: cli.lua <filename>")
  return
end

local f = assert(io.open(arg[1]))
local content = f:read("*a")
f:close()

--- @param tags table|boolean|nil
local function print_tags(tags)
  if type(tags) == "table" then
    for _, tag in ipairs(tags) do
      io.write("[", tag, "]")
    end
    io.write("\n"):flush()
  end
end

local vm = brocatel.load_vm(content)
local input = nil
while true do
  local line = vm:next(input)
  input = nil
  if type(line) == "nil" then
    break
  elseif type(line.text) == "string" then
    print_tags(line.tags)
    io.write(line.text, "\n")
  elseif type(line.select) == "table" then
    while not input do
      local options = {}
      for _, option in ipairs(line.select) do
        options[option.key] = true
        io.write("### Option ", tostring(option.key), " ###\n")
        io.write(option.option, "\n")
      end
      io.write("Please input your choice: ")
      input = io.read("*n")
      if not options[input] then
        input = nil
      end
    end
  end
end
