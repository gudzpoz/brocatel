# Advanced Choice Usages

## `RECUR`

There are two kinds of *lists* in Markdown:

1. This is an *ordered* list.

- And this is an *unordered* one.

Ordered ones recurs: the player can choose a one more than once;
unordered ones, on the other hand, are one-time-only choices.
You will probably want a `DEFAULT` branch for one-time-only choices.
Otherwise, the script will just loooooooop. 

<md-example>

```markdown
:::loop
- - One
  - Two
  - Three
  - Four
  - `DEFAULT` ENDED

    ---
```

</md-example>

You can have granular control over this using the `RECUR` API:

<md-example>

```markdown
:::loop
- - `RECUR(0)` One
  - `RECUR(1)` Two
  - `RECUR(2)` Three
  - `RECUR(3)` Four
  - `RECUR` Always shown
```

</md-example>
