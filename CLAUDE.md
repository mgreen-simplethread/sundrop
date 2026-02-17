# Sundrop SVG Sprite Builder - AI Instructions

## Project Overview

Sundrop is a CLI tool (and library) that builds SVG sprite sheets. It scans project files for references to icon names, finds matching SVG files in configured paths (local dirs or node_modules), optimizes them with SVGO, converts them to `<symbol>` elements, and outputs a single SVG sprite sheet.

**Runtime:** Bun (not Node). Use `bun` for all execution, testing, and package management.

## Architecture

### Entry Points

- `bin/sundrop.ts` - CLI entry point. Parses args with yargs, supports `--watch` mode with debounced rebuilds.
- `index.ts` - Library entry point. Exports `bundleSprites()` orchestrator function plus `IconSearch` and `SpriteGenerator` classes.

### Core Modules (`lib/`)

- `icon-search.ts` - `IconSearch` class. Builds an index of available SVG icons from configured paths (supports local dirs and npm packages via `import.meta.resolve`). Scans project files matching a glob pattern, tokenizes the corpus, then does O(1) lookups against the index to find referenced icons. Supports icon aliases and ID prefixes.
- `sprite-generator.ts` - `SpriteGenerator` class. Takes matched icon files, concatenates their SVG content with prefixed IDs, then runs through SVGO with custom plugins (`convertSvgToSymbol`, `addCurrentColorFill`) to produce the final sprite sheet.
- `types.ts` - Utility type `RequiredKeys<T, K>` used to make specific keys required.

### Key Dependencies

- `svgo` (v4) - SVG optimization. Custom plugins in `sprite-generator.ts` convert `<svg>` to `<symbol>` and add `fill="currentColor"` to shape elements.
- `yargs` (v18) - CLI argument parsing with config file support (`--config` / `pkgConf`).

### Data Flow

1. CLI parses options (paths, output file, search glob, aliases, id prefix)
2. `IconSearch.buildIndex()` scans icon directories for `**/*.svg`, maps base filenames (and prefixed variants) to absolute paths, registers aliases
3. `IconSearch.search()` reads project files matching the search glob, tokenizes into a Set, checks each index entry against tokens
4. `SpriteGenerator.concatenateSvgs()` reads matched SVG files, injects prefixed IDs
5. `SpriteGenerator.render()` wraps in sprite template, optimizes with SVGO

## Available Scripts

Execute scripts using `bun run`:

- `format` - runs `prettier` on all source files
- `typecheck` - runs `tsc --noEmit` for project-wide static type check

### Unit Test Suite

Run unit tests using `bun test`. Test files live alongside source in `lib/` (`*.test.ts`).

## Workflow

- Run a static type check after you're done making any TypeScript changes.
- After making changes to any TypeScript or JavaScript file, run unit tests and verify passing status.
- Prior to committing anything to revision control, run the format script.

## Code Style

- Prettier config: 2-space tabs, semicolons, single quotes, 100 char print width (see `package.json` `prettier` key).
- TypeScript with Bun types. Uses Bun-specific APIs (`Bun.file()`, `Bun.write()`, `Bun.argv`, `import.meta.resolve`).

## Git Conventions

Commit messages should have a short, single-line summary of the changes made as the first line, followed by a blank line, followed by a markdown formatted bulleted list summarizing the most relevant changes made. Each bullet should also be a brief, single-line sentence.

Pull requests should always be submitted to the main upstream repository, `mgreen-simplethread/sundrop`, if you're working from a fork (check the value of `git remote show origin`).
