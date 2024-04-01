# vscode-brocatel

`vscode-brocatel` is an [VS Code](https://code.visualstudio.com) extension for writing and debugging stories in [Brocatel](https://gudzpoz.github.io/brocatel/).

## Features

- Lint Brocatel markdown files
- Preview Brocatel stories
- Capture runtime Lua errors and locate them in the source files

## Usage

To avoid messing up your Markdown files, the extension will only lint Markdown files with the `.md` extension *and* has one of the following "front matters" in the first lines of the file:

- ```markdown
  <!-- brocatel -->
  ```
- ```markdown
  ---
  brocatel: true
  ---
  ```

If you want to lint all Markdown files in a workspace regardless of the front matter, you can set the `brocatel.lintAllMarkdownFiles` setting to `true`.
