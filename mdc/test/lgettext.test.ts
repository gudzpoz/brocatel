import { assert, test } from 'vitest';
import { VFile } from 'vfile';

import { BrocatelCompiler } from '../src';

const compiler = new BrocatelCompiler({
  autoNewLine: true,
});

test('POT generation', async () => {
  const compiled = await compiler.compileAll('main', async () => `
# main
hello
- a
  c
- b
  d
vars {1 + 2}
plural {1 + 2 ?}
`);
  assert.isOk(compiled.data.gettext);
  const vfile: VFile = compiled.data.gettext as VFile;
  assert.isOk(vfile.value);
  assert.include(vfile.value, `
#. #+BEGIN: orginal-text
#. hello
#. #+END: orginal-text
#: main:3
#, python-brace-format
msgid "hello"
msgstr ""

#. #+BEGIN: orginal-text
#. a
#. #+END: orginal-text
#: main:4
#, python-brace-format
msgid "a"
msgstr ""

#. #+BEGIN: orginal-text
#. c
#. #+END: orginal-text
#: main:5
#, python-brace-format
msgid "c"
msgstr ""

#. #+BEGIN: orginal-text
#. b
#. #+END: orginal-text
#: main:6
#, python-brace-format
msgid "b"
msgstr ""

#. #+BEGIN: orginal-text
#. d
#. #+END: orginal-text
#: main:7
#, python-brace-format
msgid "d"
msgstr ""

#. #+BEGIN: orginal-text
#. vars {1 + 2}
#. #+END: orginal-text
#: main:8
#, python-brace-format
msgid "vars {v1}"
msgstr ""

#. #+BEGIN: orginal-text
#. plural {1 + 2 ?}
#. #+END: orginal-text
#: main:9
#, python-brace-format
msgid "plural {v1}"
msgid_plural ""
msgstr[0] ""
`);
});
