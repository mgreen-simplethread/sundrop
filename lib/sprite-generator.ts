import { optimize } from 'svgo';
import type { CustomPlugin, XastElement, XastParent } from 'svgo';
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
  fn: () => ({
    element: {
      enter: (node: XastElement) => {
        // Leave existing fill attrs and styles intact
        if (
          !['path', 'ellipse', 'rect', 'circle'].includes(node.name) ||
          node.attributes.fill ||
          node.attributes.style?.includes('fill:')
        ) {
          return;
        }

        node.attributes.fill = 'currentColor';
      },
    },
  }),
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
  'convertColors',
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
      attrs: 'symbol:(width|height)',
    },
  },
];

interface SpriteGeneratorOptions {
  inputFiles?: Map<string, string>;
  svgoPlugins?: Array<any>;
  idPrefix?: string;
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

  declare public options: Required<SpriteGeneratorOptions>;
  declare public fileQueue: MapIterator<string[]>;

  constructor(options: RequiredKeys<SpriteGeneratorOptions, 'inputFiles'>) {
    this.options = Object.assign({}, SpriteGenerator.defaults, options);
    this.fileQueue = this.options.inputFiles.entries();
  }

  async concatenateSvgs() {
    // TODO: allow transformation and normalization of ID prefixes
    const fileContents = [];
    for (const [id, file] of this.fileQueue) {
      if (!file) continue;
      const svg = await Bun.file(file).text();
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
