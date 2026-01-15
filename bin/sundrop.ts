#!/usr/bin/env bun

import { Glob } from 'bun';
import { watch as fsWatch, readFileSync } from 'node:fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { bundleSprites } from '../index';
import packageJSON from '../package.json';

const options = {
  path: {
    alias: 'p',
    describe: 'Relative path or node module to search for icons',
    type: 'array' as const,
  },
  out: {
    alias: 'o',
    describe: 'Output file',
    type: 'string' as const,
    demandOption: true,
  },
  files: {
    alias: 'f',
    describe: 'Glob of files to search for icon names',
    type: 'string' as const,
    default: './**/*.{html,css}',
  },
  alias: {
    alias: 'a',
    describe: 'Alias for icon name (alias_name:real_icon_name)',
    type: 'array' as const,
    coerce: (arg: string[]) =>
      arg.reduce((obj: Record<string, string>, val: string) => {
        const [alias, icon] = val.split(':');
        if (!alias || !icon) return obj;
        obj[alias] = icon;
        return obj;
      }, {}),
  },
  idPrefix: {
    alias: 'i',
    describe: 'Prefix string to add to icon symbol IDs',
    type: 'string' as const,
    default: 'icon-',
  },
  watch: {
    alias: 'w',
    describe: 'Watch for changes and rebuild sprite sheet',
    type: 'boolean' as const,
  },
};

const argv = yargs(hideBin(Bun.argv))
  .usage(`$0 --path PATH_TO_ICONS --out OUTPUT_PATH --files GLOB`)
  .scriptName('sundrop')
  .pkgConf('sundrop')
  .config(
    'config',
    'Path to JSON config file. Values set there are overridden by CLI flags.',
    (file) => JSON.parse(readFileSync(file).toString()),
  )
  .alias('config', 'c')
  .options(options)
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .parseSync();

const { out, path, alias: aliases = {}, files: searchPattern, idPrefix = '', watch = false } = argv;

const paths = path as string[] | undefined;

if (!out) {
  console.error('Error: --out is required');
  process.exit(1);
}

if (watch) {
  console.log('Sundrop v%s started - watching project for changes.', packageJSON.version);

  let timeout: ReturnType<typeof setTimeout> | null;

  const debouncedBundler = () => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(async () => {
      await bundleSprites({ cwd: process.cwd(), out, paths, aliases, searchPattern, idPrefix });
      timeout = null;
    }, 100);
  };

  // run once explicitly on startup
  debouncedBundler();

  const glob = new Glob(searchPattern);
  fsWatch(process.cwd(), { recursive: true }, (_eventType, filename) => {
    if (!filename || !glob.match(filename)) {
      return;
    }

    debouncedBundler();
  });
} else {
  bundleSprites({ cwd: process.cwd(), out, paths, aliases, searchPattern, idPrefix })
    .then(() => {
      console.log('Thank you come again');
    })
    .catch((error) => {
      console.error('something most unfortunate has transpired: %O', error);
    });
}
