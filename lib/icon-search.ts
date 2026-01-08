import { Glob } from 'bun';
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

const pathIsNodeModule = (path: string) => !/^[\.\/]/.test(path);

export default class IconSearch {
  public static tokenizer: RegExp = /[^a-za-z0-9_:-]+/;

  public static defaults: Partial<IconSearchOptions> = {
    cwd: process.cwd(),
    idPrefix: 'icon-',
    aliases: {},
    searchPattern: '**/*',
  };

  public options: IconSearchOptions;
  public index: Map<string, string>;
  public indexFiles: Glob;
  public searchFiles: Glob;
  public idPrefixes: string[];

  constructor(options: IconSearchOptions) {
    this.options = Object.assign({}, IconSearch.defaults, options);
    this.index = new Map<string, string>();
    this.indexFiles = new Glob('**/*.svg');
    this.searchFiles = new Glob(this.options.searchPattern);
    this.idPrefixes = [this.options.idPrefix].flat();
  }

  async search() {
    if (this.index.size === 0) {
      await this.buildIndex();
    }

    console.time(Timers.SCAN);

    let filesScanned = 0;
    const foundMatches = new Set<string>();
    const scanner = this.searchFiles.scan({
      cwd: this.options.cwd as string,
      onlyFiles: true,
      absolute: true,
    });

    for await (let filePath of scanner) {
      const tokens = await this.tokenizeFile(filePath);

      for (const token of tokens) {
        if (token && this.index.has(token)) {
          foundMatches.add(this.index.get(token) as string);
          console.log('Found token match for icon (%s) in file %s', token, filePath);
        }
      }
      filesScanned++;
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
      const scanner = this.indexFiles.scan({
        cwd: searchPath,
        onlyFiles: true,
        absolute: true,
      });

      for await (let filePath of scanner) {
        const ids = this.idsForIcon(filePath);

        for (const id of ids) {
          this.index.set(id, filePath);
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
    return this.idPrefixes.map((pfx) => `${pfx}${basename(filePath, '.svg')}`);
  }

  private async tokenizeFile(filePath: string) {
    const file = Bun.file(filePath);
    const contents = await file.text();
    return contents.split(IconSearch.tokenizer);
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
      const exists = await Bun.file(resolvedPath).exists();

      if (!exists) {
        throw new Error(`Could not resolve ${pkgName}`);
      }
    }

    return dirname(resolvedPath);
  }
}
