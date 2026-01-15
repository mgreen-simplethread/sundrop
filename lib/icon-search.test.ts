import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IconSearch } from './icon-search';

// Sample SVG content for fixtures
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h16z"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
const USER_SVG = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>';

describe('IconSearch', () => {
  let tempDir: string;
  let iconsDir: string;
  let srcDir: string;

  beforeAll(async () => {
    // Create temporary directory structure for tests
    tempDir = await mkdtemp(join(tmpdir(), 'sundrop-test-'));
    iconsDir = join(tempDir, 'icons');
    srcDir = join(tempDir, 'src');

    await mkdir(iconsDir);
    await mkdir(srcDir);

    // Create test SVG files
    await writeFile(join(iconsDir, 'arrow.svg'), ARROW_SVG);
    await writeFile(join(iconsDir, 'close.svg'), CLOSE_SVG);
    await writeFile(join(iconsDir, 'user.svg'), USER_SVG);

    // Create nested icon directory
    await mkdir(join(iconsDir, 'actions'));
    await writeFile(join(iconsDir, 'actions', 'delete.svg'), ARROW_SVG);
  });

  afterAll(async () => {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Constructor & Defaults', () => {
    test('uses default cwd when not provided', () => {
      const searcher = new IconSearch({});
      expect(searcher.options.cwd).toBe(process.cwd());
    });

    test('uses default empty aliases', () => {
      const searcher = new IconSearch({});
      expect(searcher.options.aliases).toEqual({});
    });

    test('uses default searchPattern', () => {
      const searcher = new IconSearch({});
      expect(searcher.options.searchPattern).toBe('**/*');
    });

    test('normalizes idPrefix string to array', () => {
      const searcher = new IconSearch({ idPrefix: 'icon-' });
      expect(searcher.idPrefixes).toEqual(['icon-']);
    });

    test('handles idPrefix as array', () => {
      const searcher = new IconSearch({ idPrefix: ['icon-', 'i-'] });
      expect(searcher.idPrefixes).toEqual(['icon-', 'i-']);
    });

    test('overrides defaults with provided options', () => {
      const searcher = new IconSearch({
        cwd: '/custom/path',
        searchPattern: '**/*.html',
      });
      expect(searcher.options.cwd).toBe('/custom/path');
      expect(searcher.options.searchPattern).toBe('**/*.html');
    });

    test('initializes empty invalidAliases set', () => {
      const searcher = new IconSearch({});
      expect(searcher.invalidAliases).toBeInstanceOf(Set);
      expect(searcher.invalidAliases.size).toBe(0);
    });
  });

  describe('buildIndex()', () => {
    test('indexes SVG files from relative path', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
      });

      await searcher.buildIndex();

      expect(searcher.index.has('arrow')).toBe(true);
      expect(searcher.index.has('close')).toBe(true);
      expect(searcher.index.has('user')).toBe(true);
    });

    test('indexes SVG files from nested directories', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
      });

      await searcher.buildIndex();

      expect(searcher.index.has('delete')).toBe(true);
    });

    test('extracts base ID from filename', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
      });

      await searcher.buildIndex();

      const arrowPath = searcher.index.get('arrow');
      expect(arrowPath).toContain('arrow.svg');
    });

    test('creates prefixed index entries', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        idPrefix: 'icon-',
      });

      await searcher.buildIndex();

      // Should have both base and prefixed entries
      expect(searcher.index.has('arrow')).toBe(true);
      expect(searcher.index.has('icon-arrow')).toBe(true);

      // Both should point to the same file
      expect(searcher.index.get('arrow')).toBe(searcher.index.get('icon-arrow'));
    });

    test('creates multiple prefixed entries when idPrefix is array', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        idPrefix: ['icon-', 'i-'],
      });

      await searcher.buildIndex();

      expect(searcher.index.has('arrow')).toBe(true);
      expect(searcher.index.has('icon-arrow')).toBe(true);
      expect(searcher.index.has('i-arrow')).toBe(true);
    });

    test('registers valid aliases', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: { back: 'arrow', x: 'close' },
      });

      await searcher.buildIndex();

      expect(searcher.index.has('back')).toBe(true);
      expect(searcher.index.has('x')).toBe(true);
      expect(searcher.index.get('back')).toBe(searcher.index.get('arrow'));
    });

    test('records invalid aliases in invalidAliases set', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: { invalid: 'nonexistent-icon', alsoInvalid: 'missing' },
      });

      await searcher.buildIndex();

      expect(searcher.index.has('invalid')).toBe(false);
      expect(searcher.index.has('alsoInvalid')).toBe(false);
      expect(searcher.invalidAliases.size).toBe(2);
      expect(searcher.invalidAliases.has('invalid')).toBe(true);
      expect(searcher.invalidAliases.has('alsoInvalid')).toBe(true);
    });

    test('handles empty paths array', async () => {
      const searcher = new IconSearch({
        cwd: tempDir,
        paths: [],
      });

      await searcher.buildIndex();

      expect(searcher.index.size).toBe(0);
    });
  });

  describe('search()', () => {
    test('finds icon by base name', async () => {
      // Create a source file that references an icon
      await writeFile(join(srcDir, 'test.html'), '<use href="#arrow"></use>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        searchPattern: 'src/**/*.html',
      });

      const matches = await searcher.search();

      expect(matches.has('arrow')).toBe(true);
    });

    test('finds icon by prefixed name', async () => {
      await writeFile(join(srcDir, 'prefixed.html'), '<use href="#icon-close"></use>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        idPrefix: 'icon-',
        searchPattern: 'src/**/prefixed.html',
      });

      const matches = await searcher.search();

      expect(matches.has('icon-close')).toBe(true);
    });

    test('finds icon by alias', async () => {
      await writeFile(join(srcDir, 'aliased.html'), '<use href="#back"></use>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        aliases: { back: 'arrow' },
        searchPattern: 'src/**/aliased.html',
      });

      const matches = await searcher.search();

      expect(matches.has('back')).toBe(true);
    });

    test('returns empty map when no matches', async () => {
      await writeFile(join(srcDir, 'empty.html'), '<div>no icons here</div>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        searchPattern: 'src/**/empty.html',
      });

      const matches = await searcher.search();

      expect(matches.size).toBe(0);
    });

    test('deduplicates by file path', async () => {
      // Reference same icon by base name and prefixed name
      await writeFile(
        join(srcDir, 'dupes.html'),
        '<use href="#arrow"></use><use href="#icon-arrow"></use>'
      );

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        idPrefix: 'icon-',
        searchPattern: 'src/**/dupes.html',
      });

      const matches = await searcher.search();

      // Should only have one entry for the arrow icon (first match wins)
      const arrowMatches = [...matches.entries()].filter(([_, path]) => path.includes('arrow.svg'));
      expect(arrowMatches.length).toBe(1);
    });

    test('tokenizes across multiple files', async () => {
      await writeFile(join(srcDir, 'file1.html'), '<use href="#arrow"></use>');
      await writeFile(join(srcDir, 'file2.html'), '<use href="#close"></use>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        searchPattern: 'src/**/file*.html',
      });

      const matches = await searcher.search();

      expect(matches.has('arrow')).toBe(true);
      expect(matches.has('close')).toBe(true);
    });

    test('builds index automatically if empty', async () => {
      await writeFile(join(srcDir, 'auto.html'), '<use href="#user"></use>');

      const searcher = new IconSearch({
        cwd: tempDir,
        paths: ['./icons'],
        searchPattern: 'src/**/auto.html',
      });

      // Don't call buildIndex explicitly
      expect(searcher.index.size).toBe(0);

      const matches = await searcher.search();

      // Index should have been built automatically
      expect(searcher.index.size).toBeGreaterThan(0);
      expect(matches.has('user')).toBe(true);
    });
  });

  describe('Tokenizer', () => {
    test('splits on whitespace', () => {
      const tokens = 'icon-arrow icon-close'.split(IconSearch.tokenizer);
      expect(tokens).toContain('icon-arrow');
      expect(tokens).toContain('icon-close');
    });

    test('splits on punctuation', () => {
      const tokens = 'use(icon-arrow)'.split(IconSearch.tokenizer);
      expect(tokens).toContain('use');
      expect(tokens).toContain('icon-arrow');
    });

    test('preserves hyphens in tokens', () => {
      const tokens = 'icon-arrow-left'.split(IconSearch.tokenizer);
      expect(tokens).toContain('icon-arrow-left');
    });

    test('preserves underscores', () => {
      const tokens = 'icon_arrow'.split(IconSearch.tokenizer);
      expect(tokens).toContain('icon_arrow');
    });

    test('preserves colons', () => {
      const tokens = 'ns:icon'.split(IconSearch.tokenizer);
      expect(tokens).toContain('ns:icon');
    });

    // Note: This test documents expected behavior after the regex bug fix
    test('handles uppercase letters', () => {
      const tokens = 'IconArrow'.split(IconSearch.tokenizer);
      // With fixed regex /[^a-zA-Z0-9_:-]+/, this should stay as one token
      // With buggy regex /[^a-za-z0-9_:-]+/, uppercase letters cause splits
      expect(tokens).toContain('IconArrow');
    });
  });

  describe('idsForIcon()', () => {
    test('returns base ID without prefix', () => {
      const searcher = new IconSearch({ idPrefix: '' });
      // Access private method via any cast for testing
      const ids = (searcher as any).idsForIcon('/path/to/arrow.svg');
      expect(ids).toContain('arrow');
    });

    test('returns base ID and prefixed ID', () => {
      const searcher = new IconSearch({ idPrefix: 'icon-' });
      const ids = (searcher as any).idsForIcon('/path/to/arrow.svg');
      expect(ids).toContain('arrow');
      expect(ids).toContain('icon-arrow');
    });

    test('returns multiple prefixed IDs', () => {
      const searcher = new IconSearch({ idPrefix: ['icon-', 'i-', 'svg-'] });
      const ids = (searcher as any).idsForIcon('/path/to/arrow.svg');
      expect(ids).toContain('arrow');
      expect(ids).toContain('icon-arrow');
      expect(ids).toContain('i-arrow');
      expect(ids).toContain('svg-arrow');
    });
  });
});
