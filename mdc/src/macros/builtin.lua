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
  local content = { md.heading(label) }
  for i, child in ipairs(children) do
    content[i + 1] = child
  end
  content[#content + 1] = md.paragraph({ md.link(label) })
  return md.block(content)
end

--- @param expr string the Lua expression
--- @param if_children Node[] array of children executed when `expr` returns true
--- @param else_children Node[]|nil the else branch
--- @return Node blockquote a blockquote node that condition blocks
function md.if_else(expr, if_children, else_children)
  local condition = md.block({ md.text(expr, "inlineCode") })
  local block = md.block({
    condition,
    md.block(if_children),
    else_children and md.block(else_children)
  }, "containerDirective")
  block.name = "if"
  return block
end

--- @param arg Node a containerDirective node
function md.destruct(arg)
  assert(arg.children and 1 <= #arg.children and #arg.children <= 2)
  local label, list
  if #arg.children == 1 then
    list = arg.children[1]
    assert(list.type == "list")
  else
    label = arg.children[1]
    list = arg.children[2]
    assert(label.data and label.data.directiveLabel)
    if label.type == "code" then
      label = label.value
    elseif label.type == "paragraph" and #label.children == 1
        and label.children[1].type == "inlineCode" then
      label = label.children[1].value
    else
      error("unexpected node")
    end
  end
  assert(list.type == "list")
  return label, list
end

--- @param arg Node a containerDirective node
--- @return Node blockquote a loop node
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
  local label, list = md.destruct(arg)
  local children = {}
  for _, item in ipairs(list.children) do
    for _, child in ipairs(item.children) do
      children[#children + 1] = child
    end
  end
  return md.loop(label, children)
end

--- @param arg Node a containerDirective node
--- @return Node blockquote a switch-case node
--- @diagnostic disable-next-line: lowercase-global
function switch(arg)
  local code, list = md.destruct(arg)
  code = code or ""

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
    list_item.children = items
    code = code .. "\nif(\n" .. case .. "\n)then return IP:set(args:resolve(" .. (i + 1) .. "))end"
  end

  local func = md.text(code, "code")
  func.lang = "lua"
  func.meta = "func"
  local block = md.block({ func, list }, "containerDirective")
  block.name = "do"
  return block
end
