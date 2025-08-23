// Import all shader sources
import preludeFragmentSource from '../../build/min/src/shaders/_prelude.fragment.glsl.js';
import preludeVertexSource from '../../build/min/src/shaders/_prelude.vertex.glsl.js';
import backgroundFragmentSource from '../../build/min/src/shaders/background.fragment.glsl.js';
import backgroundVertexSource from '../../build/min/src/shaders/background.vertex.glsl.js';
import backgroundPatternFragmentSource from '../../build/min/src/shaders/background_pattern.fragment.glsl.js';
import backgroundPatternVertexSource from '../../build/min/src/shaders/background_pattern.vertex.glsl.js';
import circleFragmentSource from '../../build/min/src/shaders/circle.fragment.glsl.js';
import circleVertexSource from '../../build/min/src/shaders/circle.vertex.glsl.js';
import clippingMaskFragmentSource from '../../build/min/src/shaders/clipping_mask.fragment.glsl.js';
import clippingMaskVertexSource from '../../build/min/src/shaders/clipping_mask.vertex.glsl.js';
import collisionBoxFragmentSource from '../../build/min/src/shaders/collision_box.fragment.glsl.js';
import collisionBoxVertexSource from '../../build/min/src/shaders/collision_box.vertex.glsl.js';
import collisionCircleFragmentSource from '../../build/min/src/shaders/collision_circle.fragment.glsl.js';
import collisionCircleVertexSource from '../../build/min/src/shaders/collision_circle.vertex.glsl.js';
import debugFragmentSource from '../../build/min/src/shaders/debug.fragment.glsl.js';
import debugVertexSource from '../../build/min/src/shaders/debug.vertex.glsl.js';
import fillFragmentSource from '../../build/min/src/shaders/fill.fragment.glsl.js';
import fillVertexSource from '../../build/min/src/shaders/fill.vertex.glsl.js';
import fillExtrusionFragmentSource from '../../build/min/src/shaders/fill_extrusion.fragment.glsl.js';
import fillExtrusionVertexSource from '../../build/min/src/shaders/fill_extrusion.vertex.glsl.js';
import fillExtrusionPatternFragmentSource from '../../build/min/src/shaders/fill_extrusion_pattern.fragment.glsl.js';
import fillExtrusionPatternVertexSource from '../../build/min/src/shaders/fill_extrusion_pattern.vertex.glsl.js';
import fillOutlineFragmentSource from '../../build/min/src/shaders/fill_outline.fragment.glsl.js';
import fillOutlineVertexSource from '../../build/min/src/shaders/fill_outline.vertex.glsl.js';
import fillOutlinePatternFragmentSource from '../../build/min/src/shaders/fill_outline_pattern.fragment.glsl.js';
import fillOutlinePatternVertexSource from '../../build/min/src/shaders/fill_outline_pattern.vertex.glsl.js';
import fillPatternFragmentSource from '../../build/min/src/shaders/fill_pattern.fragment.glsl.js';
import fillPatternVertexSource from '../../build/min/src/shaders/fill_pattern.vertex.glsl.js';
import heatmapFragmentSource from '../../build/min/src/shaders/heatmap.fragment.glsl.js';
import heatmapVertexSource from '../../build/min/src/shaders/heatmap.vertex.glsl.js';
import heatmapTextureFragmentSource from '../../build/min/src/shaders/heatmap_texture.fragment.glsl.js';
import heatmapTextureVertexSource from '../../build/min/src/shaders/heatmap_texture.vertex.glsl.js';
import hillshadeFragmentSource from '../../build/min/src/shaders/hillshade.fragment.glsl.js';
import hillshadeVertexSource from '../../build/min/src/shaders/hillshade.vertex.glsl.js';
import hillshadePrepareFragmentSource from '../../build/min/src/shaders/hillshade_prepare.fragment.glsl.js';
import hillshadePrepareVertexSource from '../../build/min/src/shaders/hillshade_prepare.vertex.glsl.js';
import lineFragmentSource from '../../build/min/src/shaders/line.fragment.glsl.js';
import lineVertexSource from '../../build/min/src/shaders/line.vertex.glsl.js';
import lineGradientFragmentSource from '../../build/min/src/shaders/line_gradient.fragment.glsl.js';
import lineGradientVertexSource from '../../build/min/src/shaders/line_gradient.vertex.glsl.js';
import linePatternFragmentSource from '../../build/min/src/shaders/line_pattern.fragment.glsl.js';
import linePatternVertexSource from '../../build/min/src/shaders/line_pattern.vertex.glsl.js';
import lineSDFFragmentSource from '../../build/min/src/shaders/line_sdf.fragment.glsl.js';
import lineSDFVertexSource from '../../build/min/src/shaders/line_sdf.vertex.glsl.js';
import rasterFragmentSource from '../../build/min/src/shaders/raster.fragment.glsl.js';
import rasterVertexSource from '../../build/min/src/shaders/raster.vertex.glsl.js';
import symbolIconFragmentSource from '../../build/min/src/shaders/symbol_icon.fragment.glsl.js';
import symbolIconVertexSource from '../../build/min/src/shaders/symbol_icon.vertex.glsl.js';
import symbolSDFFragmentSource from '../../build/min/src/shaders/symbol_sdf.fragment.glsl.js';
import symbolSDFVertexSource from '../../build/min/src/shaders/symbol_sdf.vertex.glsl.js';

