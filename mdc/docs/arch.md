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

### Stages of compilation

1. Macro expansion.
2. AST transpilation.
3. Serialization.

## Runtime

### Story File Format

The [story file](https://www.ifwiki.org/Story_file) is a Lua script file, which can get separated into multiple files if necessary (e.g. when the file is too large).

The Lua file should return a Lua table in the following format:

```lua
return {
  [""] = StoryFileMetadata,
  [rootNodeName1] = RootNode1,
  [rootNodeName2] = RootNode2,
  -- ...
}
```

See the `RootNode` section for the format of `RootNode1` and `RootNode2`.
Alternatively, a `RootNode` can also be a function that returns a real `RootNode` when called, useful when one wants to lazily load contents.
`rootNodeName1` and `rootNodeName2` are simply names that refer to the corresponding root nodes.

#### `StoryFileMetadata`

A _table_ that contains the basic metadata about the file.

```lua
StoryFileMetadata = {
  -- The story file format version.
  format = 1,
  -- The [IFID](https://www.ifwiki.org/IFID).
  ifid = "4fd35a71-71ef-5a55-a9d9-aa75c889a6d0",
  -- The name of the story entry point node.
  entrance = rootNodeName1,
}
```

#### `RootNode`

A `RootNode` is compiled from a Markdown file, whose base name is usually used as the `rootNodeName` of the node.
For example, if `RootNode1` is compiled from `main.md`, then it is very likely the story file returns something like this:

```lua
return {
  [""] = StoryFileMetadata,
  main = RootNode1,
}
```

A `RootNode` is a tree composed of _arrays_ and _elements_. The `RootNode` itself is an array.

##### Arrays

An array is a Lua _array_, that is, a Lua table with only consecutive integer indices starting from `1`.
The first element of the array is a table used to keep some metadata, while other elements are nested _arrays_ or _elements_.

```lua
Array = {
  ArrayMetadata,
  -- ...
}
ArrayMetadata = {
  -- [optional] The label of this array.
  label = "chapter 1",
  -- [optional] The links to all labeled child arrays (indirect ones included).
  labels = { ["section 1"] = { 2, 2, 2 } },
}
```

##### Elements

Valid elements are _texts_, _links_, _if-else nodes_ and _function nodes_.

- _Texts_: either a Lua string or a table of the following format:

  ```lua
  Text = {
    -- The text, string template allowed.
    text = "Hello {player_name}! You've solved {solved_count} out of {total_count} puzzles.",
    -- [optional] The dynamic values used for string interpolation.
    -- Note that the compiler should have ensured that simple replacement works and no character escape is ever needed.
    -- If one uses {player_name} in their Markdown file intending to leave it as is,
    -- then the following should have been compiled to { player_name_123 = ... }.
    values = {
      player_name = function() return player_name end,
      solved_count = function() return solved_count end,
      total_count = function() return total_count end,
    },
    -- [optional] Mark one of the interpolation value as affecting plural forms.
    plural = "total_count",
    -- [optional] Tags or attributes.
    tags = { colorful, size = 32 },
  }
  ```

- _Links_: They are jumps or `goto` in the following form:

  ```lua
  Link = {
    -- The path (hierarchical labels) to a certain array.
    -- For absolute paths (with root name specified in =root=), the look-up starts at the root node.
    -- It is similar to a =div p a= CSS selector, that is, omitting some labels is allowed.
    -- For relative paths, the look-up starts at the current node, first looking for a node nearby
    -- with the first label ("chapter 1" in this example), and then following the absolute look-up rules.
    link = { "chapter 1", "section 1" },
    -- [optional] The root node name, used only in absolute links.
    root = "main",
  }
  ```

- _If-else nodes_: A Lua array with the first element being function.

  ```lua
  IfElseNode = {
    -- The if-else condition.
    function() return score = 100 end,
    -- [optional] The if branch, executed when the condition yields true.
    { {}, "Wow, you scored 100!" },
    -- [optional] The else branch, executed when the condition yields false.
    { {}, "Keep going!" },
  }
  ```

- _Function nodes_: A Lua table representing a Lua function call.
  It can do almost anything with the provided API (more on that later).

  ```lua
  FunctionNode = {
    -- The function. The args argument is a path to the args node.
    -- In this example, it simulates a switch-case statement.
    func = function(args)
      if a == 1 then
        IP:set(args:resolve(2))  -- Go to Branch 1
      elseif a == 2 then
        IP:set(args:resolve(3))  -- ...
      elseif a == 3 then
        IP:set(args:resolve(4))
      elseif a == 4 then
        IP:set(args:resolve(5))
      end
    end,
    -- [optional] Arguments to the function.
    args = {
      {},
      { {}, "Branch 1" },
      { {}, "Branch 2" },
      { {}, "Branch 3" },
      { {}, "Branch 4" },
    },
  }
  ```

### Interpreter

#### User API

The interpreter provides the following API to its users:

- `current`: Returns the (cached) current line (or selection options).
  Actually it should be able to return literally anything, as long as the user wishes it to.
- `next`: Returns the next line and advances the IP (instruction pointer).
  The returned data is cached (and kept in save point data) to make the `current` function idempotent.
  It is also where user input should goes.
  - `fetch_and_next`: Returns the line (or `nil`) and advances the IP. Internally used by `next`.
    The difference is that it returns `nil` on non-text nodes, when the caller should call again to continue searching for a text node.
    The user may invent their own `next` by creative usages of `fetch_and_next`.
- `set_gettext`: Sets the `gettext` handler to translate texts.
- `save`: Returns the game state as a string.
- `load`: Loads the game state from a string (usually generated by `save`).

#### Story File API

The Lua story file is run under a crafted Lua environment, which:
- Provides some Lua functions like `tonumber` and `type`,
- Enables automatically saving global variables,
- Allows the story file script to specify paths as `label_1.label_2`,
- Provides a series of game state retrieval / manipulation API:
  - `IP`: The current IP. One may modify the `IP` to literally jump to anywhere.
  - `VM`: The VM (virtual machine) instance.
  - `EVAL`: Evaluates a node.
  - `SET`: Attaches data to a certain node.
  - `GET`: Retrieves attached data.
  - `T`: Translates the supplied string with `gettext`.
  - `GOTO`: Well, `goto`.
- Provides some useful modules, like `math` in Lua or the built-in function node module `FUNC`,
  - `FUNC.SELECT`: The default function used at a selection node, where a list of options is returned, requesting user input.
    It applies patches to the Lua environment before evaluating things:
        - `CHOICE_COUNT` is set to the currently available choices.
    - `VISITS` is set to the visited count.
    - `ONCE` is set to true if and only if the option is never visited before.
  - `FUNC.S_ONCE`: Similar to `FUNC.SELECT`, but each option shows only once, unless `RECUR` is used. It too, manipulates the environment.
    - `RECUR` is... complicated. It just yields true and makes the option recurs.
- Provides some utility functions:
  - `TURNS`
  - `TURNS_SINCE`
  - `LINES`
  - `VISITED`

Overriding these global variables are forbidden.

##### `FUNC.SELECT`

It accepts an extra integer `recur` argument.

- When `recur` is `true`, `RECUR` is a function:
  - `RECUR(0)` returns true if the branch is never visited before. (It is just `ONCE`.)
  - `RECUR(n)` returns true if the branch is visited no greater than `n` times.
- When `recur` is set to `n`, all branches are visited at most for `n` times, unless `RECUR` is specified.
  - `RECUR` is still that very function. However, by using `__index`, we get to know if the user is using the `RECUR` condition.
    If the script ever requests `RECUR`, the `n`-times limit is lifted.

#### Internals

Classes:

- `TablePath`: Similar to JSON Path, it is Lua-table-path.
  When iterating through the story file, it automatically steps through the elements in order.
  When stepping onto an array, it automatically enters the array to find an actual element.
- `StackedEnv`: The Lua environment provider, allowing (relatively) easy manipulation of the environment of the story file.
- `VM`: The virtual machine, which the most functionalities lie.

Utility modules:

- `lookup`: A module converting a hierarchical label path into a `TablePath`.
- `savedata`: Saves and loads Lua tables.
- `history`: Saves history and user-attached values.

##### `fetch_and_next`

The main "game loop".

1. If the current IP already points to the end of the story, returns.

   However, the end of a story is exactly the start of it,
   and this adds a bit to the initialization of the VM.

2. Fetches the current node (without any evaluation).

   Well, since we allow lazily loading root nodes, here is where we load the root node (if it is not yet loaded).

   Also, the current node should never be an array. (Just keep reading.)

3. Advances the IP.

4. Does things according to the node type:

   - _texts_: Just returns it (with translation and string interpolation applied).
   - _links_: Jumps.
   - _if-else_: Evaluates and jumps.
   - _functions_: Calls the function.

5. Adjusts the current IP so that it never points to an array.
   If the story ends here, this should make IP point to an root node, signifying the end of a story.

##### Provided Lua environments

1. After Lua 5.2, the `setfenv` function is officially removed, and we cannot change a function's environment
   freely (at least without the use of the `debug` module). Therefore, the only way we can bind an environment
   to a function while maintaining compatibility through Lua 5.x is when it is loaded with `load`.
   So, throughout the VM lifetime, we have to reuse the same environment instance, requiring us to make
   heavy use of the `__index` and `__newindex` meta-methods. (Thanks to them, we can precisely achieve what
   we want (with quite a bit of work) as is described below.)

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
   lazily.

7. Thread-locals and function-locals (or just function parameters) are quite instinctive and are **saved** along
   the thread.

Procedure:

1. Loading Lua files (*Lua scope*): Global variable writes goes to the Lua scope.
2. Loading save data: Writes to a new global scope, local scopes for each file and the label statistics.
3. Running functions (*Lua*, *global*, *file-local*, *label*, *thread*, *function*):
   - Reads: Looks up things from inner scopes to outer ones.
   - Writes: Looks up from inner to outer, excluding the Lua scope and the label scope.

##### Save Data

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
    stats = {
        file1 = {
          { I = 5, R = { 1 } },
          {
            { I = 3 },
          },
        },
    },
    globals = {
        globalVariable = 1,
    },
}
```

#### History API

Before explaining the history API, we should first define "history".

- Case 1:
  - Line 1
  - Line 2 <-- A user created a save point after reading this line
  - Line 3
  When the savedata is read, the user should expect to be taken back right before "Line 2" is displayed.
  - (((The actual save point)))
  - Line 2
  - Line 3
  Therefore, IP should not advance until the user confirms that they wants to read another line.

- Case 2:
  - Line 1
  - Function call that modifies variables
  - Line 2 <-- save point
  Function calls or anything that may modify the game state should always advance IP (or set some flags)
  to prevent calling them for multiple times.
  Template texts are special, since they calls functions but are stil text lines,
  which makes cache necessary to ensure idempotence.

- Case 3:
  - Selection (user input required) <-- save point
  - Line 2
  Loading the savedata should show the same selection, while the selection API changes states.

So the design decision here is to introduce a cache.

```lua
function current()
  if not cache then
    cache = advance_ip()
  end
  return cache
end
function next()
  -- ...
end
```

And the cache might have something to do with our history tracking:
should cached entries be marked as read?
Either is fine, but we need to be consistent throughout.
Currently, cached entries are marked as read, just for coding convenience.

To avoid saving too much stats in the history, only read counts of array nodes are kept.
History of other nodes (strings, etc.) are kept in a bitset, where read entries are marked as true.

##### If-else flags

If-else nodes writes to some internal flags, which the `FUNC.SELECT` function uses to know whether a node fails evaluation.
