# Brocatel - Markdown Extensions

This project contains some remark extensions used by [Brocatel](https://gudzpoz.github.io/brocatel/),
a story scripting language with Markdown syntax.

## Extensions

### [directive.ts](./src/directive.ts): Directives

The [`remark-directive`](https://github.com/remarkjs/remark-directive) is not really usable in Brocatel:
the syntax of it makes nesting structures quite difficult:

```markdown
:::outer
- List

  :::inner
  Inner
  :::

  Guess what? The `outer` directive ends at the `:::` line right above.

::: <- Useless
```

We ensure the ease of nesting structures by reusing list semantics:
a directive is just a list with a `:::` heading.
In this way, we can nest things quite easily - all Markdown parsers already do that for lists.

Inline directives are fine.

### [mdx](./src/mdx.ts): MDX Expressions

[`remark-mdx`](https://github.com/mdx-js/mdx/tree/main/packages/remark-mdx)
expects the expressions to be JS expressions, while we use them as Lua ones.
So this extension simply serves to avoid those JS syntax checks.
