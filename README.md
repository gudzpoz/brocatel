# Brocatel

[![NPM Version](https://img.shields.io/npm/v/%40brocatel%2Fmdc)](https://www.npmjs.com/package/@brocatel/mdc)
[![LuaRocks](https://img.shields.io/luarocks/v/gudzpoz/brocatel)](https://luarocks.org/modules/gudzpoz/brocatel)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/gudzpoz/brocatel/docs.yml?label=Documentation)](https://gudzpoz.github.io/brocatel/)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/gudzpoz/brocatel/vscode.yml?label=VS+Code+Extension)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/gudzpoz.vscode-brocatel)](https://marketplace.visualstudio.com/items?itemName=gudzpoz.vscode-brocatel)
[![Open VSX Version](https://img.shields.io/open-vsx/v/gudzpoz/vscode-brocatel)](https://open-vsx.org/extension/gudzpoz/vscode-brocatel)

(By the way, you can also [run this README file interactively with Brocatel](https://gudzpoz.github.io/brocatel/playground.html?url=https://cdn.jsdelivr.net/gh/gudzpoz/brocatel@main/README.md).)

*   What is Brocatel?

    Brocatel lets you write interactive stories (choice-based interactive fictions) in [Markdown](https://en.wikipedia.org/wiki/Markdown), backed by [Lua](https://www.lua.org/).

1.  Features
    [¶](#features)
2.  Why?
    [¶](#why)
3.  How to use Brocatel?
    [¶](#how-to-use-brocatel)

## Features

1.  **Markdown-ish**.

    Brocatel uses the simple syntax of **Markdown**, making it easy to learn.

    Here is a snippet taken from the [Cloak of Darkness](https://gudzpoz.github.io/brocatel/cloak.html) example:
    ```markdown
    # bar_light
    There seems to be some sort of message scrawled in the sawdust on the floor.
    1.  Go north.
        [go back to the foyer section](#foyer)
    2.  Examine the message.
        :::if `scuffled < 2`
        -   The message, neatly marked in the sawdust, reads...
            You have won!
        -   The message has been carelessly trampled, making it difficult to read. You can just distinguish the words...
            You have lost.
        The end.
    ```

2.  **Lua Powered**.

    Instead of implementing a custom scripting language, Brocatel runs on [Lua](https://www.lua.org/) and uses Lua for scripting purposes. As a proven and robust language, Lua is not only portable and heavily used in the game industry, but also simple and relatively easy to learn.

    Brocatel direcly uses Lua for its variables and conditional branches.

3.  **Translatable**.

    Brocatel is fully translatable, allowing you to write stories in multiple languages. By integrating with [GNU gettext](https://www.gnu.org/software/gettext/), it supports writing stories that handles different pluralities and sentence structures between languages.

    Upon compilation, the Brocatel compiler will automatically generate a context-rich POT file that one may send to a translator for localization.

<details><summary>Navigation</summary>

1) Back To Section
   [¶](#features)
2) Back To Top
   [¶](#brocatel)

</details>

## Why?

There are many tools for writing interactive stories. However, most of them are either too complicated to learn with weird *grammar*, or too limited in features with little *integration* or *internationalization* consideration.

By leveraging the simple syntax of **Markdown** and the power of **Lua**, Brocatel aims to balance the ease to create interactive stories and the degree of customizability.

[](#brocatel)

## How to use Brocatel?

1.  I want to try things out first.

    You can try Brocatel out in [our online playground](https://gudzpoz.github.io/brocatel/playground.html) or with [an interactive online tutorial](https://gudzpoz.github.io/brocatel/tutorial.html).

2.  I want to use Brocatel in my own project.

    A [VS Code](https://code.visualstudio.com/) extension is on the way to facilitate development and debugging. Before then, if you want to use Brocatel in real games, you might need to use a bit of CLI, i.e., clone this project and `pnpm install && pnpm build`. You will need to use the compiler under the `mdc/` directory and bundle the runtime under the `vm/` directory with your game. Documentation is coming soon.

<details><summary>Navigation</summary>

1) Back To Section
   [¶](#how-to-use-brocatel)
2) Back To Top
   [¶](#brocatel)

</details>