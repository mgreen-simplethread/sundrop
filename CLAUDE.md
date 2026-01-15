# Sundrop SVG Sprite Builder - AI Instructions

## Available Scripts

Scan package.json and refer to the `scripts` property. Execute scripts using `bun run`. Relevant scripts for the dev workflow are:

- `format` - runs `prettier` on all source files
- `typecheck` - runs a project-wide static type check
- `lint` - runs eslint

### Unit Test Suite

Run unit test using `bun test`

## Workflow

- Run a static type check after you're done making any TypeScript changes.
- After making changes to any TypeScript or JavaScript file, run unit tests and verify passing status.
- Prior to committing anything to revision control, run the format script.

## Git Conventions

Commit messages should have a short, single-line summary of the changes made as the first line, followed by a blank line, followed by a markdown formatted bulleted list summarizing the most relevant changes made. Each bullet should also be a brief, single-line sentence.

Pull requests should always be submitted to the main upstream repository, `mgreen-simplethread/sundrop`, if you're working from a fork (check the value of `git remote show origin`).
