```lua global
--[[
Copyright (c) 2016 inkle Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
]]--

-- Character variables. We track just two, using a +/- scale
forceful = 0
evasive = 0

-- Inventory Items
teacup = false
gotcomponent = false

-- Story states: these can be done using read counts of knots;
-- or functions that collect up more complex logic; or variables
drugged = false
hooper_mentioned = false

losttemper = false
admitblackmail = false

-- what kind of clue did we pass to Hooper?
NONE = 0
STRAIGHT = 1
CHESS = 2
CROSSWORD = 3
hooperClueType = NONE

hooperConfessed = false

SHOE = 1
BUCKET = 2
smashingWindowItem = NONE

notraitor = false
revealedhooperasculprit = false
smashedglass = false
muddyshoes = false

framedhooper = false

-- What did you do with the component?
putcomponentintent = false
throwncomponentaway = false
piecereturned = false
longgrasshooperframe = false

-- DEBUG mode adds a few shortcuts - remember to set to false in release!
DEBUG = false
```

:::when[DEBUG]
- IN DEBUG MODE!
  - Beginning...
    [](start)
  - Framing Hooper...
    [](claim_hooper_took_component)
  - In with Hooper...
    [](inside_hoopers_hut)
- [](start)
:::

# start

`-- Intro`
They are keeping me waiting.
- Hut 14
  Hut 14. The door was locked after I sat down.
  I don't even have a pen to do any work. There's a copy of the morning's intercept in my pocket, but staring at the jumbled letters will only drive me mad.
  I am not a machine, whatever they say about me.

## opts
`#opts == 2` I rattle my fingers on the field table.

- Think
  # think
  They suspect me to be a traitor. They think I stole the component from the calculating machine. They will be searching my bunk and cases.
  `plan` When they don't find it, then they'll come back and demand I talk.
  `not plan` When they don't find it, they'll come back and demand I talk.
  [](opts)

- Plan
  # plan
  `not think` What I am is a problem—solver. Good with figures, quick with crosswords, excellent at chess.
  `think` I am a problem—solver. Good with figures, quick with crosswords, excellent at chess.
  But in this scenario — in this trap — what is the winning play?

  - Co—operate
    # cooperate
    I must co—operate. My credibility is my main asset. To contradict myself, or another source, would be fatal.
    I must simply hope they do not ask the questions I do not want to answer.
    `forceful = forceful - 1`
  - Dissemble
    Misinformation, then. Just as the war in Europe is one of plans and interceptions, not planes and bombs.
    My best hope is a story they prefer to the truth.
    `forceful = forceful + 1`
  - Divert
    # delay
    Avoidance and delay. The military machine never fights on a single front. If I move slowly enough, things will resolve themselves some other way, my reputation intact.
    `evasive = evasive + 1`

- Wait

[](waited)

# waited

Half an hour goes by before Commander Harris returns. He closes the door behind him quickly, as though afraid a loose word might slip inside.
"Well, then," he begins, awkwardly. This is an unseemly situation.

- "Commander."
  He nods.
- `not start.delay` "Tell me what this is about."
  # tellme
  He shakes his head.
  "Now, don't let's pretend."
- Wait
  I wait for him to speak.

He has brought two cups of tea in metal mugs: he sets them down on the tabletop between us.

- `tellme` Deny
  "I'm not pretending anything."
  `cooperate` I'm lying already, despite my good intentions.
  Harris looks disapproving.
  [](pushes_cup)
- Take one
  # took
  `teacup = true`
  I take a mug and warm my hands. It's a small gesture of friendship.
  [](give_hope)
- `not tellme` "What's going on?"
  # what2
  "You know already."
- Wait
  I wait for him to speak.

He pushes one mug halfway towards me: a small gesture of friendship.
## give_hope
Enough to give me hope?

:::when[teacup]
- - Drink
    I raise the cup to my mouth but it's too hot to drink.

  - Wait
    I say nothing as <>
    [](lift_up_cup)
- - Take it
    # lift_up_cup
    `took` I lift the mug and blow away the steam. It is too hot to drink.
    `not took` I take the mug, and blow away the steam. It is too hot to drink.
    Harris picks his own up and just holds it.
    `teacup = true; forceful = forceful - 1`
  - Don't take it
    Just a cup of insipid canteen tea. I leave it where it is.
    `forceful = forceful + 1`
:::

"Quite a difficult situation," {lift_up_cup and "he" or "Harris"} begins{forceful <= 0 and "" or " sternly"}. I've seen him adopt this stiff tone of voice before, but only when talking to the brass. "I'm sure you agree."

- Agree
  "Awkward," I reply<>
- Disagree
  # disagree
  "I don't see why," I reply<>
  `forceful = forceful + 1; evasive = evasive + 1`
- Lie
  [](disagree)
- Evade
	"I'm sure you've handled worse," I reply casually<>
  `evasive = evasive + 1`

:::when[teacup]
- `drugged = true`
  , sipping at my tea as though we were old friends.
- .
:::

- Watch him
  His face is telling me nothing. I've seen Harris broad and full of laughter. Today he is tight, as much part of the military machine as the device in Hut 5.
- Wait
  I wait to see how he'll respond.
- `not disagree` Smile
  I try a weak smile. It is not returned.
  `forceful = forceful - 1`

`-- Why you're here`

"We need that component," he says.
