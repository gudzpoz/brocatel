import { mkdir, writeFile } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line import/no-extraneous-dependencies
import { bundle } from 'luabundle';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.normalize(path.join(dir, '..'));
const destination = path.join(root, 'brocatel.lua');
const luaPath = path.join(root, 'src');

const result = bundle(
  path.join(luaPath, 'brocatel.lua'),
  {
    paths: [
      path.join(luaPath, '?.lua'),
    ],
  },
);

mkdir(path.dirname(destination), { recursive: true }, () => {
  writeFile(destination, result, () => {
    // eslint-disable-next-line no-console
    console.log(destination);
  });
});
