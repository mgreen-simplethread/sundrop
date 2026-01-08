import { optimize } from 'svgo';
import type { CustomPlugin, XastElement } from 'svgo';

const convertSvgToSymbol: CustomPlugin = {
  name: 'convertSvgToSymbol',
  fn: () => ({
    element: {
      enter: (node: XastElement) => {
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

  constructor(options: SpriteGeneratorOptions) {
    this.options = Object.assign({}, SpriteGenerator.defaults, options);
  }

  async concatenateSvgs() {
    let buffer = '';

    // TODO: allow transformation and normalization of ID prefixes
    for (const svgFile of this.options.inputFiles) {
      const rawSvg = await Bun.file(svgFile).text();
      buffer += optimize(rawSvg, { plugins: this.options.svgoPlugins }).data;
    }

    return buffer;
  }

  async render() {
    const symbols = await this.concatenateSvgs();
    return this.options.spriteTemplate(symbols);
  }
}
