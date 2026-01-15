import { IconSearch } from './lib/icon-search';
import { SpriteGenerator } from './lib/sprite-generator';

interface BundleSpritesConfig {
  cwd: string;
  paths?: string[];
  aliases: Record<string, string>;
  searchPattern: string;
  idPrefix: string;
  out: string;
}

export async function bundleSprites(config: BundleSpritesConfig) {
  const iconSearchConfig = {
    cwd: config.cwd,
    paths: config.paths,
    aliases: config.aliases,
    searchPattern: config.searchPattern,
    idPrefix: config.idPrefix,
  };

  const searcher = new IconSearch(iconSearchConfig);
  const matches = await searcher.search();

  if (matches.size === 0) {
    console.error('bummer. no icon matches found.');
    return;
  }

  console.log('Found %d matches to bundle up', matches.size);

  const spriteGen = new SpriteGenerator({
    inputFiles: matches,
    idPrefix: config.idPrefix,
  });

  const spriteSheet = await spriteGen.render();
  const outFile = Bun.file(config.out);
  const bytes = await Bun.write(outFile, spriteSheet);

  console.log('Saved SVG sprite to %s (%d bytes)', config.out, bytes);
}

export { IconSearch } from './lib/icon-search';
export { SpriteGenerator } from './lib/sprite-generator';