const shaders = {
  prelude: {
    fragmentSource: preludeFragmentSource,
    vertexSource: preludeVertexSource
  },
  background: {
    fragmentSource: backgroundFragmentSource,
    vertexSource: backgroundVertexSource
  },
  backgroundPattern: {
    fragmentSource: backgroundPatternFragmentSource,
    vertexSource: backgroundPatternVertexSource
  },
  circle: {
    fragmentSource: circleFragmentSource,
    vertexSource: circleVertexSource
  },
  clippingMask: {
    fragmentSource: clippingMaskFragmentSource,
    vertexSource: clippingMaskVertexSource
  },
  heatmap: {
    fragmentSource: heatmapFragmentSource,
    vertexSource: heatmapVertexSource
  },
  heatmapTexture: {
    fragmentSource: heatmapTextureFragmentSource,
    vertexSource: heatmapTextureVertexSource
  },
  collisionBox: {
    fragmentSource: collisionBoxFragmentSource,
    vertexSource: collisionBoxVertexSource
  },
  collisionCircle: {
    fragmentSource: collisionCircleFragmentSource,
    vertexSource: collisionCircleVertexSource
  },
  debug: {
    fragmentSource: debugFragmentSource,
    vertexSource: debugVertexSource
  },
  fill: {
    fragmentSource: fillFragmentSource,
    vertexSource: fillVertexSource
  },
  fillOutline: {
    fragmentSource: fillOutlineFragmentSource,
    vertexSource: fillOutlineVertexSource
  },
  fillOutlinePattern: {
    fragmentSource: fillOutlinePatternFragmentSource,
    vertexSource: fillOutlinePatternVertexSource
  },
  fillPattern: {
    fragmentSource: fillPatternFragmentSource,
    vertexSource: fillPatternVertexSource
  },
  fillExtrusion: {
    fragmentSource: fillExtrusionFragmentSource,
    vertexSource: fillExtrusionVertexSource
  },
  fillExtrusionPattern: {
    fragmentSource: fillExtrusionPatternFragmentSource,
    vertexSource: fillExtrusionPatternVertexSource
  },
  hillshadePrepare: {
    fragmentSource: hillshadePrepareFragmentSource,
    vertexSource: hillshadePrepareVertexSource
  },
  hillshade: {
    fragmentSource: hillshadeFragmentSource,
    vertexSource: hillshadeVertexSource
  },
  line: {
    fragmentSource: lineFragmentSource,
    vertexSource: lineVertexSource
  },
  lineGradient: {
    fragmentSource: lineGradientFragmentSource,
    vertexSource: lineGradientVertexSource
  },
  linePattern: {
    fragmentSource: linePatternFragmentSource,
    vertexSource: linePatternVertexSource
  },
  lineSDF: {
    fragmentSource: lineSDFFragmentSource,
    vertexSource: lineSDFVertexSource
  },
  raster: {
    fragmentSource: rasterFragmentSource,
    vertexSource: rasterVertexSource
  },
  symbolIcon: {
    fragmentSource: symbolIconFragmentSource,
    vertexSource: symbolIconVertexSource
  },
  symbolSDF: {
    fragmentSource: symbolSDFFragmentSource,
    vertexSource: symbolSDFVertexSource
  }
};

// Expand #pragmas to #ifdefs.

const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;

for (const programName in shaders) {
  const program = shaders[programName];
  const fragmentPragmas = {};

  program.fragmentSource = program.fragmentSource.replace(re, (match, operation, precision, type, name) => {
    fragmentPragmas[name] = true;
    if (operation === 'define') {
      return `
#ifndef HAS_UNIFORM_u_${name}
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
    }
    return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
  });

  program.vertexSource = program.vertexSource.replace(re, (match, operation, precision, type, name) => {
    const attrType = type === 'float' ? 'vec2' : 'vec4';
    const unpackType = name.match(/color/) ? 'color' : attrType;

    if (fragmentPragmas[name]) {
      if (operation === 'define') {
        return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
      }
      if (unpackType === 'vec4') {
        // vec4 attributes are only used for cross-faded properties, and are not packed
        return `
#ifndef HAS_UNIFORM_u_${name}
${name} = a_${name};
#else
${precision} ${type} ${name} = u_${name};
#endif
`;
      }
      return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${unpackType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
    }
    if (operation === 'define') {
      return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
    }
    if (unpackType === 'vec4') {
      // vec4 attributes are only used for cross-faded properties, and are not packed
      return `
#ifndef HAS_UNIFORM_u_${name}
${precision} ${type} ${name} = a_${name};
#else
${precision} ${type} ${name} = u_${name};
#endif
`;
    }
    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
  });
}

export default shaders;
