# Story Functions (draft)

In programming lanuages, we call them "functions".
In Ink, they are called "tunnels".
But anyway, this kind of structure allows you to reuse stories quite efficiently.

```markdown
# Main Story
[{ "John" }](#greet-name)
---

## greet {name}
Hello {name}!
---
```

## No Fallthrough

In normal stories, headings does not stop the story flow:

```markdown
Line 1.
# any heading
Then Line 2.
```

But functions require explicit jumps / calls:

```markdown
Line 1.
<!-- The story ends here -->
# any heading {}
Never.
```

Also, a function automatically returns at the end of it:

```markdown
Line 1.
[{ money = 10 }](#side-story)
Line 3.
<!-- The story ends here -->
# side story {money}
Money: ${money}.
<!-- Then it returns to "Line 3". -->
```

The above story yields `Line 1`, `Money: $10` and then `Line 3`.
