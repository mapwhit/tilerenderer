/*
 * Generates the following:
 *  - data/array_types.js, which consists of:
 *    - StructArrayLayout_* subclasses, one for each underlying memory layout we need
 *    - Named exports mapping each conceptual array type (e.g., CircleLayoutArray) to its corresponding StructArrayLayout class
 *    - Particular, named StructArray subclasses, when fancy struct accessors are needed (e.g. CollisionBoxArray)
 */

const fs = require('node:fs');
const path = require('node:path');

const ejs = require('ejs');
const { createLayout, viewTypes } = require('../../src/util/struct_array');

const structArrayLayoutJs = ejs.compile(fs.readFileSync(resolve('../layout/struct_array_layout.js.ejs'), 'utf8'), {
  strict: true
});
const structArrayJs = ejs.compile(fs.readFileSync(resolve('../layout/struct_array.js.ejs'), 'utf8'), {
  strict: true
});

const typeAbbreviations = {
  Int8: 'b',
  Uint8: 'ub',
  Int16: 'i',
  Uint16: 'ui',
  Int32: 'l',
  Uint32: 'ul',
  Float32: 'f'
};

const arraysWithStructAccessors = [];
const arrayTypeEntries = new Set();
const extras = [];
const layoutCache = {};

function normalizeMembers(members, usedTypes) {
  return members.map(member => {
    if (usedTypes && !usedTypes.has(member.type)) {
      usedTypes.add(member.type);
    }

    return {
      ...member,
      size: sizeOf(member.type),
      view: member.type.toLowerCase()
    };
  });
}

// - If necessary, write the StructArrayLayout_* class for the given layout
// - If `includeStructAccessors`, write the fancy subclass
// - Add an entry for `name` in the array type registry
function createStructArrayType(name, layout, includeStructAccessors = false) {
  const hasAnchorPoint = layout.members.some(m => m.name === 'anchorPointX');

  // create the underlying StructArrayLayout class exists
  const layoutClass = createStructArrayLayoutType(layout);
  const arrayClass = `${camelize(name)}Array`;

  if (includeStructAccessors) {
    const usedTypes = new Set(['Uint8']);
    const members = normalizeMembers(layout.members, usedTypes);
    arraysWithStructAccessors.push({
      arrayClass,
      members,
      size: layout.size,
      usedTypes,
      hasAnchorPoint,
      layoutClass,
      includeStructAccessors
    });
  } else {
    arrayTypeEntries.add(`${arrayClass}: ${layoutClass}`);
  }
  return arrayClass;
}

function createStructArrayLayoutType({ members, size, alignment }) {
  const usedTypes = new Set(['Uint8']);
  members = normalizeMembers(members, usedTypes);

  // combine consecutive 'members' with same underlying type, summing their
  // component counts
  if (!alignment || alignment === 1)
    members = members.reduce((memo, member) => {
      if (memo.length > 0 && memo[memo.length - 1].type === member.type) {
        const last = memo[memo.length - 1];
        return memo.slice(0, -1).concat({ ...last, components: last.components + member.components });
      }
      return memo.concat(member);
    }, []);

  const key = `${members.map(m => `${m.components}${typeAbbreviations[m.type]}`).join('')}${size}`;
  const className = `StructArrayLayout${key}`;
  if (!layoutCache[key]) {
    layoutCache[key] = {
      className,
      members,
      size,
      usedTypes
    };
  }

  return className;
}

function sizeOf(type) {
  return viewTypes[type].BYTES_PER_ELEMENT;
}

function camelize(str) {
  return str.replace(/(?:^|[-_])(.)/g, (_, x) => {
    return /^[0-9]$/.test(x) ? _ : x.toUpperCase();
  });
}

global.camelize = camelize;

const posAttributes = require('../../src/data/pos_attributes');
const rasterBoundsAttributes = require('../../src/data/raster_bounds_attributes');

createStructArrayType('pos', posAttributes);
createStructArrayType('raster_bounds', rasterBoundsAttributes);

const circleAttributes = require('../../src/data/bucket/circle_attributes');
const fillAttributes = require('../../src/data/bucket/fill_attributes');
const fillExtrusionAttributes = require('../../src/data/bucket/fill_extrusion_attributes');
const lineAttributes = require('../../src/data/bucket/line_attributes');
const patternAttributes = require('../../src/data/bucket/pattern_attributes');

