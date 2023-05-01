local brocatel = require("brocatel")
local io = require("io")

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
  local line, tags = vm:next(input)
  input = nil
  print_tags(tags)
  if type(line) == "nil" then
    break
  elseif type(line) == "string" then
    io.write(line, "\n")
  else
    while not input do
      for key, prompt in pairs(line) do
        io.write("### Option ", tostring(key), " ###\n")
        print_tags(prompt[2])
        io.write(prompt[1], "\n")
      end
      io.write("Please input your choice: ")
      input = io.read("*n")
      if not line[input] then
        input = nil
      end
    end
  end
end
