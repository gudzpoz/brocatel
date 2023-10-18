# The Tutorial

:::danger
Many many things in this tutorial can be outdated since we are still rapidly updating things and changing the syntax.
:::

Brocatel lets you write interactive stories (choice-based interactive fictions) in [Markdown](https://en.wikipedia.org/wiki/Markdown).
It itself is written in [Lua](https://en.wikipedia.org/wiki/Lua_(programming_language)) and should run on almost every platform.
And that means you can try things out in your browser, right in this web page, in any of the examples below, interactively.

You may try things out in the following widget:

<md-example height="15em">

```markdown
Type something here!
```

</md-example>

:::info
If you've heard a bit about Markdown, you will know that it is a plain text markup language,
which usually means the user will need to learn about the meanings behind `**bold** and *italics*`
or `` `code` and [links](http://url)``.
They are not that hard to learn, but may still pose a challenge for users not really into plain text markups.
To make things easier, here we use a [WYSIWYG](https://en.wikipedia.org/wiki/WYSIWYG) editor by default.

If you prefer a plain text one, click on the "🗒️" checkbox in the editor.
:::

## Texts

Texts are texts.

:::info
Since Markdown is a markup language, it has built-in support for *italic* or **bold** texts.

- To make texts italic, use the "_Italics_" button in the widget or try typing in `_italics_`.
- To make texts bold, use the "**Bold**" button, or try typing in `**bold**`.
:::

<md-example height="15em">

```markdown
Hello World!
_italics_
**bold**
```

</md-example>

### Tags

You may tag texts with brackets like `:narration` or `:color[red]`.
Tags means nothing on their own - they are merely information attached to a paragraph.
But if you are looking to integrate your story into a larger game,
where you want to specify where your texts are positioned, what avatars to display, etc.,
you will very likely need to tag your texts to provide the information
and have other parts of the game interpret those tags accordingly.

In our widgets here, we choose to intepret tags as [CSS](https://en.wikipedia.org/wiki/CSS) styles,
which allows you to, for example, make texts <span style="color: red">red</span>.

<md-example height="20em">

```markdown
But you don't stop. You don't even slow down as you fly into the intersection, and the light stays an unmistakable red...

:background-color[red] :color[black] :text-align[center] **RED**

(Quoted from Photopia ([https://ifdb.org/viewgame?id=ju778uv5xaswnlpl](https://ifdb.org/viewgame?id=ju778uv5xaswnlpl)).)
```

</md-example>

## Choices

Brocatel uses Markdown lists to represent choices.

The first lines in list items are presented to the player as choices.
When the player chooses one, the story will flow to that list item and continue there.
If the story reaches the end of a choice branch, it will then flow to lines that goes after that Markdown list,
thus allowing nesting choices.

<md-example height="40em">

```markdown
*   Enter the foyer.

    You enter the foyer of the Opera house.

-   Go north.

    No. You've only just arrived, and besides, the weather outside seems to be getting worse.

-   Go west.

    The walls of this small room were clearly once lined with hooks, though now only one remains.

    - Examine the hook.

      You examine the hook.

    - Hang your cloak on the hook.
      
      You hang your cloak on the hook.
```

</md-example>

## Controlling Story Flow

Brocatel lets you control the story flow with Markdown headings and Markdown links.

To put it simply, to make the story flow to a heading, one uses a link with a anchor corresponding to that heading.

### Headings

Markdown headings, in their plain text forms, start with hashes (`#`).
For example, `# heading 1` means a first level heading named "heading 1",
while `## another heading` means a second level heading named "another heading".

With headings, you may organize your stories into chapters, sections, or any segments.
Headings will not show up in the story output.

<md-example height="12em">

```markdown
Try starting a new line and typing `# another`!

# heading
```

</md-example>

In the example widget above, you will notice that the editor part of the widget displays the heading weirdly
as something like "**## heading 2** [#heading-2](#heading-2)📋":

- The "**## heading 2**" part is the real heading, while
- "[#heading-2](#heading-2)" is the *anchor* name of the heading, and
- clicking on "📋" copies the "#heading-2" anchor to your clipboard.

You will need to use that anchor name in your links to make the story flow to that heading.

:::info Why not just use headings instead of some random heading anchors?
Most of links (whether in Markdown or not) link to web pages, which use anchors to locate things.
To make things worse, web anchors disallow whitespaces and recommend using ASCII characters only,
and "heading 2" is simply not a valid anchor.

We don't want to deviate too much from the current Markdown implementations out there, most of which
follow the web page anchor specification and replace whitespaces with hyphens (`-`).
:::

### Links

Markdown links usually contain two pieces of information: link text and the link itself.
Markdown uses `[link text](the-link-itself)` to indicate a link:

- [A link to Wikipedia](https://wikipedia.org) in Markdown is just `[A link to Wikipedia](https://wikipedia.org)`.

In Brocatel, we currently don't care about the text part too much - any text is fine as long as it is valid Markdown
(that is, in this tutorial, it looks fine in the interative editor).
The real link part matters though, as it controls where the link leads the story.

<md-example height="30em">

```markdown
*    Go north.

     [this link leads to #north](#north)

*    Go west.

     [this link leads to #west](#west)

# north

No. You've only just arrived, and besides, the weather outside seems to be getting worse.

# west

The walls of this small room were clearly once lined with hooks, though now only one remains.
```

</md-example>

We also display links quite differently as something like "[[this link leads to #west]](#west)(<u>#west</u>)🔗".
You may edit the "<u>#west</u>" part to make the link lead to story to elsewhere as long as there is a corresponding heading.

:::info Link explicitly
Brocatel assumes that each heading marks the start of a brand new section,
and thus never automatically flow the story onwards when it reaches the end of a section.
You will need to link to those headings manually if you want the story to flow across sections.

<md-example height="18em">

```markdown
# start
Without `[a link](#new_section)`.
# new section
The story never reaches here.
```

</md-example>

You may notice that we don't need a link to flow to the `#start` heading,
and it is because we think it is quite unambiguous (you don't want an empty story right?).
:::

## Conditional Branches

Sometimes you will want to vary your texts or choices depending on the player's previous actions.
We use Markdown inline code snippets for that.
Don't panic! It has very little to do with actual coding:

<md-example height="30em">

```markdown
- Examine yourself.

  # examine_self

  You are wearing a handsome cloak.

- Do nothing.

* `VISITED(examine_self)` Hang your cloak on the hook.

  You hang your cloak on the hook.

* Do nothing.
```

</md-example>

In the example above, the player can only hang their cloak on the hook if they have examined themselves.
This is achieved by putting an code snippet in the very front of a line (try using the `` `Code` `` button).

Only if the story has ever flowed to the `#examine_self` heading (so the story has "VISITED" "examine_self"),
will the "Hang your cloak on the hook" choice be presented to the player.

You can also use this for normal texts:

<md-example height="18em">

```markdown
- Examine yourself.

  # examine_self

`VISITED(examine_self)` You have examined yourself.
```

</md-example>

## Variables

If you have a line that contains only an inline code snippet, Brocatel treats it as an arbitrary Lua statement,
which means you can actually do anything you like from customizing Brocatel to crashing it.
But as a tutorial, we only talk about the most simple Lua statements here: variable assignment.

In the following example, we assign the player's favorite animal to the variable `favorite_animal`
by doing `favorite_animal = "cats/dogs"`.
(Note the quotation marks (`"`), which tells Lua to treat it as text.)
You may use variables in conditionals or simply put it in texts by using the `{Expr}` button and filling in the correct variable names.

<md-example height="21em">

```markdown
- Cats.

  `favorite_animal = "cats"`

- Dogs.

  `favorite_animal = "dogs"`

Oh, I love {favorite_animal} too!
```

</md-example>

