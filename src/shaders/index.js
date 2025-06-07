const shaders = {
  prelude: {
    fragmentSource: require('../../build/min/src/shaders/_prelude.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/_prelude.vertex.glsl.js')
  },
  background: {
    fragmentSource: require('../../build/min/src/shaders/background.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/background.vertex.glsl.js')
  },
  backgroundPattern: {
    fragmentSource: require('../../build/min/src/shaders/background_pattern.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/background_pattern.vertex.glsl.js')
  },
  circle: {
    fragmentSource: require('../../build/min/src/shaders/circle.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/circle.vertex.glsl.js')
  },
  clippingMask: {
    fragmentSource: require('../../build/min/src/shaders/clipping_mask.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/clipping_mask.vertex.glsl.js')
  },
  heatmap: {
    fragmentSource: require('../../build/min/src/shaders/heatmap.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/heatmap.vertex.glsl.js')
  },
  heatmapTexture: {
    fragmentSource: require('../../build/min/src/shaders/heatmap_texture.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/heatmap_texture.vertex.glsl.js')
  },
  collisionBox: {
    fragmentSource: require('../../build/min/src/shaders/collision_box.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/collision_box.vertex.glsl.js')
  },
  collisionCircle: {
    fragmentSource: require('../../build/min/src/shaders/collision_circle.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/collision_circle.vertex.glsl.js')
  },
  debug: {
    fragmentSource: require('../../build/min/src/shaders/debug.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/debug.vertex.glsl.js')
  },
  fill: {
    fragmentSource: require('../../build/min/src/shaders/fill.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill.vertex.glsl.js')
  },
  fillOutline: {
    fragmentSource: require('../../build/min/src/shaders/fill_outline.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill_outline.vertex.glsl.js')
  },
  fillOutlinePattern: {
    fragmentSource: require('../../build/min/src/shaders/fill_outline_pattern.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill_outline_pattern.vertex.glsl.js')
  },
  fillPattern: {
    fragmentSource: require('../../build/min/src/shaders/fill_pattern.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill_pattern.vertex.glsl.js')
  },
  fillExtrusion: {
    fragmentSource: require('../../build/min/src/shaders/fill_extrusion.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill_extrusion.vertex.glsl.js')
  },
  fillExtrusionPattern: {
    fragmentSource: require('../../build/min/src/shaders/fill_extrusion_pattern.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/fill_extrusion_pattern.vertex.glsl.js')
  },
  hillshadePrepare: {
    fragmentSource: require('../../build/min/src/shaders/hillshade_prepare.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/hillshade_prepare.vertex.glsl.js')
  },
  hillshade: {
    fragmentSource: require('../../build/min/src/shaders/hillshade.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/hillshade.vertex.glsl.js')
  },
  line: {
    fragmentSource: require('../../build/min/src/shaders/line.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/line.vertex.glsl.js')
  },
  lineGradient: {
    fragmentSource: require('../../build/min/src/shaders/line_gradient.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/line_gradient.vertex.glsl.js')
  },
  linePattern: {
    fragmentSource: require('../../build/min/src/shaders/line_pattern.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/line_pattern.vertex.glsl.js')
  },
  lineSDF: {
    fragmentSource: require('../../build/min/src/shaders/line_sdf.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/line_sdf.vertex.glsl.js')
  },
  raster: {
    fragmentSource: require('../../build/min/src/shaders/raster.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/raster.vertex.glsl.js')
  },
  symbolIcon: {
    fragmentSource: require('../../build/min/src/shaders/symbol_icon.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/symbol_icon.vertex.glsl.js')
  },
  symbolSDF: {
    fragmentSource: require('../../build/min/src/shaders/symbol_sdf.fragment.glsl.js'),
    vertexSource: require('../../build/min/src/shaders/symbol_sdf.vertex.glsl.js')
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

module.exports = shaders;
