# Cloak of Darkness

Here is an example of [Cloak of Darkness](https://www.ifwiki.org/Cloak_of_Darkness).

<md-example>

~~~markdown
```lua global
-- Original by Roger Firth.
-- Adapted from the implementation by Michael Akinde.

scuffled = 0
has_cloak = true
hung_cloak = false
dropped_cloak = false
examined_self = false
```

# opera_house
Hurrying through the rainswept November night, you're glad to see the bright lights of the Opera House. It's surprising that there aren't more people about but, hey, what do you expect in a cheap demonstration vMap...?

- Enter the foyer.

  You enter the foyer of the Opera house.

  [link](#foyer)

# foyer

:::loop

-   You are standing in a spacious hall, splendidly decorated in red and gold, with glittering chandeliers overhead. The entrance from the street is to the north, and there are doorways south and west.

-   # foyer_options

    1.  Examine yourself.

        You examine yourself.

        `examined_self = true`

        :::if`has_cloak`

        - You are wearing a handsome cloak, of velvet trimmed with satin, and slightly splattered with raindrops. Its blackness is so deep that it almost seems to suck light from the room.

        - You aren't carrying anything.

        [link](#foyer_options)

    2.  Go north.

        [link](#leave)

    3.  Go west.

        [link](#cloakroom)

    4.  `not has_cloak` Go south.

        [link](#bar_light)

    5.  `has_cloak` Go south.

        [link](#bar_dark)

## leave

```lua global
i = 0
```

:::switch`local j = i % 4`

- `j == 0`

  No. You've only just arrived, and besides, the weather outside seems to be getting worse.

- `j == 1`

  No. It's really raining cats and dogs out there.

- `j == 2`

  Are you still considering that option? The answer is still no.

- `j == 3`

  Come on, get on with the vMap.

`i = i + 1`

[link](#foyer_options)

# cloakroom

The walls of this small room were clearly once lined with hooks, though now only one remains. The exit is a door to the east.

`dropped_cloak` Your cloak is on the floor here.

`hung_cloak` Your cloak is hanging on the hook.

:::loop

-   ## cloakroom_options

    1.  Examine the hook.

        You examine the hook.

        :::if`hung_cloak`

        - It's just a small brass hook, with your cloak hanging on it.

        - It's just a small brass hook screwed to the wall.

        [link](#cloakroom_options)

    2. `has_cloak and examined_self` Hang your cloak on the hook.

        You hang your cloak on the hook.

        `has_cloak = false`

        `hung_cloak = true`

        [link](#cloakroom)

    3. `has_cloak and examined_self` Drop your cloak on the floor.

        You drop your cloak on the floor.

        `has_cloak = false`

        `dropped_cloak = true`

        [link](#cloakroom)

    4. `hung_cloak or dropped_cloak` Pick up your cloak.

        :::if`hung_cloak`

        - You take your cloak from the hook.

        - You pick up your cloak from the floor.

        ```lua
        has_cloak = true
        hung_cloak = false
        dropped_cloak = false
        ```

        [link](#cloakroom)

    5. Go east.

        [link](#foyer)

# bar_dark

You walk to the bar, but it's so dark here you can't really make anything out. The foyer is back to the north.

:::loop

-   # bar_dark_options

    *   Feel around for a light switch.

    *   Sit on a bar stool.

    *   `RECUR` Go north.

        [link](#foyer)

    In the dark? You could easily disturb something.

    `scuffled = scuffled + 1`

    [link](#bar_dark_options)

# bar_light

The bar, much rougher than you'd have guessed after the opulence of the foyer to the north, is completely empty. There seems to be some sort of message scrawled in the sawdust on the floor. The foyer is back to the north.

1. Examine the message.

   [link](#message)

2. Go north.

   [link](#foyer)

## message

:::switch

- `scuffled < 2`

  The message, neatly marked in the sawdust, reads...

  You have won!

- `true`

  The message has been carelessly trampled, making it difficult to read. You can just distinguish the words...

  You have lost.

* The End.

---
~~~

</md-example>
