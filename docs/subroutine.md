# Story Subroutines

In programming lanuages, we call them "functions".
In Ink, they are called "tunnels".
But anyway, this kind of structure allows you to reuse stories quite efficiently.

:::warning
However, most stories just don't follow the typical "function" structure:
they don't *return* properly.
This currently usually leads to unexpected results.

Also, the current WYSIWYG widget does not support calling subroutines.
:::

## Basic Syntax

As you have learnt from [the tutorial](./tutorial.md), Brocatel lets you organize your stories with `# headings`,
and you can jump to those headings by using `[some links to](#headings)`.
A subroutine is a part of stories that start with some special headings: `# subroutine { args }`.
And to use the subroutine, one uses a special kind of link: `[{ arg = value }](#subroutine)`.

<md-example>

```markdown
# Main Story

Statistics:

[{ money = 10 }](#stats)

Done!

---

## stats {money}

Budget: ${money}!

---
```

</md-example>

In the example above, a `## stats` subroutine is defined (which accepts a `money` parameter),
and we jump to the subroutine with a link `[{ money = 10 }](#stats)`,
which also sets the requested parameter `money` to `10`.
The story outputs three lines:
- `Statistics:`
- `Budget: $10!`: The story flows to the subroutine after the link.
- `Done!`: The story flows back to the main story! It resumes the story after the link.

## No Fallthrough

In normal stories, headings stop the story flow - we want the users to be explicit about story flow changes so as to avoid errors.
And functions require explicit jumps / calls too.


<md-example>

```markdown
Line 1.

# any heading

Special case: the first heading is OK - the meaning is explicit enough - it is a starting point.

## heading 2

Then no Line 3.
```

</md-example>

<md-example>

```markdown
Line 1.
<!-- The story ends here -->
# any heading {}
Never.
```

</md-example>

Also, a function automatically returns at the end of it,
and you may explicitly return with thematic breaks (a single line containing only `---`).

Function calls allows passing values that are only effective inside a certain function.

<md-example>

```markdown
`from = "outside"`
From(1): {from}
[{ from = "foyer" }](#west)
From(5): {from}

# west {from}
From(2): {from}
[{ from = "the west" }](#south)
From(4): {from}

# south {from}
From(3): {from}
```

</md-example>

:::info
It is a bit different from function parameters in programming languages.
But since it is just a draft, I am not going into detail here.
:::
