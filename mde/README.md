# mde - Brocatel Markdown Editor

This is a WYSIWYG-style Markdown editor implemented with Milkdown (and its underlying prosemirror).

## Implemented

It integrates support for:

- MDX Expressions: What Brocatel uses to allow string interpolation like `I have {apple_count} apples.`.

  Actually, real MDX lets you write JavaScript in the curly brackets, but we require Lua expressions.

- Directives (simplified): The macro system entry point, e.g. `:::loop` and `:::if`.

  The Markdown community has come up with a [
Generic directives/plugins syntax proposal](https://talk.commonmark.org/t/generic-directives-plugins-syntax/),
  on which Brocatel bases its macro system.
  The syntax has not finalized yet (nor does it look rigorous enough) and the main problem here is
  its poor support for nesting: marking hierarchy with decreasing numbers of colons is just disastrous.

  We have to come up with alternatives, and here we are:

  ```markdown
  :::loop
  - :::if `has_apple`
    - Eat the apple.
      `has_apple = false`
    - Get an apple.
      `has_apple = true`
  ```

- Better link editing: Allow the user to edit targets of links directly.

- Better heading display: Show the anchor id of any heading.

## Maybe Later

- [ ] Link target autocomplete.
- [ ] Lua highlighting.
- [ ] Lua code autocomplete.
- [ ] Bug fixes.
