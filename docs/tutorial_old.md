# Brocatel Tutorial

This somehow serves as a tutorial for Brocatel.

You don't need to download anything to start writing in brocatel.
Every example below contains the story preview as well as an online editor,
with which you can edit the story in place and learn about its outcome.

If you feel like a complete example, here is an example of [Cloak of Darkness](./cloak.md).

## Markdown

Brocatel lets you write your stories in [Markdown](https://en.wikipedia.org/wiki/Markdown).
However, this tutorial assumes no prior knowledge in Markdown,
which is a simple format that one can learn in minutes.

Here is an example story, just enough to demonstrate how Markdown marks up the text.
(You may skip it if you feel confident enough though.)

<md-example>

~~~markdown
:::nil
- ### A Brief Introduction To Markdown

# heading

- Styled texts
  Italics: just put a pair of `_`, or `*` around the text, like _italics_ (`_italics_`).
  Similarly, one can use `**bold**` or `__bold__` to mark the text as **bold**.
- Headings
  Markdown headings are identified by the hash symbol `#`.
  The following example shows how ones writes different levels of headings:
  ```markdown
  # Level 1 heading, titles?
  ## Level 2 heading, chapters?
  ### Level 3 heading, sections?
  ```
  In normal Markdown documents, they looks like:
  :::nil
  - ### Level 3 heading, whatever
  - #### Level 4 heading
  - ##### Level 5 heading
  - ###### Level 6 heading
  - ####### There is no level 7.
- Links
  Markdown uses `[Text](http://link.goes/here)` for links.
  A link usually refers to a web page. For example, this link [`[Wikipedia](https://en.wikipedia.org/)`](https://en.wikipedia.org/) leads to the Wikipedia.
  One may use *anchors* to refer to headings. Clicking [`[this link](#markdown)`](#markdown) takes you right back to that header.
- Images
  ![A throbber (not throbbing) displayed on the original image of a cat, captioned "102 Processing"](https://http.cat/images/102.jpg)
  (Is the image ready yet? You might have to wait a few seconds...)
  OK! This is how you put an image in your Markdown documents: `![Alt text to help visually impaired readers](link to the image)`.
  - More cat images here.
    From [HTTP Cats](https://http.cat/).
    ![A cat smelling a herb, captioned "420 Enhance Your Calm"](https://http.cat/images/420.jpg)
    ![A round, flying cat, captioned "100 Continue"](https://http.cat/images/100.jpg)
  - `RECUR` No thanks.
- Lists
  Feel like keeping things ordered / unordered?
  1. An ordered list please
     ```markdown
     1. Item 1
     2. Item 2
     3. Item 3, and so on
     ```
     :::nil
     - 1. Item 1
       2. Item 2
       3. Item 3, and so on
     You may also start an ordered list with `1)`.
  2. An unordered one
     ```markdown
     - Item 1
     - Item 2
     - Item 3, and so on
     ```
     :::nil
     - Item 1
     - Item 2
     - Item 3, and so on
     You can start lists with either `-` or `*`.
  However, Markdown wants indented texts and unindented ones will possibly corrupt the list structure.
- Code snippets
  Use a pair of backticks `` ` `` to quote an inline code snippet, like how `` `1 + 1` `` produces `1 + 1`.
  1. \ `Understood`
     Then we will go on to code blocks.
  2. I can't find it on my keyboard???
     If you are using a US keyboard, it is probably around your `Esc` key, maybe right below it.
     It *is* a rarely used key (outside the programming community) to be honest, and it pains my little finger to reach for it. But it is still an intuitive way to "quote" code snippets, judging by how it looks like normal quotation marks with a bit of difference.

  Codes are usually lengthy and usually takes a whole block of space to display. Again, it's backticks.
  ````markdown
  ```markdown meta
  **bold** _italics_
  ```
  ````
  :::nil
  - 1. The ```` ```markdown meta```` part signifies the start of a code block. The first word `markdown` tells the Markdown processor what language the block contains, while the second word is optional, telling about *meta* things (that differ between differenct processors).
    2. The final ```` ``` ```` signifies the end of the block.
    It looks like this:
    ```markdown
    **bold** _italics_
    ```
- `CHOICE_COUNT == 0` Done!
  [](#end)


[](#heading)

# end
~~~

</md-example>

### Directives

There is [a proposal for adding directives into Markdown](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444).

It proposes using the following syntax:

```markdown
:::::::::::: SPOILER :::::::::::::
We're going to spoil it in three
easy steps:

1. ready
2. steady
3. go
::::::::::::::::::::::::::::::::::
```

However, to simplify things a bit, we use a different syntax, which get explained later.

## Getting Started

### Texts are texts

<md-example height="12em">

~~~markdown
Most of the texts, along with Markdown markup elements, are kept as is.
You may start typing here and see how the story goes line by line.
~~~

</md-example>

### Tags

<md-example>

```markdown
One may attach tags to lines by putting `[tag]` or `[tag: with_value]` at the beginning of a line.
Different programs may choose to interpret these tags differently. Here I am interpreting them as [CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) styles. But the fact is, it all depends.
[background-color: white] [color: blue] A *blue* line.
[background-color: black] [color: red]  A **red** line.
[filter: drop-shadow(2px 2px 2px red)] A shadowed line.
If you are cooperating with your programmer friends, tags should allow passing information quite efficiently if they decide to support some specific tags.
```

</md-example>

### Choices

Brocatel is designed for choose-your-own stories, and choices are a crucial feature.

<md-example>

```markdown
Cats or dogs?
1. CATS
   ![A cat with not much an facial expression captioned "200 OK"](https://http.cat/images/200.jpg)
2. DOGS
   ![A happy dog captioned "200 OK"](https://http.dog/200.jpg)
3. B.. Beavers?
   (Didn't have the time to find an image yet. Sorry for that :P )

Ok, I admit that I am running out of ideas.
* 404 Not Found
  ![A cat under sheets of paper](https://http.cat/images/404.jpg)
* 521 Web Server Is Down
  ![A cat sitting on a laptop](https://http.cat/images/521.jpg)
```

</md-example>

There is a distinct difference between ordered lists (started with `1.`, `2.`...)
and unordered ones (started with `* `, `- `, etc.).
We will get to that after we learn about how we navigate through the story.

### Links to headings

We use links to direct the flow of the story.

<md-example>

```markdown
# header

:::if`VISITS(header) > 1`
- Hello! Time travellers!
  # real end?
  - Ready for another jump?
    [](#end?)

<!-- Please ignore that pecular `:::if` thing above. -->
You will notice that the above `# header` (see the script panel) is not displayed on the preview panel.
This is because all headers serve as navigation anchors.
1. But it doesn't mean anything?
   A header alone means nothing. However, when used with links, we can freely navigate through the story.
   We will see how a link directs the story flow back to that `# header`.

1) Ready?
   [](#header)

# end?
In summary, `[](#header)` takes you back to `# header`. You are then greeted with `Hello! Time travellers!`, while the next jump `[](#end)` takes you to the `# end` heading above  (see the last few lines in the script panel).
Markdown allows different levels of headings. So we should want to differentiate between `## Section 1` in `# Chapter 1` and `## Section 1` in `# Chapter 2`.
We can see how we do this with links:
1. With `[](<#header#real end?>)`
   [](<#header#real end?>)
2. With `[](<#end?#real end?>)`
   [](<#end?#real end?>)
## real end?
And the story ends here.
Also, when a heading contains space like `## real end?`, you should put a pair of angle brackets around the link, like `[](<#real end?>)`. (`[](#real end?)` does not work in Markdown.)
```

</md-example>

### Happy coding

You might have noticed that we used some pecular ``:::if`VISITS(header) > 1` `` to detect *time travellers*.

We will be working on an imperfect example and improve it bit by bit by introducing more concepts.

#### Under a budget

<md-example>

~~~markdown
`budget = 10`
# show_budget
Now I have ${budget}.
Maybe:
1.  Order Quarter Pounder with Cheese ($3.79)
    `budget = budget - 3.79`
2.  Order Artisan Grilled Chicken ($4.39)
    `budget = budget - 4.39`
3.  Order Filet-O-Fish ($3.79)
    `budget = budget - 3.79`

[](#show_budget)
~~~

</md-example>

- The first line `` `budget = 10` `` is a Lua code snippet - you don't need to know Lua though.

  `somethingsomething = some_value` is an *assignment* -
  imagine opening up a dictionary, finding the entry for `budget` and writing a `10` alongside -
  you associate the `budget` name with a certain value.
- The third line *interpolates* the value of `budget` into the text.

  Since `budget` is `10`, `Now I have ${budget}.` becomes `Now I have $10.`.

  If you want to have braces as is, try inserting backslashes `\` before them.
  No interpolation is applied to `\{budget}`.
- `budget = budget - 3.79` is another *assignment* statement.

  Imagine looking the dictionary and finding the value `10` alongside `budget`.
  Now `budget = budget - 3.79` is just `budget = 10 - 3.79`,
  so a value of `6.21` is now associated with `budget`, overwriting the previous `10`.

We see that the heading `# show_budget` and the link `[](#show_budget)` form a loop,
so one can enjoy multiple treats, until... one gets `Now I have $-1.97.`.

That shouldn't be possible! We should end the story *if* we don't have enough money.
In order to do that, we need *conditionals* or *if* statements.

#### Conditional lines

<md-example>

~~~markdown
`budget = 10`
# show_budget
Now I have ${budget}.
Maybe:
1.  Order Quarter Pounder with Cheese ($3.79)
    `budget = budget - 3.79`
2.  Order Artisan Grilled Chicken ($4.39)
    `budget = budget - 4.39`
3.  Order Filet-O-Fish ($3.79)
    `budget = budget - 3.79`

<!-- The line added -->
`budget < 0` [](#end)

[](#show_budget)
# end
Not enough money.
~~~

</md-example>

We added a conditinoal line here: `` `budget < 0` [](#end)``.
It means that, if `budget < 0`, we should direct the story to `# end`.

`budget < 0` is a comparison. More comparison examples:
- `budget > 0`
- `budget >= 0`
- `budget == 0` (note the two consecutive equal signs here, this is how the computer differentiates between assignments and comparisons)
- `budget ~= 0` (when budget is *not* zero)
- `name == "Ink"`
- `name ~= "Ink"`

Also, one may add conditionals to choices:

<md-example>

~~~markdown
`budget = 10`
# show_budget
Now I have ${budget}.
Maybe:
<!-- Conditionals on choices -->
1.  `budget >= 3.79` Order Quarter Pounder with Cheese ($3.79)
    `budget = budget - 3.79`
2.  `budget >= 4.39` Order Artisan Grilled Chicken ($4.39)
    `budget = budget - 4.39`
3.  `budget >= 3.79` Order Filet-O-Fish ($3.79)
    `budget = budget - 3.79`
4.  `CHOICE_COUNT == 0` Order nothing
    [](#end)

[](#show_budget)
# end
Not enough money.
~~~

</md-example>

You will notice that there is a special `CHOICE_COUNT` there, if there is no other choices,
which means `CHOICE_COUNT == 0` (we, the program, associated the value for you),
then that option will be available as a fallback.

### Conditional blocks

A conditional line is sometimes just not enough. You might need to do things like:
```markdown
`budget < 0` **NPC A**: Something something
`budget < 0` **NPC B**: Some other thing
...
```

To simplify things a bit and allow nested usages, one may use conditional blocks:

<md-example>

~~~markdown
`budget = 10`
# show_budget
Now I have ${budget}.
Maybe:
1.  Order Quarter Pounder with Cheese ($3.79)
    `budget = budget - 3.79`
2.  `budget >= 4.39` Order Artisan Grilled Chicken ($4.39)
    `budget = budget - 4.39`
3.  Order Filet-O-Fish ($3.79)
    `budget = budget - 3.79`

<!-- Conditional block -->
:::if `budget >= 3.79`
- You still have enough money.
  1.  Maybe order something.
      [](#show_budget)
  2.  Order nothing.
- Not enough money.
~~~

</md-example>

A conditional block starts with ``:::if `your condition here` ``, and follows one or two branches.
The story flows to the first branch (`You still have enough money.`) if `budget >= 3.79`,
and otherwise the `Not enough money.` branch.

### Choices Revisted: Show-Once / Recur

Plain unordered list items are actually show-once choices:

<md-example>

~~~markdown
TODO:
# header
- Learn Ink
  Ink, Inky, Inkle, Inklewriter...
- Learn Inform 7
  The Gazebo is a room.
  **"A white canvas parasol raised up on stakes driven into the grass."**
- Learn TADS 3
  This is a real todo.
- `CHOICE_COUNT == 0` Done!
  [](#end)
[](#header)
# end
~~~

</md-example>

And ordered ones recur:


<md-example>

~~~markdown
TODO:
# header
1.  Learn Ink
    # ink
    Ink, Inky, Inkle, Inklewriter...
2.  Learn Inform 7
    # inform
    The Gazebo is a room.
    **"A white canvas parasol raised up on stakes driven into the grass."**
3.  Learn TADS 3
    # tads
    This is a real todo.
4.  `VISITED(ink) and VISITED(inform) and VISITED(tads)` Maybe later.
    [](#end)
[](#header)
# end
~~~

</md-example>

You may also make certain `RECUR` / `ONCE`:

<md-example>

~~~markdown
# header
- `RECUR` Use the unbreakable shovel
  Nothing.
- `RECUR(3)` Use the rusted one ({4 - VISITS(use_rusted)})
  # use_rusted
  Nothing.
  `VISITS(use_rusted) > 3` The handle fell off.
- `RECUR(0)` Use the fragile one (1)
  It broke.
- `ONCE` Use another fragile one (1)
  It broke.
[](#header)
~~~

</md-example>

## Macros

> In computer programming, a macro (short for "macro instruction"; from Greek μακρο- 'long, large'[1])
> is a rule or pattern that specifies how a certain input should be mapped to a replacement output.
>
> [Macro (computer science) - Wikipedia](https://en.wikipedia.org/wiki/Macro_(computer_science))

To be honest, I didn't know what exactly a macro is until I looked it up in the Wikipedia.
(I mean, macros are... *macros*.)

We should start with some examples. In short, macros simplify your work (by leaving most of
the work to the macro writers).

<md-example height="8em">

~~~markdown
:::loop
- This loops!
  Line 2
  Line 3
  ...
~~~

</md-example>

The syntax is three colons followed immediately by a macro name `loop`.
This make the compiler transform the snippet above into a loop:

```markdown
# random-loop-name12345
This loops!
Line 2
Line 3
...
[](#random-loop-name12345)
```

This usually saves a bit of space, and by indenting the texts (the `-` list and indentation are required)
you can get a better impression of how the story actually flows.

### The `switch` macro

<md-example height="8em">

~~~markdown
`been_to_place_2 = true`
:::switch
- `been_to_place_1`
  The user has been to Place 1.
- `been_to_place_2`
  The user has not yet been to Place 1.
  But they have been to Place 2.
- `been_to_place_3`
  Been to Place 3 but not 1 or 2.
- `true`
  None of the three.
~~~

</md-example>

(Just in case, like many programming languages, Lua uses `true` and `false` to represent yes and no.
So `been_to_place_2 = true` probably means "yes, somebody has `been_to_place_2`".)

The `switch` macro is suitable when the `:::if` conditional block appear insufficient.
