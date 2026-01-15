import { describe, test, expect, beforeAll, afterAll, spyOn } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleSprites } from './index';
import { IconSearch } from './lib/icon-search';
import { SpriteGenerator } from './lib/sprite-generator';

const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h16z"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';

describe('bundleSprites', () => {
  let tempDir: string;
  let iconsDir: string;
  let srcDir: string;
  let outFile: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sundrop-bundle-test-'));
    iconsDir = join(tempDir, 'icons');
    srcDir = join(tempDir, 'src');
    outFile = join(tempDir, 'sprites.svg');

    await mkdir(iconsDir);
    await mkdir(srcDir);

    await writeFile(join(iconsDir, 'arrow.svg'), ARROW_SVG);
    await writeFile(join(iconsDir, 'close.svg'), CLOSE_SVG);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('IconSearch integration', () => {
    test('creates IconSearch with correct config', async () => {
      await writeFile(join(srcDir, 'page.html'), '<use href="#arrow"></use>');

      const config = {
        cwd: tempDir,
        paths: ['./icons'],
        aliases: { back: 'arrow' },
        searchPattern: 'src/**/*.html',
        idPrefix: 'icon-',
        out: outFile,
      };

      const searchSpy = spyOn(IconSearch.prototype, 'search');

      await bundleSprites(config);

      expect(searchSpy).toHaveBeenCalled();
      searchSpy.mockRestore();
    });

    test('calls search() on IconSearch instance', async () => {
      await writeFile(join(srcDir, 'test.html'), '<use href="#arrow"></use>');

      const searchSpy = spyOn(IconSearch.prototype, 'search');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/test.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(searchSpy).toHaveBeenCalledTimes(1);
      searchSpy.mockRestore();
    });
  });

  describe('early exit on no matches', () => {
    test('returns early when no icons are found', async () => {
      await writeFile(join(srcDir, 'empty.html'), '<div>no icons</div>');

      const renderSpy = spyOn(SpriteGenerator.prototype, 'render');
      const errorSpy = spyOn(console, 'error');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/empty.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(renderSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('bummer. no icon matches found.');

      renderSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('SpriteGenerator integration', () => {
    test('creates SpriteGenerator with matches and idPrefix', async () => {
      await writeFile(join(srcDir, 'icons.html'), '<use href="#arrow"></use>');

      const renderSpy = spyOn(SpriteGenerator.prototype, 'render');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/icons.html',
        idPrefix: 'custom-',
        out: outFile,
      });

      expect(renderSpy).toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    test('calls render() on SpriteGenerator', async () => {
      await writeFile(join(srcDir, 'render.html'), '<use href="#close"></use>');

      const renderSpy = spyOn(SpriteGenerator.prototype, 'render');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/render.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);
      renderSpy.mockRestore();
    });
  });

  describe('file output', () => {
    test('writes sprite sheet to output file', async () => {
      await writeFile(join(srcDir, 'output.html'), '<use href="#arrow"></use>');
      const outputPath = join(tempDir, 'output-test.svg');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/output.html',
        idPrefix: 'icon-',
        out: outputPath,
      });

      const outputFile = Bun.file(outputPath);
      expect(await outputFile.exists()).toBe(true);

      const content = await outputFile.text();
      expect(content).toContain('<svg');
      expect(content).toContain('icon-arrow');
    });

    test('output contains optimized SVG sprite', async () => {
      await writeFile(
        join(srcDir, 'multi.html'),
        '<use href="#arrow"></use><use href="#close"></use>'
      );
      const outputPath = join(tempDir, 'multi-test.svg');

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/multi.html',
        idPrefix: 'icon-',
        out: outputPath,
      });

      const content = await Bun.file(outputPath).text();

      // Should have wrapper SVG with hidden positioning
      expect(content).toContain('width="0"');
      expect(content).toContain('height="0"');
      expect(content).toContain('position:absolute');

      // Should contain symbols for both icons
      expect(content).toContain('<symbol');
      expect(content).toContain('icon-arrow');
      expect(content).toContain('icon-close');
    });
  });

  describe('config passthrough', () => {
    test('passes cwd to IconSearch', async () => {
      await writeFile(join(srcDir, 'cwd.html'), '<use href="#arrow"></use>');

      let capturedCwd: string | undefined;
      const originalSearch = IconSearch.prototype.search;

      IconSearch.prototype.search = async function () {
        capturedCwd = this.options.cwd;
        return originalSearch.call(this);
      };

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/cwd.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(capturedCwd).toBe(tempDir);
      IconSearch.prototype.search = originalSearch;
    });

    test('passes paths to IconSearch', async () => {
      await writeFile(join(srcDir, 'paths.html'), '<use href="#arrow"></use>');

      let capturedPaths: string[] | undefined;
      const originalSearch = IconSearch.prototype.search;

      IconSearch.prototype.search = async function () {
        capturedPaths = this.options.paths;
        return originalSearch.call(this);
      };

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/paths.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(capturedPaths).toEqual(['./icons']);
      IconSearch.prototype.search = originalSearch;
    });

    test('passes aliases to IconSearch', async () => {
      await writeFile(join(srcDir, 'alias.html'), '<use href="#back"></use>');

      let capturedAliases: Record<string, string> | undefined;
      const originalSearch = IconSearch.prototype.search;

      IconSearch.prototype.search = async function () {
        capturedAliases = this.options.aliases;
        return originalSearch.call(this);
      };

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: { back: 'arrow' },
        searchPattern: 'src/**/alias.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(capturedAliases).toEqual({ back: 'arrow' });
      IconSearch.prototype.search = originalSearch;
    });

    test('passes searchPattern to IconSearch', async () => {
      await writeFile(join(srcDir, 'pattern.html'), '<use href="#arrow"></use>');

      let capturedPattern: string | undefined;
      const originalSearch = IconSearch.prototype.search;

      IconSearch.prototype.search = async function () {
        capturedPattern = this.options.searchPattern;
        return originalSearch.call(this);
      };

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/pattern.html',
        idPrefix: 'icon-',
        out: outFile,
      });

      expect(capturedPattern).toBe('src/**/pattern.html');
      IconSearch.prototype.search = originalSearch;
    });

    test('passes idPrefix to both IconSearch and SpriteGenerator', async () => {
      await writeFile(join(srcDir, 'prefix.html'), '<use href="#custom-arrow"></use>');

      let searchPrefix: string | string[] | undefined;
      let generatorPrefix: string | undefined;

      const originalSearch = IconSearch.prototype.search;
      const originalRender = SpriteGenerator.prototype.render;

      IconSearch.prototype.search = async function () {
        searchPrefix = this.options.idPrefix;
        return originalSearch.call(this);
      };

      SpriteGenerator.prototype.render = async function () {
        generatorPrefix = this.options.idPrefix;
        return originalRender.call(this);
      };

      await bundleSprites({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: {},
        searchPattern: 'src/**/prefix.html',
        idPrefix: 'custom-',
        out: outFile,
      });

      expect(searchPrefix).toBe('custom-');
      expect(generatorPrefix).toBe('custom-');

      IconSearch.prototype.search = originalSearch;
      SpriteGenerator.prototype.render = originalRender;
    });
  });
});
