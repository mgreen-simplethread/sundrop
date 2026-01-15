import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpriteGenerator, DEFAULT_SVGO_PLUGINS } from './sprite-generator';

// Sample SVG content for fixtures
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h16z"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
const USER_SVG = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>';
const SVG_WITH_FILL = '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M12 4l-8 8h16z"/></svg>';
const SVG_WITH_STYLE_FILL =
  '<svg viewBox="0 0 24 24"><path style="fill:#00ff00" d="M12 4l-8 8h16z"/></svg>';
const SVG_WITH_DIMENSIONS =
  '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z"/></svg>';

describe('SpriteGenerator', () => {
  let tempDir: string;
  let iconsDir: string;

  beforeAll(async () => {
    // Create temporary directory structure for tests
    tempDir = await mkdtemp(join(tmpdir(), 'sundrop-sprite-test-'));
    iconsDir = join(tempDir, 'icons');

    await mkdir(iconsDir);

    // Create test SVG files
    await writeFile(join(iconsDir, 'arrow.svg'), ARROW_SVG);
    await writeFile(join(iconsDir, 'close.svg'), CLOSE_SVG);
    await writeFile(join(iconsDir, 'user.svg'), USER_SVG);
    await writeFile(join(iconsDir, 'colored.svg'), SVG_WITH_FILL);
    await writeFile(join(iconsDir, 'styled.svg'), SVG_WITH_STYLE_FILL);
    await writeFile(join(iconsDir, 'sized.svg'), SVG_WITH_DIMENSIONS);
  });

  afterAll(async () => {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Constructor & Defaults', () => {
    test('uses default SVGO plugins', () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
      });
      expect(generator.options.svgoPlugins).toBe(DEFAULT_SVGO_PLUGINS);
    });

    test('uses default idPrefix', () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
      });
      expect(generator.options.idPrefix).toBe('icon-');
    });

    test('uses default spriteTemplate', () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
      });
      const result = generator.options.spriteTemplate('<symbol id="test"></symbol>');
      expect(result).toContain('<svg');
      expect(result).toContain('width="0"');
      expect(result).toContain('height="0"');
      expect(result).toContain('position:absolute');
    });

    test('uses default transformIcon (identity function)', () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
      });
      const input = { test: 'value' };
      expect(generator.options.transformIcon(input)).toBe(input);
    });

    test('accepts custom svgoPlugins', () => {
      const customPlugins = ['removeDoctype'];
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
        svgoPlugins: customPlugins,
      });
      expect(generator.options.svgoPlugins).toBe(customPlugins);
    });

    test('accepts custom idPrefix', () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
        idPrefix: 'custom-',
      });
      expect(generator.options.idPrefix).toBe('custom-');
    });

    test('accepts custom spriteTemplate', () => {
      const customTemplate = (symbols: string) => `<custom>${symbols}</custom>`;
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
        spriteTemplate: customTemplate,
      });
      expect(generator.options.spriteTemplate('<test/>')).toBe('<custom><test/></custom>');
    });
  });

  describe('concatenateSvgs()', () => {
    test('reads SVG files from inputFiles map', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('viewBox="0 0 24 24"');
      expect(result).toContain('<path');
    });

    test('injects ID attribute into SVG tag', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('id="icon-arrow"');
    });

    test('applies idPrefix to IDs', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({
        inputFiles,
        idPrefix: 'custom-',
      });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('id="custom-arrow"');
    });

    test('handles empty idPrefix', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({
        inputFiles,
        idPrefix: '',
      });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('id="arrow"');
    });

    test('handles empty inputFiles', async () => {
      const generator = new SpriteGenerator({
        inputFiles: new Map(),
      });
      const result = await generator.concatenateSvgs();

      expect(result).toBe('');
    });

    test('joins multiple SVGs with newlines', async () => {
      const inputFiles = new Map([
        ['arrow', join(iconsDir, 'arrow.svg')],
        ['close', join(iconsDir, 'close.svg')],
      ]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('id="icon-arrow"');
      expect(result).toContain('id="icon-close"');
      expect(result.split('\n').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('render()', () => {
    test('wraps symbols in sprite template', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      expect(result).toMatch(/^<svg[^>]*>/);
      expect(result).toMatch(/<\/svg>$/);
    });

    test('converts inner SVGs to symbols', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      expect(result).toContain('<symbol');
      expect(result).toContain('</symbol>');
      // Inner SVG should be converted, not remain as svg
      expect(result.match(/<svg/g)?.length).toBe(1); // Only the outer wrapper
    });

    test('adds currentColor fill to shapes without fill', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      expect(result).toContain('fill="currentColor"');
    });

    test('preserves existing fill attributes', async () => {
      const inputFiles = new Map([['colored', join(iconsDir, 'colored.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      // Should preserve the original fill, not add currentColor
      // Note: SVGO's convertColors plugin converts #ff0000 to "red"
      expect(result).toContain('fill="red"');
      expect(result).not.toContain('fill="currentColor"');
    });

    test('preserves fill in style attribute', async () => {
      const inputFiles = new Map([['styled', join(iconsDir, 'styled.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      // Should not add currentColor when fill is in style
      expect(result).not.toContain('fill="currentColor"');
    });

    test('removes width and height from symbols', async () => {
      const inputFiles = new Map([['sized', join(iconsDir, 'sized.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      // The symbol should not have width/height (outer svg may have width="0" height="0")
      const symbolMatch = result.match(/<symbol[^>]*>/);
      expect(symbolMatch).not.toBeNull();
      expect(symbolMatch![0]).not.toContain('width="24"');
      expect(symbolMatch![0]).not.toContain('height="24"');
    });

    test('returns optimized SVG string', async () => {
      const inputFiles = new Map([['arrow', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      // Should be minified (no excessive whitespace)
      expect(result).not.toContain('\n\n');
      // Should not have comments
      expect(result).not.toContain('<!--');
    });

    test('handles multiple icons in sprite', async () => {
      const inputFiles = new Map([
        ['arrow', join(iconsDir, 'arrow.svg')],
        ['close', join(iconsDir, 'close.svg')],
        ['user', join(iconsDir, 'user.svg')],
      ]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      expect(result).toContain('id="icon-arrow"');
      expect(result).toContain('id="icon-close"');
      expect(result).toContain('id="icon-user"');
      expect(result.match(/<symbol/g)?.length).toBe(3);
    });
  });

  describe('DEFAULT_SVGO_PLUGINS', () => {
    test('includes convertSvgToSymbol plugin', () => {
      const hasPlugin = DEFAULT_SVGO_PLUGINS.some(
        (p) => typeof p === 'object' && p.name === 'convertSvgToSymbol'
      );
      expect(hasPlugin).toBe(true);
    });

    test('includes addCurrentColorFill plugin', () => {
      const hasPlugin = DEFAULT_SVGO_PLUGINS.some(
        (p) => typeof p === 'object' && p.name === 'addCurrentColorFillAttr'
      );
      expect(hasPlugin).toBe(true);
    });

    test('includes removeAttrs plugin for width/height', () => {
      const removeAttrsPlugin = DEFAULT_SVGO_PLUGINS.find(
        (p) => typeof p === 'object' && p.name === 'removeAttrs'
      );
      expect(removeAttrsPlugin).toBeDefined();
      expect((removeAttrsPlugin as any).params.attrs).toContain('width');
      expect((removeAttrsPlugin as any).params.attrs).toContain('height');
    });

    test('includes standard cleanup plugins', () => {
      expect(DEFAULT_SVGO_PLUGINS).toContain('removeDoctype');
      expect(DEFAULT_SVGO_PLUGINS).toContain('removeComments');
      expect(DEFAULT_SVGO_PLUGINS).toContain('removeMetadata');
    });
  });

  describe('Edge Cases', () => {
    test('handles SVG with no space after opening tag', async () => {
      // Create SVG with attributes directly after <svg
      const noSpaceSvg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
      await writeFile(join(iconsDir, 'nospace.svg'), noSpaceSvg);

      const inputFiles = new Map([['nospace', join(iconsDir, 'nospace.svg')]]);
      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.render();

      expect(result).toContain('id="icon-nospace"');
    });

    test('handles empty icon name', async () => {
      const inputFiles = new Map([['', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.concatenateSvgs();

      // Empty id should result in id=""
      expect(result).toContain('id=""');
    });

    test('handles icon name with special characters', async () => {
      const inputFiles = new Map([['arrow-left-24', join(iconsDir, 'arrow.svg')]]);

      const generator = new SpriteGenerator({ inputFiles });
      const result = await generator.concatenateSvgs();

      expect(result).toContain('id="icon-arrow-left-24"');
    });
  });
});
