#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { bundleSprites } from '../index';

const argv = yargs(hideBin(Bun.argv))
  .usage(`$0 --path PATH_TO_ICONS --out OUTPUT_PATH --files GLOB`)
  .scriptName('sundrop')
  .pkgConf('sundrop')
  .config(
    'config',
    'Path to JSON config file. Values set there are overridden by CLI flags.',
    (file) => JSON.parse(readFileSync(file)),
  )
  .alias('config', 'c')
  .alias('p', 'path')
  .describe('p', 'Relative path or node module to search for icons')
  .array('p')
  .alias('o', 'out')
  .describe('o', 'Output file')
  .string('o')
  // .demand('o')
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
  .string('i')
  .alias('i', 'idPrefix')
  .describe('Prefix string to add to icon symbol IDs')
  .default('i', 'icon-')
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .parse();

if (argv.$0 === 'sundrop') {
  const {
    out,
    path: paths,
    alias: aliases = {},
    files: searchPattern = '**/*',
    idPrefix = '',
  } = argv;

  bundleSprites({ out, paths, aliases, searchPattern, idPrefix })
    .then(() => {
      console.log('Thank you come again');
    })
    .catch((error) => {
      console.error('something most unfortunate has transpired: %O', error);
    });
}