// layout vertex arrays
const layoutAttributes = {
  circle: circleAttributes,
  fill: fillAttributes,
  'fill-extrusion': fillExtrusionAttributes,
  heatmap: circleAttributes,
  line: lineAttributes,
  pattern: patternAttributes
};
for (const name in layoutAttributes) {
  createStructArrayType(`${name.replace(/-/g, '_')}_layout`, layoutAttributes[name]);
}

// symbol layer specific arrays
const {
  symbolLayoutAttributes,
  dynamicLayoutAttributes,
  placementOpacityAttributes,
  collisionBox,
  collisionBoxLayout,
  collisionCircleLayout,
  collisionVertexAttributes,
  placement,
  symbolInstance,
  glyphOffset,
  lineVertex
} = require('../../src/data/bucket/symbol_attributes');

createStructArrayType('symbol_layout', symbolLayoutAttributes);
createStructArrayType('symbol_dynamic_layout', dynamicLayoutAttributes);
createStructArrayType('symbol_opacity', placementOpacityAttributes);
extras.push(createStructArrayType('collision_box', collisionBox, true));
createStructArrayType('collision_box_layout', collisionBoxLayout);
createStructArrayType('collision_circle_layout', collisionCircleLayout);
createStructArrayType('collision_vertex', collisionVertexAttributes);
extras.push(createStructArrayType('placed_symbol', placement, true));
extras.push(createStructArrayType('symbol_instance', symbolInstance, true));
extras.push(createStructArrayType('glyph_offset', glyphOffset, true));
extras.push(createStructArrayType('symbol_line_vertex', lineVertex, true));

// feature index array
extras.push(
  createStructArrayType(
    'feature_index',
    createLayout([
      // the index of the feature in the original vectortile
      { type: 'Uint32', name: 'featureIndex' },
      // the source layer the feature appears in
      { type: 'Uint16', name: 'sourceLayerIndex' },
      // the bucket the feature appears in
      { type: 'Uint16', name: 'bucketIndex' }
    ]),
    true
  )
);

// triangle index array
createStructArrayType('triangle_index', createLayout([{ type: 'Uint16', name: 'vertices', components: 3 }]));

// line index array
createStructArrayType('line_index', createLayout([{ type: 'Uint16', name: 'vertices', components: 2 }]));

// line strip index array
createStructArrayType('line_strip_index', createLayout([{ type: 'Uint16', name: 'vertices', components: 1 }]));

// paint vertex arrays

// used by SourceBinder for float properties
createStructArrayLayoutType(
  createLayout(
    [
      {
        name: 'dummy name (unused for StructArrayLayout)',
        type: 'Float32',
        components: 1
      }
    ],
    4
  )
);

// used by SourceBinder for color properties and CompositeBinder for float properties
createStructArrayLayoutType(
  createLayout(
    [
      {
        name: 'dummy name (unused for StructArrayLayout)',
        type: 'Float32',
        components: 2
      }
    ],
    4
  )
);

// used by CompositeBinder for color properties
createStructArrayLayoutType(
  createLayout(
    [
      {
        name: 'dummy name (unused for StructArrayLayout)',
        type: 'Float32',
        components: 4
      }
    ],
    4
  )
);

const layouts = Object.keys(layoutCache).map(k => layoutCache[k]);

fs.writeFileSync(
  resolve('../../src/data/array_types.js'),
  `// This file is generated. Edit the template at meta/bin/generate-struct-arrays.js.ejs and instead.

const assert = require('assert');
const { Struct, StructArray } = require('../util/struct_array');
const { register } = require('../util/transfer_registry');
const { default: Point } = require('@mapbox/point-geometry');

${layouts.map(structArrayLayoutJs).join('\n')}
${arraysWithStructAccessors.map(structArrayJs).join('\n')}
module.exports = {
  ${layouts.map(layout => layout.className).join(',\n  ')},
  ${[...arrayTypeEntries].join(',\n  ')},

  ${extras.sort().join(',\n  ')}
};
`
);

function resolve(file) {
  return path.resolve(__dirname, file);
}
