import { mkdir, writeFile } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { bundle } from 'luabundle';

const __filename = fileURLToPath(import.meta.url);
const dir = path.dirname(__filename);
const root = path.normalize(path.join(dir, '..'));
const destination = path.join(root, 'vm-bundle.lua');
const luaPath = path.join(root, 'src');

const result = bundle(
  path.join(luaPath, 'vm.lua'),
  {
    paths: [
      path.join(luaPath, '?.lua'),
    ],
  },
);

mkdir(path.dirname(destination), { recursive: true }, () => {
  writeFile(destination, result, () => console.log(destination));
});
