--[[
Copyright (C) 2023-2024 gudzpoz.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
]]--

--- The brocatel module, containing the core brocatel.VM implementation.
---
--- @module "brocatel"
--- @see VM
local brocatel = {}

local StackedEnv = require("mdvm.stacked_env")
local savedata = require("mdvm.savedata")
local VM = require("mdvm.vm")
brocatel.VM = VM

brocatel.StackedEnv = StackedEnv

--- @param t table
--- @return table copy
local function shallow_copy(t)
  local copy = {}
  for key, value in pairs(t) do
      copy[key] = value
  end
  return copy
end

--- Creates a VM from a string chunk compiled by the Brocatel compiler.
---
--- The ``save`` argument is equivalent to `load_vm` and then calling `VM.load`.
---
--- @param content string the compile brocatel chunk
--- @param save string|nil the savedata content, from :any:`brocatel.VM.save`
--- @param extra_env table|nil extra Lua environment globals (only `extern`, `print` and `require` permitted)
--- @return brocatel.VM vm
function brocatel.load_vm(content, save, extra_env)
  local env = StackedEnv.new()
  if not extra_env then
      extra_env = {}
  end
  env:set_lua_env({
      assert = assert,
      error = error,
      ipairs = ipairs,
      next = next,
      pairs = pairs,
      select = select,
      ---@diagnostic disable-next-line: deprecated
      unpack = unpack,
      pcall = pcall,
      xpcall = xpcall,
      tonumber = tonumber,
      tostring = tonumber,
      type = type,
      print = extra_env.print,
      require = extra_env.require,
      extern = extra_env.extern,

      os = { time = os.time },
      math = shallow_copy(math),
      string = shallow_copy(string),
      table = shallow_copy(table),
      _G = env.env,
  })
  local chunk = savedata.load_with_env(env.env, content)()
  local vm = VM._new(chunk, env)
  if save then
      vm:load(save)
  end
  return vm
end

return brocatel
