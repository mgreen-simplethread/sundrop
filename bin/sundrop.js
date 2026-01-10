#!/usr/bin/env bun

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseArgs } from 'util';
import SpriteGenerator from '../lib/sprite-generator';
import IconSearch from '../lib/icon-search';

const argv = yargs(hideBin(Bun.argv))
  .usage(`$0 --path PATH_TO_ICONS --out OUTPUT_PATH --files GLOB`)
  .scriptName('sundrop')
  .pkgConf('sundrop')
  .config('config', 'Path to JSON config file. Values set there are overridden by CLI flags.')
  .alias('config', 'c')
  .alias('p', 'path')
  .describe('p', 'Relative path or node module to search for icons')
  .array('p')
  .alias('o', 'out')
  .describe('o', 'Output file')
  .string('o')
  .demand('o')
  .alias('f', 'files')
  .string('f')
  .describe('f', 'Glob of files to search for icon names')
  .default('f', './**/*.{html,css}')
  .alias('a', 'alias')
  .array('a')
  .describe('a', 'alias for icon name (alias_name:real_icon_name)')
  .coerce('a', (arg) =>
    arg.reduce((obj, val) => {
      const [alias, icon] = val.split(':');
      if (!alias || !icon) return obj;
      obj[alias] = icon;
      return obj;
    }, {}),
  )
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .check((argv) => {
    if (!argv.path?.length > 0) {
      throw new Error('At least one icon path must be specified');
    }
    return true;
  })
  .parse();

const { path, alias = {}, searchPattern = '**/*', idPrefix = '' } = argv;

async function cowabungaTime() {
  const searcher = new IconSearch({
    cwd: process.cwd(),
    paths: path,
    aliases: alias,
    searchPattern: argv.files,
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
  const outFile = Bun.file(argv.out);
  const bytes = await Bun.write(outFile, sprite);
  console.log('Saved SVG sprite to %s (%d bytes)', argv.out, bytes);
}

cowabungaTime()
  .then(() => {
    console.log('Thank you come again');
  })
  .catch((error) => {
    console.error('something most unfortunate has transpired: %O', error);
  });
