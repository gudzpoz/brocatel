# Brocatel Architecture

Brocatel is designed to be simple. Mainly, it consists of two parts:

1. A Markdown compiler that

   - parses the input Markdown file(s),
   - transforms the parsed AST into an AST-like Lua table (or tables),
   - and runs any Lua macros to allow users to post-process the text tree.

2. A virtual machine that:

   - yields text line by line,
   - runs user-provided Lua code to allow custom logic,
   - and supports threads and fibers (and coroutines) with some special Lua function calls.

Well, actually there is a third part - `lgettext`, which extracts texts from the Lua table
to generate a Gettext PO file for translation.

## Markdown Compiler

The compiler compiles the Markdown file(s) into a `.lua` file (or files)
so that it can easily get integrated anywhere.

It uses [remark](https://github.com/remarkjs/remark) to parse the files
into ASTs, transforms the ASTs into a Lua table (with references resolved)
and merges all Lua files into an amalgam.

## Runtime VM

The VM mainly controls the flow of texts and manipulates the Lua environment
to allow writing Lua snippets in instinctive ways.

### Runtime Format

The Lua file amalgamation should output a Lua file that returns a huge Lua table:

```lua
return {
    [""] = {
        version = 1,
        entry = "entry-file-name.md",
    },
    ["entry-file-name.md"] = RootNode1,
    ["other-file-1.md"] = RootNode2,
    ["other-file-2.md"] = RootNode3,
}
```

A `RootNode` may be:
- an *array*,
- or a function that accepts no parameter and returns a `RootNode` *array* (to allow delayed loading).

`RootNode` Examples:
- `{{}, "NPC A: Hello!", "NPC B: Hi!"}`
- `function() return require("plots.some_big_plot") end`

#### Containers

An *array* is a Lua table with only consecutive integer indices starting from `1`.
The first element of an array is *some* metadata (like names in that scope, etc.),
and all other elements are *value*s. In the most simple form, the story is
constructed by reading a root *array* entry by entry.

```lua
SimplArray = {
  {
      labels = {
          para_1 = 2,
          para_2 = 3,
      },
      locals = {
          localVariable1 = 0,
      },
  },
  "Paragraph 1",
  "Paragraph 2",
  "Hello World!",
}
```

#### Values

There are several kinds of values in the compiled Lua table tree.

- **text**: Lua strings, as is shown in the example above, which the runtime will
  yield as is.

- **tagged text**: Texts that either are tagged or contain dynamic texts.
  `type` and `text` are required while all other fields may be `nil`.

  ```lua
  -- [blue] [red] some raw text with _**mark-ups**_ preserved as is, visit counters {count()?}
  TaggedText = {
    type = "text",
    text = "some raw text with _**mark-ups**_ preserved as is: {__generated_name_1} counts",
    tags = { "blue", "red" },
    plural = "__generated_name_1",
    values = {
      __generated_name_1 = function() count() end,
    },
  }
  ```

  The runtime will do the interpolation, possibly pass the input to a gettext backend (invoking `ngettext`) and
  return the final result.

- **function call**: Function calls from which all scripting logic is built.

  ```lua
  FunctionCall_TypeI = {
    type = "func",
    func = function() return true end,
    nested = ArrayOfParameters,
  }
  FunctionCall_TypeII = {
    function() return hasPlayerBeenSomewhere() end,
    {"The Player has been somewhere."},
    {"The Player has not yet been there."},
  }
  ```

  `ArrayOfParameters` is just an *array*. And `FunctionCall_TypeII` is just a syntactic sugar for if-else statements.

- **select**: A list of options.

  ```lua
  Select = {
    type = "select",
    select = {
      { {}, "Option One", "Outcome #1" },
      { {}, "", "" },
    },
  }
  ```

- **link**: Absolute paths (like JSONPath) to certain values.

  ```lua
  Link = {
    type = "link",
    link = { 1, 1, "list", 1 },
    root_name = "root_name",  -- Optional
  }
  ```

### Function Call Environments

We don't want the users (especially those with not that much programming experiences)
to worry about Lua scopes / environments - ideally, scopes in Lua code should be identical
to those in Markdown files:

```markdown
# chapter_one
`if! section_one` The Player has gone through *__chapter_one__.section_one*.
## section_one
...

# chapter_two
`if! section_one` The Player has gone through *__chapter_two__.section_one*.
## section_two
...
```

To archive this, the runtime manipulates the Lua environment quite heavily, literally abusing
metafunctions like `__index` and `__newindex` in Lua.

In the Lua snippets, one has access to the following variables (overridden by latter ones):

1. Some functions from the Lua standard libraries (*global*)
2. All member functions from the VM, wrapped up so that it can be used without a `self` (*global*)
3. User-defined global functions / variables, which are put on the top level in the generated Lua files
   and naturally included when evaluating the Lua file (*global, with possible delayed loading*)
4. User-defined labels (actually a Lua table with data like counters or `nil` for unvisited labels)
   (*scoped, hierarchical, per label section*)
5. User-passed variables when creating new threads (*scoped, per thread*)
6. User-defined local variables (*scoped, per function call*)

Labels and local variables are declared in the metadata of arrays.
The former one is stored globally while the latter lives on a stack thing.

#### Implementation Details

This section should help explaining why things are so.

1. After Lua 5.2, the `setfenv` function is officially removed, and we cannot change a function's environment
   freely (at least without the use of the `debug` module). Therefore, the only way we can bind an environment
   to a function while maintaining compatibility through Lua 5.x is when it is loaded with `load`.
   So, throughout the VM lifetime, we have to reuse the same environment instance, requiring us to make
   heavy use of the `__index` and `__newindex` meta-methods. (Thanks to them, we are precisely achieve what
   we want (with quite a bit of work) described below.)

2. Variables belong to different scopes, which can differ in their expected behaviors. For example, you don't
   want to save the Lua `_VERSION` string.

3. The outermost scope is the **Lua** environment, containing Lua functions and packages. It will **not** be included
   in the save data. It is mostly **read-only** but **writable when loading Lua files**.

4. The second is the **global** scope. It is shared between all scripts and will be **saved** in the save data.
   Any modifications, if not captured by inner scopes, will end up here (except when loading Lua files).

5. Then, the **file-local** scope. For non-programmers, I assume leaving everything global can be most friendly,
   so the default is putting everything in the *global* scope, and *file-local* variables need a special kind of
   declaration (with a function provided at runtime). It is **saved**.

6. Here follows the *label* scope. I suppose it is the most curious scope, since we want to it to be **read-only**.
   The scope is generated from existing statistics, probably with a special `__index` function to compute things
   lazily. In particular, a visited label `chapte_1.section_1` or `section_1` should return a table, while unvisited
   ones should return `nil` (and continue the lookup in outer scopes). And `__newindex` should errs.

7. Thread-locals and function-locals (or just function parameters) are quite instinctive and are **saved** along
   the thread.

Procedure:

1. Loading Lua files (*Lua scope*): Global variable writes goes to the Lua scope.
2. Loading save data: Writes to a new global scope, local scopes for each file and the label statistics.
3. Running functions (*Lua*, *global*, *file-local*, *label*, *thread*, *function*):
   - Reads: Looks up things from inner scopes to outer ones.
   - Writes: Looks up from inner to outer, excluding the Lua scope and the label scope.

### Runtime Pseudo-Code

```python
def run():
    state = VmState()
    if save_data:
        state.load_from(save_data, root_node)
    else:
        state.initialize_state(root_node)
    while state.not_ended():
        value = state.yield_next_node(user_input_if_any())
        if value is not None:
            yield value


def yield_next_node(self, user_input):
    node = self.get_current_node()
    t = type(node)
    environment = self.compute_lua_environment() if needs_evaluation(t) else None
    prev_ip = state.get_ip()
    self.increment_ip()
    if t == "text":
        return self.gettext(node), []
    elif t == "tagged_text":
        evaluated = {}
        for value_name, evaluator in node["values"].items():
            evaluated[value_name] = self.run_in_environment(evaluator, environment)
        text = self.ngettext(node["text"], evaluated[node["plural"]])
        text = text.format_map(evaluated)
        return text, node["tags"]
    elif t == "if_else_call":
        if self.run_in_environment(node[0], environment):
            self.set_ip(prev_ip.if_branch())
        else:
            self.set_ip(prev_ip.else_branch())
        return
    elif t == "function_call":
        self.run_in_environment(node["func"], environement)
        return
    elif t == "select":
        if not user_input:
            options = []
            for i, _ in enumerate(node["select"]):
                option_text = self.get_current_node(prev_ip.option_branch(i))
                options.append((i, option_text))
            return options
        else:
            self.set_ip(prev_ip.option_branch(i).increment())
            return
    elif t == "link":
        self.set_ip(node["link"])
        return
    else:
        pass
```

### Save Data

The save data itself is also a Lua table, containing literally anything. However, if the user's Lua scripts
do not change things too much, saving only strings, numbers, booleans and tables should be enough.
The table itself can contain recursive references, and you should want to make sure that you save
and load it correctly.

```lua
SaveData = {
    current_thread = "threadName1",
    threads = {
        ["threadName1"] = {
            current_coroutine = 1,
            coroutines = {
                {
                    ip = CurrentInstructionPointer,
                    root_name = "root_node_name",
                    locals = {
                        values = {
                            localVariable1 = "Hello",
                        },
                        keys = {
                            localVariable1 = true,
                        },
                    },
                    stack = {
                        {ip = InstructionPointer1, root_name = "some_other_root", locals = { ... }},
                        {ip = InstructionPointer2, root_name = "some_other_root", locals = { ... }},
                    },
                },
            },
            thread_locals = {
                -- ...
            },
        },
    },
    labels = {
        chapter_1 = {
            visited = 3,
        },
        chapter_2 = {
            visited = 1,
            section_2 = {
                visited = 1,
            },
        },
    },
    globals = {
        globalVariable = 1,
    },
}
```
