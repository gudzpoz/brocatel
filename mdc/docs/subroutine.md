# Story Subroutines (draft)

In programming lanuages, we call them "functions".
In Ink, they are called "tunnels".
But anyway, this kind of structure allows you to reuse stories quite efficiently.

:::warning
However, most stories just don't follow the typical "function" structure:
they don't *return* properly.
This currently usually leads to unexpected results.
:::

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

## No Fallthrough

In normal stories, headings does not stop the story flow:

<md-example>

```markdown
Line 1.
# any heading
Then Line 2.
```

</md-example>

But functions require explicit jumps / calls:

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
