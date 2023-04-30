--- @diagnostic disable-next-line: lowercase-global
md = {}

--- @class Node
--- @field type string
--- @field attributes table|nil
--- @field children Node[]|nil
--- @field data table|nil
--- @field value string|nil
--- @field url string|nil
--- @field depth number|nil

--- @param node Node
--- @return string markdown stringified Markdown
function md.to_markdown(node)
  --- @diagnostic disable-next-line: undefined-global
  return to_markdown(node)
end

--- @param text string text content
--- @return Node text a Markdown text node
function md.text(text)
  return {
    type = "text",
    value = text,
  }
end

--- @param url string path separated by `|`
--- @return Node link a Markdown link node
function md.link(url)
  return {
    type = "link",
    url = url,
    children = {},
  }
end

--- @param label string title
--- @return Node h1 a Markdown heading node
function md.heading(label)
  return {
    type = "heading",
    depth = 1,
    children = { md.text(label) },
  }
end

--- @param children Node[] array of children
--- @param type string|nil the node type
--- @return Node blockquote a blockquote node
function md.block(children, type)
  return {
    type = type or "blockquote",
    children = children
  }
end

--- @param children Node[] array of children
--- @return Node blockquote a blockquote node
function md.paragraph(children)
  return md.block(children, "paragraph")
end

local loop_count = 0
--- @param label string|nil the label
--- @param children Node[] array of children
--- @return Node blockquote a blockquote node that loops infinitely
function md.loop(label, children)
  if not label then
    loop_count = loop_count + 1
    label = "#loop-" .. loop_count
  end
  return md.block({
    md.heading(label),
    md.block(children),
    md.paragraph({ md.link(label) }),
  })
end

--- @param expr string the Lua expression
--- @param if_children Node[] array of children executed when `expr` returns true
--- @param else_children Node[]|nil the else branch
--- @return Node blockquote a blockquote node that condition blocks
function md.if_else(expr, if_children, else_children)
  local block = md.block({ md.block(if_children), else_children and md.block(else_children) })
  block.data = { ["if"] = expr }
  return block
end

--- @param arg Node a containerDirective node
--- @return Node blockquote a loop node
--- @diagnostic disable-next-line: lowercase-global
function loop(arg)
  local label = nil
  assert(arg.children and #arg.children >= 1)
  local first = arg.children[1]
  local children = arg.children or {}
  if first.data and first.data.directiveLabel then
    label = md.to_markdown(first)
    children = {}
    for i = 2, #arg.children do
      children[#children + 1] = arg.children[i]
    end
  end
  return md.loop(label, children)
end

--- @param arg Node a containerDirective node
--- @return Node[] blockquote a if-else node
--- @diagnostic disable-next-line: lowercase-global
function when(arg)
  assert(#arg.children == 2, "missing conditional or list")
  assert(arg.children[1].type == "paragraph", "missing conditional")
  assert(arg.children[1].data.directiveLabel, "missing conditional")
  local list = arg.children[2]
  assert(list.type == "list", "missing list")
  assert(#list.children >= 1)
  local expr = md.to_markdown(arg.children[1])
  return md.if_else(
    expr or 'true',
    list.children[1].children,
    list.children[2] and list.children[2].children
  )
end

--- @param arg Node a containerDirective node
--- @return Node[] blockquote a switch-case node
--- @diagnostic disable-next-line: lowercase-global
function switch(arg)
  assert(#arg.children >= 1)
  local code = ""

  local first = arg.children[1]
  local list_index = 1
  if first.type ~= "list" then
    assert(first.type == "paragraph"
      and first.data and first.data.directiveLabel, "inner content must be a list")
    code = md.to_markdown(first)
    list_index = 2
  end
  assert(#arg.children == list_index, "no extra content allowed")
  local list = arg.children[list_index]
  assert(list.type == "list", "inner content must be a list")

  local branches = {}  --- @type Node[]
  for i, list_item in ipairs(list.children) do
    assert(#list_item.children >= 1, "conditional branch must not be empty")
    local cond = list_item.children[1]
    assert(
      cond.type == "paragraph" and #cond.children == 1 and cond.children[1].type == "inlineCode",
      "the first element must be a condition"
    )
    local case = cond.children[1].value
    local items = {}  --- @type Node[]
    for j = 2, #list_item.children do
      items[#items + 1] = list_item.children[j]
    end
    branches[i] = md.block(items)
    code = code .. "\nif(\n" .. case .. "\n)then return ip:set(args:resolve(" .. i .. "))end"
  end
  local block = md.block(branches)
  block.data = { ["func"] = code }
  return block
end
