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
- [X] Links.
  - [ ] Compile-time link validity checking.
- [X] Options.
  - [ ] Rework to allow show-once options.
- [X] Function calls.
- [X] Labels.
  - [ ] Compile-time label validity check.
- [ ] Macros.

### `v0.3.0`

#### Runtime API design.

- [ ] API naming convention (maybe all-capital to avoid name conflicts with user labels).
  - [X] Make API values read-only.
- [X] IP (instruction pointer) access.
- [X] Label access counter.
- [X] Show-once options, show-forever options and show-N-times options.
  - [X] Data save API (allow functions to attach data to the current IP or any path).
- [X] Add caching layer.
  - [X] Cache output to provide idempotency.
  - [X] Cache user input.

#### Integration examples

- [ ] Save & load.
- [ ] Fast-forward (skipping only texts that users have read).
- [ ] Complete porting The Intercept, which is a little bit lengthy.

### `v0.4.0`

Multi-thread (not *those* threads) support:

- [ ] Multi-thread API design.
- [ ] Multi-thread API implementation and thread-local variable support.
- [ ] Story call and local variable support.
- [ ] Coroutine support.

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
- [ ] Porting [Cloak of Darkness](Cloak of Darkness).
- [ ] Follow suit: [Tutorial for Ink](https://www.inklestudios.com/ink/web-tutorial/) (better still if interactive).
- [ ] IDE implementation (or probably just a VS Code plugin with language server protocol implementation).

## `v1.0.0`

Let's start [Semantic Versioning](https://semver.org/).