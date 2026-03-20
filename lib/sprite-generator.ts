import { readFile } from 'node:fs/promises';
import type { CustomPlugin, XastElement, XastParent } from 'svgo';
import { optimize } from 'svgo';
import type { RequiredKeys } from './types';

const convertSvgToSymbol: CustomPlugin = {
  name: 'convertSvgToSymbol',
  fn: () => ({
    element: {
      enter: (node: XastElement, parentNode: XastParent) => {
        if (parentNode.type === 'root') return;

        if (node.name === 'svg') {
          node.name = 'symbol';
        }
      },
    },
  }),
};

const addCurrentColorFill: CustomPlugin = {
  name: 'addCurrentColorFillAttr',
  fn: (_root, params) => {
    const skipPattern = params?.skipIds ? new RegExp(params.skipIds as string) : null;
    let skipCurrentSymbol = false;

    return {
      element: {
        enter: (node: XastElement) => {
          if (node.name === 'symbol') {
            skipCurrentSymbol = !!(
              skipPattern &&
              node.attributes.id &&
              skipPattern.test(node.attributes.id)
            );
            return;
          }

          if (
            skipCurrentSymbol ||
            !['path', 'ellipse', 'rect', 'circle'].includes(node.name) ||
            node.attributes.fill ||
            node.attributes.style?.includes('fill:')
          ) {
            return;
          }

          node.attributes.fill = 'currentColor';
        },
        exit: (node: XastElement) => {
          if (node.name === 'symbol') {
            skipCurrentSymbol = false;
          }
        },
      },
    };
  },
};

export const DEFAULT_SVGO_PLUGINS = [
  'removeDoctype',
  'removeXMLProcInst',
  'removeXMLNS',
  'removeComments',
  'removeDeprecatedAttrs',
  'removeMetadata',
  'removeEditorsNSData',
  'cleanupAttrs',
  'mergeStyles',
  'inlineStyles',
  'minifyStyles',
  'cleanupNumericValues',
  {
    name: 'convertColors',
    params: {
      currentColor: true,
    },
  },
  'removeUnknownsAndDefaults',
  'removeNonInheritableGroupAttrs',
  'removeUselessStrokeAndFill',
  'cleanupEnableBackground',
  'removeHiddenElems',
  'removeEmptyText',
  'convertShapeToPath',
  'convertEllipseToCircle',
  'moveElemsAttrsToGroup',
  'moveGroupAttrsToElems',
  'collapseGroups',
  'convertPathData',
  'convertTransform',
  'removeEmptyAttrs',
  'removeEmptyContainers',
  'mergePaths',
  'removeUnusedNS',
  'sortAttrs',
  'sortDefsChildren',
  'removeDesc',
  convertSvgToSymbol,
  addCurrentColorFill,
  {
    name: 'removeAttrs',
    params: {
      attrs: ['symbol:(width|height)', 'path:(fill-opacity)'],
    },
  },
];

interface SpriteGeneratorOptions {
  inputFiles?: Map<string, string>;
  svgoPlugins?: Array<any>;
  idPrefix?: string;
  noFillIds?: string;
  transformIcon?: (json: any) => any;
  spriteTemplate?: (symbolBuffer: string) => string;
}

export class SpriteGenerator {
  public static defaults: RequiredKeys<
    SpriteGeneratorOptions,
    'svgoPlugins' | 'transformIcon' | 'idPrefix' | 'spriteTemplate'
  > = {
    svgoPlugins: DEFAULT_SVGO_PLUGINS,
    transformIcon: (obj) => obj,
    idPrefix: 'icon-',
    spriteTemplate: (symbolBuffer) =>
      `<svg width="0" height="0" style="position:absolute">${symbolBuffer}</svg>`.trim(),
  };

  public declare options: RequiredKeys<
    SpriteGeneratorOptions,
    'inputFiles' | 'svgoPlugins' | 'transformIcon' | 'idPrefix' | 'spriteTemplate'
  >;
  public declare fileQueue: MapIterator<string[]>;

  constructor(options: RequiredKeys<SpriteGeneratorOptions, 'inputFiles'>) {
    this.options = Object.assign({}, SpriteGenerator.defaults, options);
    if (options.noFillIds) {
      this.options.svgoPlugins = this.options.svgoPlugins.map((p) => {
        if (typeof p === 'object' && p.name === 'addCurrentColorFillAttr') {
          return { ...p, params: { skipIds: options.noFillIds } };
        }
        return p;
      });
    }
    this.fileQueue = this.options.inputFiles.entries();
  }

  async concatenateSvgs() {
    // TODO: allow transformation and normalization of ID prefixes
    const fileContents = [];
    for (const [id, file] of this.fileQueue) {
      if (!file) continue;
      const svg = await readFile(file, 'utf-8');
      const outputId = id ? `${this.options.idPrefix}${id}` : id;
      fileContents.push(svg.replace(/^<svg\s+/, `<svg id="${outputId}" `));
    }

    return fileContents.join('\n');
  }

  async render() {
    const symbols = await this.concatenateSvgs();
    return optimize(this.options.spriteTemplate(symbols), {
      plugins: this.options.svgoPlugins,
    }).data;
  }
}
