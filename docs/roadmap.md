# Brocatel Roadmap

## `v0.X.X`

We do not plan to follow [Semantic Versioning](https://semver.org/) at this stage,
since drastic change in our Markdown grammar is expected (and personally I don't feel like large commits).

### `v0.1.0`

Single-threaded virtual machine implementation:

- [X] VM skeleton with delayed root node loading and array walking capabilities.
- [X] Label and link support in the VM.
  - [X] A label should also serve as a text pointer.
- [X] Global environment and if-else call support.
- [X] Function call support.
- [X] Tagged text support and Gettext API design.
- [X] User input (options) support.
- [X] Save data saving & loading.

### `v0.2.0`

Markdown compiler implementation:

- [X] Plain text nodes.
- [X] Tagged text nodes.
  - [X] Tag data interpolation.
- [X] Links.
  - [X] Compile-time link validity checking.
- [X] Options.
  - [X] Rework to allow show-once options.
- [X] Function calls.
- [X] Labels.
  - Compile-time label validity check: No need since we check links?
- [X] Macros.
- [X] Debug info generation.

### `v0.3.0`

#### Runtime API design.

- [X] API naming convention (maybe all-capital to avoid name conflicts with user labels): ALL CAPITALS & some Lua reserved words.
  - [X] Make API values read-only.
  - [ ] More API.
    - [X] `BREAK` or `EXIT` or **`END`** for loops.
      ```markdown
      :::loop `loop_name`
      - A
        `END(loop_name)`
      ```
      - [X] Syntax sugar: `---` for `END()` (we are going to use it for function calls)
    - [ ] Search for TODO in [arch.md](./arch.md).
- [X] IP (instruction pointer) access.
- [X] Label access counter.
  - [X] Label fuzzy lookup.
    ```markdown
    # Markdown Examples
    [](#markdown-examples)
    ```
    (This allows running `README.md` from most repositories.)
  - [X] Exclude normal links like `[Wikipedia](https://...)`.
- [X] Show-once options, show-forever options and show-N-times options.
  - [X] Data save API (allow functions to attach data to the current IP or any path).
- [X] Add caching layer.
  - [X] Cache output to provide idempotency.
  - [X] Cache user input.
- [X] IFID: use frontmatter to include [IFIDs](https://www.ifwiki.org/IFID) for stories.

#### Integration examples

- [ ] Save & load.
  - [X] API.
  - [ ] Examples? Or detailed Lua documentation.
- [ ] Fast-forward (skipping only texts that users have read).
  - [ ] Instead, we should probably export read counts along with the lines
    to let the user / the outer game engine decide whether to skip lines
    (or even display some relevant text / highlighting).
- [ ] Complete porting The Intercept, which is a little bit lengthy.

### `v0.4.0`

Multi-thread (not *those* threads) support:

- [ ] Multi-thread API design.
  - [X] Replace the quote grammar (`> text`) with a macro (maybe named `then`?).
  - [ ] Use `>` to signify thread-related operations.
- [ ] Multi-thread API implementation and thread-local variable support.
- [ ] Story call and local variable support.
  - [X] Function stack: call and return.
  - [X] Tail call support: jump to elsewhere, popping up a stack frame.
  - [ ] Compiler error: forbid jumping from inside of a function.
- [ ] Coroutine support.
  - What about structured concurrency?

Some clarifications:
- With **threads**, you may build games (with *lots* of tweaks, of course) like
  [428: Shibuya Scramble](https://en.wikipedia.org/wiki/428:_Shibuya_Scramble),
  where multiple threads of stories interweaves.
- With **coroutines**, you may construct conversations where people talk about
  multiple things simultaneously, just like
  [*threads* in Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md#2-threads).
- **Story calls** are just function calls for plots.

### `v0.5.0` and on

Bug fixes and Markdown grammar optimization.

Documentation, tutorials, etc.

- [ ] Porting [The Intercept](https://github.com/inkle/the-intercept/blob/master/Assets/Ink/TheIntercept.ink).
- [X] Porting [Cloak of Darkness](./cloak.md).
- [ ] Follow suit: [Tutorial for Ink](https://www.inklestudios.com/ink/web-tutorial/) (better still if interactive).
- [ ] IDE implementation (or probably just a VS Code plugin with language server protocol implementation).
  - [X] Simplistic LSP implementation detecting compilation errors.
  - [ ] Using Lua LSP for Lua checking & completion.
  - [X] Executing stories right from VS Code.
    - [X] Highlighting runtime errors in the Markdown source code.
  - [ ] Simplistic debugging interface by implementing the Debug Adapter Protocol.
    - [ ] Stepping.
    - [ ] Breakpoints.
    - [ ] Pause/continue/stop/restart.
    - [ ] Lua variables.
  - [ ] Allow exporting stories into a single web page to be exported online.
- [ ] Frontend implementation, so that one can easily publish their IF online.
  - [ ] Choice-based stories.
  - [ ] A bit parser-like frontend.

## `v1.0.0`

Let's start [Semantic Versioning](https://semver.org/).
