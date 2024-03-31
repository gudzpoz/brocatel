# Brocatel Markdown Grammar Spec

## Texts

- Usage: Same as texts in Markdown: if the text does not match any spec below,
  then it is a text.
- Semantics: Texts.

## Comments

- Usage: Similar to HTML/XML comments since Markdown does not provide a comment grammar.
- Semantics: Comments.

  - `<!-- comment -->`.

  - One may also use Lua comments in Lua code blocks if they find it convenient:

    `` `-- comment` ``

    ~~~markdown
    ```lua
    --[[
      comment
    ]]--
    ```
    ~~~

### Tags

- Usage: Prefixes the text with an inline directive to tag the text.
- Semantics: Attaches extra info to the text to be used by external programs.

  - `:tag Text`.
  - `:tag[value] Text`.

### Interpolation

- Usage: Use Lua code in MDX expressions to interpolate the text with Lua values.
- Semantics: The MDX expression is evaluated in the context of the current routine.

  - `1 + 1 is { 1 + 1 }` evaluates to `1 + 1 is 2`.

### Marking Plural Variables For Gettext

- Usage: Adds a `?` in the MDX expression to mark the variable that affects the plural forms of words in the text.
- Semantics: The variable is marked for Gettext for easier I18N.

  - `You have { 1 + 1 ?} apples.` will generate a `msgid_plural` entry in the POT file so that
    the translation can be done in a better way.

## Headings

- Usage: Same as headings in Markdown.
- Semantics: A heading defines an anchor that a link can jump to.

### Routine Definitions

- Usage: A heading that contains a MDX expression.
- Semantics: A routine definition defines a routine.
  The string in the MDX expression is treated as routine-local variable names.

  - `## heading 1 {}` defines a routine named `heading-1`.
  - `## heading 1 { var1 }` defines a routine named `heading-1` with a routine-local
    variable `var1`.

## Links & Routine Calls

- Usage: Mostly the same as links in Markdown.

  If the link looks like a "normal" link (e.g. begins with `https`), the compiler
  treats the link as it.

- Semantics: A link either directs the story flow to a certain heading or calls a routine.

  - `[](#heading-1)` jumps to the heading `heading-1` if the heading is not a routine.
    Otherwise, it calls the routine `heading-1`.
  - `[{ var1 = 1 }](#heading-1)` calls the routine `heading-1` with the routine-local
    variable `var1` set to `1`.
  - `[](another.md#heading-1)` similarly calls/jumps to story in `another.md` with the heading `heading-1`.
    This allows splitting a story into multiple files.
    No manual file linking is needed.

## Lua Evaluation

### Compile-Time Evaluation

- Usage: A code block with its meta string set to `macro`.
- Semantics: The code block is evaluated at compile-time to extend the compiler with macros, etc.

  - For example,

    ~~~markdown
    ```lua macro
    function hello_world()
      return md.paragraph({ md.text("hello world from a macro") })
    end
    ```
    ~~~

    defines a macro `hello_world` that returns a Markdown paragraph with the text.

### Runtime Evaluation

#### Global Lua Evaluation

- Usage: A code block with its meta string set to `global`.
- Semantics: The code block is evaluated at runtime when loading the story.

  - For example,

    ~~~markdown
    ```lua global
    player_name = "Alice"
    initial_score = 0
    ```
    ~~~

    initializes the global state.

#### Local Lua Evaluation

- Usage: Inline code snippets on a single line or Lua code blocks.
- Semantics: These Lua code is run when the story passes through the code block.

  - `` `v = 1` `` sets the variable `v` to `1`, which is the same as:

    ~~~markdown
    ```lua
    v = 1
    ```
    ~~~

#### Conditional Execution

- Usage: A paragraph starts with a inline code snippet, following by texts.
- Semantics: The snippet is evaluated as Lua code, and if the result is true, the paragraph is show as texts.

  - `` `score == 100` You win!``

    If the variable `score` is equal to `100`, the paragraph is shown.

#### Lua Runtime Environment

See [arch.md](./arch.md).

## Macro Usage

- Usage: A customized Markdown grammar:

  ~~~markdown
  :::macro_name `extra info`
  - Macro specific argument 1
  - Macro specific argument 2
  - ...
  - :::nested_macro
    - Correct indentation is needed.
  ~~~

#### Built-In Macros

The `if`, `do`, `local` and `nil` macros are implemented by the JS/TS compiler,
whose names are intentionally selected be Lua keywords
to avoid conflicts with the user-defined macros.

- `if`: Extended form of the `` `condition` Text. `` grammar with an `else` branch.

  ~~~markdown
  :::if `score == 100`
  - You win!
  - You lose. (The else branch here.)
  ~~~

- `do`: Calls a Lua function, passing the arguments specified in the list.

  ~~~markdown
  :::do `function_name`
  - Argument 1
  - Argument 2
  ~~~

- `local`: A quoted block of text, useful to avoid conflicting heading levels, mostly used by macros.

  ~~~markdown
  # heading-1
  :::local
  - # heading-1
    No heading name conflict.
  - :::local
    - Nesting allowed.
  ~~~

- `nil`: Ask the compiler to treat the arguments as plain Markdown.

  ~~~markdown
  :::nil
  - `this is no more Lua expression but a Markdown code snippet`
  ~~~

The following macros are also built-in macros, but instead implemented in Lua
as examples of custom macros. See `mdc/src/macros/builtin.lua` for details.

- `loop`: Repeatedly executes part of the story.

  ~~~markdown
  :::loop `label`
  - Text 1.
  - Text 2.
  ~~~

- `switch`: Evaluates an expression, and executes the corresponding case.

  ~~~markdown
  :::switch `a = 100`
  - `a == 0`
    Result: 0
  - `0 < a and a < 100`
    Result: 1~99
  - `a == 100`
    Result: 100
  ~~~

## Threads & Coroutine Grammar

### Coroutine

- Usage: Use `> [](#routine)` to create a coroutine.

  If a coroutine runs to the end, one of the remaining threads will be selected as the next thread to run.
  If there is none, the story ends.
