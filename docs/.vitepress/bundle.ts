import { mkdir, writeFile } from 'fs';
import { bundle } from 'luabundle';
import path from 'path';

const dir = path.dirname(__filename);
const destination = path.join(dir, 'cache', 'vm-bundle.lua');
const root = path.normalize(path.join(dir, '..', '..'));
const luaPath = path.join(root, 'vm', 'src');

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
