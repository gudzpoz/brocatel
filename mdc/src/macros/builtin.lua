--- @diagnostic disable-next-line: lowercase-global
md = {}

--- @class Position

--- @class Node
--- @field type string
--- @field name string|nil
--- @field lang string|nil
--- @field meta string|nil
--- @field attributes table|nil
--- @field children Node[]|nil
--- @field data table|nil
--- @field value string|nil
--- @field url string|nil
--- @field depth number|nil
--- @field position Position|nil

--- @param node Node
--- @return string markdown stringified Markdown
function md.to_markdown(node)
  -- The TO_MARKDOWN function is set by the compiler.
  --- @diagnostic disable-next-line: undefined-global
  return TO_MARKDOWN(node)
end

--- @param text string text content
--- @param type string|nil node type
--- @return Node text a Markdown text node
function md.text(text, type)
  return {
    type = type or "text",
    value = text,
  }
end

--- @param children Node[] array of children
--- @param type string the node type
--- @return Node local a mdast parent
function md.parent(children, type)
  return {
    type = type,
    children = children
  }
end

--- @param children Node[] array of children
--- @return Node paragraph a paragraph node
function md.paragraph(children)
  return md.parent(children, "paragraph")
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

--- @param children Node[] content
--- @return Node list a Markdown list node
function md.list_item(children)
  return {
    type = "listItem",
    children = children,
  }
end

--- @param name string the name of the macro
--- @param param string|nil the parameter
--- @param children Node[][]|nil extra parameters
--- @param func boolean|nil whether to put the param in a func node
function md.macro(name, param, children, func)
  local content = {}
  if func then
    local code = md.text(param or "", "code")
    code.lang = "lua"
    code.meta = "func"
    content[1] = code
  elseif param then
    content[1] = md.paragraph({ md.text(param, "inlineCode") })
  end
  local params = {}
  for _, v in ipairs(children or {}) do
    params[#params + 1] = md.list_item(v)
  end
  content[#content + 1] = {
    type = "list",
    children = params,
  }
  local block = md.parent(content, "containerDirective")
  block.name = name
  return block
end

--- @param children Node[][] array of children
--- @return Node local a scoped node
function md.scope(children)
  return md.macro("local", nil, children)
end

local loop_count = 0
--- @param label string|nil the label
--- @param children Node[][] array of children
--- @param label_pos Position|nil position of the label
--- @param list_pos Position|nil position of the list
--- @return Node scope a scoped node that loops infinitely
function md.loop(label, children, label_pos, list_pos)
  if not label then
    loop_count = loop_count + 1
    label = "\\#loop-" .. loop_count
  end
  local heading = md.heading(label)
  heading.position = label_pos
  local list = md.scope(children)
  list.position = list_pos
  return md.scope({
    { heading },
    { list },
    { md.paragraph({ md.link(label) }) },
  })
end

--- @param expr string the Lua expression
--- @param if_children Node[] array of children executed when `expr` returns true
--- @param else_children Node[]|nil the else branch
--- @return Node macro an if macro node that condition blocks
function md.if_else(expr, if_children, else_children)
  return md.macro("if", expr, {
    if_children,
    else_children,
  })
end

--- @param arg Node a containerDirective node
function md.destruct(arg)
  assert(arg.children and 1 <= #arg.children and #arg.children <= 2)
  local label, list, pos
  if #arg.children == 1 then
    list = arg.children[1]
    assert(list.type == "list")
  else
    label = arg.children[1]
    list = arg.children[2]
    if label.type == "code" then
      assert(label.data and label.data.directiveLabel)
      pos = label.position
      label = label.value
    elseif label.type == "containerDirectiveLabel" and #label.children == 1
        and label.children[1].type == "inlineCode" then
      pos = label.children[1].position or label.position
      label = label.children[1].value
    else
      error("unexpected node")
    end
  end
  assert(list.type == "list")
  return label, list, pos
end

--- @param arg Node a containerDirective node
--- @return Node scope a loop node
--- @diagnostic disable-next-line: lowercase-global
function loop(arg)
  --[[
    - containerDirective
      children:
        - directiveLabel?
        - list
          children:
            - listItem1
            - listItem2
            - ...
  ]]
  --
  local label, list, pos = md.destruct(arg)
  local children = {}
  for _, item in ipairs(list.children) do
    children[#children + 1] = item.children
  end
  return md.loop(label, children, pos, list.position)
end

--- @param arg Node a containerDirective node
--- @return Node scope a switch-case node
--- @diagnostic disable-next-line: lowercase-global
function switch(arg)
  local code, list = md.destruct(arg)
  code = code or ""

  local children = {}
  for i, list_item in ipairs(list.children) do
    assert(#list_item.children >= 1, "conditional branch must not be empty")
    local cond = list_item.children[1]
    assert(
      cond.type == "paragraph" and #cond.children == 1 and cond.children[1].type == "inlineCode",
      "the first element must be a condition"
    )
    local case = cond.children[1].value
    local items = {} --- @type Node[]
    for j = 2, #list_item.children do
      items[#items + 1] = list_item.children[j]
    end
    children[#children + 1] = items
    code = code .. "\nif(\n" .. case .. "\n)then return IP:set(args:resolve(" .. (i + 1) .. "))end"
  end

  return md.macro("do", code, children, true)
end
