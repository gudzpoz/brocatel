# Caveats

## Headings_and Links

In some Markdown processors (that convert Markdown into HTML),
headings get unique HTML `id`s that serve as page "anchors",
which links can then refer to with `#id-of-a-heading`.
This is exactly why we choose to use headings and links to "jump" within stories -
it is in sync with how you jump back and forth in an HTML page.

### Generated Anchors in HTML Documents

However, in most processors, the generated `id` usually differs a bit from the actual heading.
The following example is extracted from [`github-slugger`](https://github.com/Flet/github-slugger),
which we use to generate our anchors:

```markdown
# foo
[](#foo)

# Привет non-latin 你好
[](#привет-non-latin-你好)

# 😄 emoji
[](#-emoji)
```

It removes the quite a lot characters, but we are more interested in what gets preserved:
- Any letter under the `Letter` category,
- Any mark under the `Mark` category,
- Any normal numbers other than [Other Numbers](https://www.compart.com/en/unicode/category/No),
- All [connectors punctuation](https://www.compart.com/en/unicode/category/Pc),
- Any alphabetic characters,
- The space character ` ` (`0x20`) and hyphens `-` (`0x2d`).

After that, it replaces all spaces ` ` with hyphens.

### Generated Anchors in Brocatel

I really can't remember those rules and I don't think that a system should require its users to do so.
Therefor, we also transform all the links in the documents,
so that users just don't need to be concerned about the charsets or any other string replacements:

```markdown
# foo
[](#foo)

# Привет non-latin 你好
[](<#привет non latin 你好>) or [](#привет-non-latin-你好)

# 😄 emoji
[](#😄-emoji)
```

However, it can become a problem when the user wants to use anchors in Lua code:
obviously (due to how Lua recognizes its symbols) `a word with space` is treated
as four separate words and it won't really serve as a symbol.

To simplify things a bit, we allow using `a_word_with_space` to refer to the `# a word with space` heading.
However, again, this won't work with languages with non-ASCII daily letters,
and the user will need to use `ROOT`:

~~~markdown
# Привет non-latin 你好
[](#привет-non-latin-你好)
```lua
привет_non_latin_你好 -- Not an indentifier.

ROOT["привет-non-latin-你好"] -- This somehow works.
```
~~~

Here comes a third caveat: Lua has poor regex and Unicode support,
which means, it is hard to keep compiler rules (TypeScript) and runtime rules (Lua) in sync:

~~~markdown
# 你好，世界！
[](#你好世界) or [](#你好，世界！)
```lua
ROOT["你好世界"]      -- This works.
ROOT["你好，世界！"]  -- This does not.
```
~~~
