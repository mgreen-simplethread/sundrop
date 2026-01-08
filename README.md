# SunDrop

Dispensing delicious SVG sprites

## About

SunDrop is better than Sprite IRL, but this SunDrop _makes_ sprites by scanning your project files for occurrences of their filenames. Anything it finds in its quest will get blobbed up into a big ball of SVG `<symbol>` elements with distinct IDs that you can `<use>` later. Each symbol is run thru `svgo` and optimized before it's tossed into the sprite.

## CLI

It works but docs are still `TODO`.

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
