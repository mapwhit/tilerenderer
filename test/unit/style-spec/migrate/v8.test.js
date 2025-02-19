const { test: t } = require('../../../util/mapbox-gl-js-test');
const migrate = require('../../../../src/style-spec/migrate/v8');

t('split text-font', async t => {
  const input = {
    version: 7,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': 'Helvetica, Arial',
          'text-field': '{foo}'
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': ['Helvetica', 'Arial'],
          'text-field': '{foo}'
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output, 'splits text-font');
});

t('rename symbol-min-distance', async t => {
  const input = {
    version: 7,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'symbol-min-distance': 2
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'symbol-spacing': 2
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output, 'renames symbol-min-distance');
});

t('renames urls', async t => {
  const input = {
    version: 7,
    sources: {
      vector: {
        type: 'video',
        url: ['foo'],
        coordinates: [
          [1, 0],
          [1, 0],
          [1, 0],
          [1, 0]
        ]
      }
    },
    layers: []
  };

  const output = {
    version: 8,
    sources: {
      vector: {
        type: 'video',
        urls: ['foo'],
        coordinates: [
          [0, 1],
          [0, 1],
          [0, 1],
          [0, 1]
        ]
      }
    },
    layers: []
  };

  t.deepEqual(migrate(input), output, 'renames url and flips coordinates of of video');
});

t('not migrate interpolated functions', async t => {
  const input = {
    version: 7,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'functions',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'line-width': {
            base: 2,
            stops: [
              [1, 2],
              [3, 6]
            ]
          }
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'functions',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'line-width': {
            base: 2,
            stops: [
              [1, 2],
              [3, 6]
            ]
          }
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output);
});

t('not migrate piecewise-constant functions', async t => {
  const input = {
    version: 7,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'functions',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-transform': {
            stops: [
              [1, 'uppercase'],
              [3, 'lowercase']
            ]
          }
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v5'
      }
    },
    layers: [
      {
        id: 'functions',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-transform': {
            stops: [
              [1, 'uppercase'],
              [3, 'lowercase']
            ]
          }
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output);
});

t('inline constants', async t => {
  const input = {
    version: 7,
    constants: {
      '@foo': 0.5
    },
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'fill',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'fill-opacity': '@foo'
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'fill',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'fill-opacity': 0.5
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output, 'infers opacity type');
});

t('migrate and inline fontstack constants', async t => {
  const input = {
    version: 7,
    constants: {
      '@foo': 'Arial Unicode,Foo Bar'
    },
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': '@foo'
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': ['Arial Unicode', 'Foo Bar']
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output, 'infers opacity type');
});

t('update fontstack function', async t => {
  const input = {
    version: 7,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': {
            base: 1,
            stops: [
              [0, 'Open Sans Regular, Arial Unicode MS Regular'],
              [6, 'Open Sans Semibold, Arial Unicode MS Regular']
            ]
          }
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': {
            base: 1,
            stops: [
              [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
              [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
            ]
          }
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output);
});

t('inline and migrate fontstack constant function', async t => {
  const input = {
    version: 7,
    constants: {
      '@function': {
        base: 1,
        stops: [
          [0, 'Open Sans Regular, Arial Unicode MS Regular'],
          [6, 'Open Sans Semibold, Arial Unicode MS Regular']
        ]
      }
    },
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': '@function'
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': {
            base: 1,
            stops: [
              [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
              [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
            ]
          }
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output);
});

t('update fontstack function constant', async t => {
  const input = {
    version: 7,
    constants: {
      '@font-stack-a': 'Open Sans Regular, Arial Unicode MS Regular',
      '@font-stack-b': 'Open Sans Semibold, Arial Unicode MS Regular'
    },
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': {
            base: 1,
            stops: [
              [0, '@font-stack-a'],
              [6, '@font-stack-b']
            ]
          }
        }
      }
    ]
  };

  const output = {
    version: 8,
    sources: {
      vector: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v5' }
    },
    layers: [
      {
        id: 'minimum',
        type: 'symbol',
        source: 'vector',
        'source-layer': 'layer',
        layout: {
          'text-font': {
            base: 1,
            stops: [
              [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
              [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
            ]
          }
        }
      }
    ]
  };

  t.deepEqual(migrate(input), output);
});

t('migrate UNversioned fontstack urls', async t => {
  const input = {
    version: 7,
    glyphs: 'mapbox://fontstack/{fontstack}/{range}.pbf',
    layers: []
  };

  const output = {
    version: 8,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    layers: []
  };

  t.deepEqual(migrate(input), output);
});

t('migrate versioned fontstack urls', async t => {
  const input = {
    version: 7,
    glyphs: 'mapbox://fonts/v1/boxmap/{fontstack}/{range}.pbf',
    layers: []
  };

  const output = {
    version: 8,
    glyphs: 'mapbox://fonts/boxmap/{fontstack}/{range}.pbf',
    layers: []
  };

  t.deepEqual(migrate(input), output);
});
