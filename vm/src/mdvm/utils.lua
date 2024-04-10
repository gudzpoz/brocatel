--- @class mdvm.utils
local utils = {}

--- Returns the keys of a table.
---
--- @param values table
--- @return table keys
function utils.get_keys(values)
  local keys = {}
  for key, _ in pairs(values) do
      keys[key] = true
  end
  return keys
end

return utils
