#!/usr/bin/env bun

import { parseArgs } from 'util';
import SpriteGenerator from '../lib/sprite-generator';
import IconSearch from '../lib/icon-search';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    out: {
      type: 'string',
      short: 'o',
    },
    icons: {
      type: 'string',
      short: 'p',
      multiple: true,
    },
    alias: {
      type: 'string',
      short: 'a',
      multiple: true,
    },
    searchPattern: {
      type: 'string',
      short: 's',
    },
    idPrefix: {
      type: 'string',
      short: 'i',
    },
  },
  strict: true,
  allowPositionals: true,
});

console.log(values);

if (!values.out) {
  throw new Error('Must specify an output file path with the --out flag');
}

if (!values.icons?.length) {
  throw new Error(
    'Must pass at least one relative path or NPM module name to search for SVGs with the --icons flag',
  );
}

const { icons, aliases = {}, searchPattern = '**/*', idPrefix = '' } = values;

async function cowabungaTime() {
  const searcher = new IconSearch({
    cwd: process.cwd(),
    paths: icons,
    aliases,
    searchPattern,
    idPrefix,
  });

  const matches = await searcher.search();

  if (matches.size === 0) {
    console.error('bummer. no icon matches found.');
    return;
  }

  console.log('Found %d matches to bundle up', matches.size);

  const spriteGen = new SpriteGenerator({
    inputFiles: matches,
  });
  const sprite = await spriteGen.render();
  const outFile = Bun.file(values.out);

  const bytes = await Bun.write(outFile, sprite);
  console.log('Saved SVG sprite to %s (%d bytes)', values.out, bytes);
}

cowabungaTime()
  .then(() => {
    console.log('Thank you come again');
  })
  .catch((error) => {
    console.error('something most unfortunate has transpired: %O', error);
  });
