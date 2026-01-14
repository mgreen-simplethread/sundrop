import { exists, glob } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';

interface IconSearchOptions {
  cwd: string; // base directory to search for references to icons
  idPrefix: string | string[]; // prefix to use for icon ID attributes
  aliases: Record<string, string>; // alternate names for icons used in project files
  paths: string[]; // filesystem paths and npm module names in which to search for icon SVGs
  // exclude: string[]; // patterns to exclude from the search index
  searchPattern: string; // glob pattern of files to scan for icon name references
}

const Timers = {
  BUILD_INDEX: 'build icon index',
  SCAN: 'scan project files',
};

const pathIsNodeModule = (path: string) => !path.startsWith('.') && !path.startsWith('/');

export class IconSearch {
  public static tokenizer: RegExp = /[^a-zA-Z0-9_:-]+/;

  public static defaults: Partial<IconSearchOptions> = {
    cwd: process.cwd(),
    idPrefix: '',
    aliases: {},
    paths: [],
    searchPattern: '**/*',
  };

  public options: IconSearchOptions;
  public index: Map<string, string>;
  public idPrefixes: string[];

  constructor(options: Partial<IconSearchOptions>) {
    this.options = Object.assign({}, IconSearch.defaults, options) as IconSearchOptions;
    this.index = new Map<string, string>();
    this.idPrefixes = [this.options.idPrefix].flat();
  }

  async search() {
    if (this.index.size === 0) {
      await this.buildIndex();
    }

    console.time(Timers.SCAN);

    let filesScanned = 0;
    // Track which SVG files have already been matched to prevent bundling the same icon twice
    // (e.g., when both "arrow" and "icon-arrow" or an alias reference the same file)
    const bundledFilePaths = new Set<string>();
    const foundMatches = new Map<string, string>();
    const scanner = glob(this.options.searchPattern, {
      cwd: this.options.cwd as string,
    });

    // 1. Read all files into a single buffer
    const chunks: string[] = [];
    for await (const filePath of scanner) {
      const absPath = resolve(this.options.cwd, filePath);
      const file = Bun.file(absPath);
      chunks.push(await file.text());
      filesScanned++;
    }

    // 2. Tokenize the entire corpus at once
    // We join with a newline to prevent tokens from merging across file boundaries
    const corpus = chunks.join('\n');
    const tokens = new Set(corpus.split(IconSearch.tokenizer));

    // 3. Search the index against the found tokens
    // This turns the search inside out: We iterate the Index (7k items) checking against the Corpus (O(1) lookup)
    for (const [iconName, iconPath] of this.index) {
      if (tokens.has(iconName) && !bundledFilePaths.has(iconPath)) {
        bundledFilePaths.add(iconPath);
        foundMatches.set(iconName, iconPath);
      }
    }

    console.timeEnd(Timers.SCAN);
    console.log('Scanned %d files', filesScanned);

    return foundMatches;
  }

  async buildIndex() {
    console.time(Timers.BUILD_INDEX);
    for (const path of this.options.paths) {
      const searchPath = pathIsNodeModule(path)
        ? await this.resolvePackage(path)
        : resolve(this.options.cwd as string, path);
      const scanner = glob('**/*.svg', {
        cwd: searchPath,
      });

      for await (let filePath of scanner) {
        const absPath = resolve(searchPath, filePath);
        const ids = this.idsForIcon(absPath);

        for (const id of ids) {
          this.index.set(id, absPath);
        }
      }
    }

    let validAliases = 0;

    for (const [alias, iconId] of Object.entries(this.options.aliases)) {
      const isValid = this.index.has(iconId);

      if (!isValid) {
        console.log('skipping invalid alias %s', alias);
        continue;
      }

      this.index.set(alias, this.index.get(iconId) as string);
      validAliases++;
    }

    console.timeEnd(Timers.BUILD_INDEX);
    console.log('Indexed %d SVG icons + %d valid aliases', this.index.size, validAliases);
  }

  private idsForIcon(filePath: string) {
    const baseId = basename(filePath, '.svg');
    return [baseId, ...this.idPrefixes.map((pfx) => `${pfx}${baseId}`)];
  }

  private async resolvePackage(name: string) {
    let resolvedPath: string;

    const isNamespaced = name.startsWith('@');
    const nameParts = name.split('/');
    const pkgName = isNamespaced ? nameParts.slice(0, 2).join('/') : nameParts[0];
    const pkgSubpath = isNamespaced ? nameParts.slice(2) : nameParts.slice(1);

    try {
      const modulePackageJson = await import.meta.resolve(join(pkgName, 'package.json'));
      resolvedPath = join(dirname(modulePackageJson.replace('file://', '')), ...pkgSubpath);
    } catch (error) {
      console.log(`Could not resolve ${pkgName}, trying to match path directly in node_modules`);

      resolvedPath = join(process.cwd(), 'node_modules', name);
      console.debug('resolvedPath: %s', resolvedPath);
      const pathExists = await exists(resolvedPath);

      if (!pathExists) {
        throw new Error(`Could not resolve ${pkgName}`);
      }
    }

    return dirname(resolvedPath);
  }
}
