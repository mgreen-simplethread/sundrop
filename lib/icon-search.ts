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

// Batch size for parallel file reading - tune based on system I/O capacity
const FILE_READ_BATCH_SIZE = 50;

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
  public invalidAliases: Set<string>;

  constructor(options: Partial<IconSearchOptions>) {
    this.options = Object.assign({}, IconSearch.defaults, options) as IconSearchOptions;
    this.index = new Map<string, string>();
    this.idPrefixes = [this.options.idPrefix].flat();
    this.invalidAliases = new Set<string>();
  }

  async search() {
    if (this.index.size === 0) {
      await this.buildIndex();
    }

    console.time(Timers.SCAN);

    // Track which SVG files have already been matched to prevent bundling the same icon twice
    // (e.g., when both "arrow" and "icon-arrow" or an alias reference the same file)
    const bundledFilePaths = new Set<string>();
    const foundMatches = new Map<string, string>();

    // Collect all file paths first for parallel reading
    const filePaths: string[] = [];
    const scanner = glob(this.options.searchPattern, {
      cwd: this.options.cwd as string,
    });

    for await (const filePath of scanner) {
      filePaths.push(resolve(this.options.cwd, filePath));
    }

    // Track remaining icon names for early exit optimization
    const remainingIconNames = new Set(this.index.keys());
    let filesScanned = 0;

    // Process files in parallel batches
    for (let i = 0; i < filePaths.length; i += FILE_READ_BATCH_SIZE) {
      // Early exit: stop if we've found all icons
      if (remainingIconNames.size === 0) {
        console.log(
          'Early exit: all icons found after scanning %d of %d files',
          filesScanned,
          filePaths.length,
        );
        break;
      }

      const batch = filePaths.slice(i, i + FILE_READ_BATCH_SIZE);

      // Read batch of files in parallel
      const fileContents = await Promise.all(batch.map((path) => Bun.file(path).text()));

      // Tokenize each file separately (no join - saves memory)
      for (const content of fileContents) {
        filesScanned++;
        const fileTokens = content.split(IconSearch.tokenizer);

        for (const token of fileTokens) {
          // Skip empty tokens or tokens not in our index
          if (token.length === 0 || !remainingIconNames.has(token)) {
            continue;
          }

          const iconPath = this.index.get(token)!;
          if (!bundledFilePaths.has(iconPath)) {
            bundledFilePaths.add(iconPath);
            foundMatches.set(token, iconPath);
          }

          // Remove from remaining set (we found this icon name)
          remainingIconNames.delete(token);
        }
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
        this.invalidAliases.add(alias);
        continue;
      }

      this.index.set(alias, this.index.get(iconId) as string);
      validAliases++;
    }

    console.timeEnd(Timers.BUILD_INDEX);
    console.log('Indexed %d SVG icons + %d valid aliases', this.index.size, validAliases);
  }

  private idsForIcon(filePath: string): string[] {
    const baseId = basename(filePath, '.svg');
    // Optimized: avoid spread and map for better performance
    const ids = new Array<string>(1 + this.idPrefixes.length);
    ids[0] = baseId;
    for (let i = 0; i < this.idPrefixes.length; i++) {
      ids[i + 1] = this.idPrefixes[i] + baseId;
    }
    return ids;
  }

  private async resolvePackage(name: string) {
    let resolvedPath: string;

    const isNamespaced = name.startsWith('@');
    const nameParts = name.split('/');
    const pkgName = isNamespaced ? nameParts.slice(0, 2).join('/') : nameParts[0]!;
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
