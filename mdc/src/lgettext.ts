import { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

import {
  LuaArray, LuaText,
} from './ast';

export interface LuaGettextData {
  texts: LuaText[];
  source: VFile;
}

export function collectGettextData(root: LuaArray, source: VFile): LuaGettextData {
  const texts: LuaText[] = [];
  visit(root, 'text', (node) => {
    texts.push(node as LuaText);
  });
  return {
    texts,
    source,
  };
}

function textToMessage(text: LuaText, source: VFile) {
  let message = '';
  if (text.original) {
    message += `#. #+BEGIN: orginal-text
${text.original.split('\n').map((line) => `#. ${line}`).join('\n')}
#. #+END: orginal-text
`;
  }
  if (text.position) {
    message += `#: ${source.path}:${text.position.start.line}\n`;
  }
  message += '#, python-brace-format\n';
  let msgid;
  if (text.text.includes('\n')) {
    msgid = '""\n';
    msgid += text.text.split('\n').map((line) => JSON.stringify(`${line}\n`)).join('\n');
  } else {
    msgid = JSON.stringify(text.text);
  }
  message += `msgid ${msgid}\n`;
  if (text.plural) {
    message += 'msgid_plural ""\nmsgstr[0] ""\n';
  } else {
    message += 'msgstr ""\n';
  }
  return message;
}

export function compileGettextData(data: LuaGettextData[]) {
  const [date, time] = new Date().toISOString().split('T', 2);
  return `# SOME DESCRIPTIVE TITLE
# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER
# This file is distributed under the same license as the PACKAGE package.
# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: PACKAGE VERSION\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: ${date} ${time.substring(0, 5)}+0000\\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n"
"Language-Team: LANGUAGE <LL@li.org>\\n"
"Language: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=INTEGER; plural=EXPRESSION;\\n"

${
  data.map(({ texts, source }) => texts.map((text) => textToMessage(text, source)))
    .flat().join('\n')
}`;
}
