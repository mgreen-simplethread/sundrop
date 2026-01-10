import { optimize } from 'svgo';
// const { optimize } = require('svgo');
import type { CustomPlugin, XastElement, XastParent } from 'svgo';

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
];

interface SpriteGeneratorOptions {
  inputFiles: Set<string>;
  svgoPlugins: Array<any>;
  idPrefix?: string;
  transformIcon: (json: any) => any;
  spriteTemplate: (symbolBuffer: string) => string;
}

export default class SpriteGenerator {
  public static defaults: Partial<SpriteGeneratorOptions> = {
    svgoPlugins: DEFAULT_SVGO_PLUGINS,
    transformIcon: (obj) => obj,
    spriteTemplate: (symbolBuffer) =>
      `<svg width="0" height="0" style="position:absolute">${symbolBuffer}</svg>`.trim(),
  };

  declare public options: SpriteGeneratorOptions;
  declare public fileQueue: string[];

  constructor(options: SpriteGeneratorOptions) {
    this.options = Object.assign({}, SpriteGenerator.defaults, options);
    this.fileQueue = Array.from(this.options.inputFiles);
  }

  async concatenateSvgs() {
    // TODO: allow transformation and normalization of ID prefixes
    const fileContents = await Promise.all(
      this.fileQueue.map(async (svgFile) => await Bun.file(svgFile).text()),
    );

    return fileContents.join('\n');
  }

  async render() {
    const symbols = await this.concatenateSvgs();
    return optimize(this.options.spriteTemplate(symbols), {
      plugins: this.options.svgoPlugins,
    }).data;
  }
}
