# SunDrop

Dispensing delicious SVG sprites

## About

SunDrop is better than Sprite IRL, but this SunDrop _makes_ sprites by scanning your project files for occurrences of their filenames. Anything it finds in its quest will get blobbed up into a big ball of SVG `<symbol>` elements with distinct IDs that you can `<use>` later. Each symbol is run thru `svgo` and optimized before it's tossed into the sprite.

## CLI

```
sundrop --path PATH_TO_ICONS --out OUTPUT_PATH --files GLOB

Options:
  -c, --config   Path to JSON config file. Values set there are overridden by
                 CLI flags.
  -p, --path     Relative path or node module to search for icons      [array]
  -o, --out      Output file                               [string] [required]
  -f, --files    Glob of files to search for icon names
                                       [string] [default: "./**/*.{html,css}"]
  -a, --alias    alias for icon name (alias_name:real_icon_name)       [array]
  -h, --help     Show help                                           [boolean]
  -v, --version  Show version number                                 [boolean]

```

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run bin/sundrop.js
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
