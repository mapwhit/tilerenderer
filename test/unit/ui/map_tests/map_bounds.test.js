const test = require('node:test');
const { createMap, initWindow } = require('../../../util/util');

test('map bounds', async t => {
  initWindow(t);

  await t.test('getBounds', async t => {
    const map = createMap({ zoom: 0 });
    t.assert.deepEqual(Number.parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
    t.assert.deepEqual(Number.parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

    t.assert.deepEqual(
      toFixed(map.getBounds().toArray()),
      toFixed([
        [-70.31249999999976, -57.326521225216965],
        [70.31249999999977, 57.32652122521695]
      ])
    );

    await t.test('rotated bounds', t => {
      const map = createMap({ zoom: 1, bearing: 45 });
      t.assert.deepEqual(
        toFixed([
          [-49.718445552178764, -44.44541580601936],
          [49.7184455522, 44.445415806019355]
        ]),
        toFixed(map.getBounds().toArray())
      );

      map.setBearing(135);
      t.assert.deepEqual(
        toFixed([
          [-49.718445552178764, -44.44541580601936],
          [49.7184455522, 44.445415806019355]
        ]),
        toFixed(map.getBounds().toArray())
      );
    });

    function toFixed(bounds) {
      const n = 10;
      return [
        [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
        [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
      ];
    }

    function normalizeFixed(num, n) {
      // workaround for "-0.0000000000" ≠ "0.0000000000"
      return Number.parseFloat(num.toFixed(n)).toFixed(n);
    }
  });

  await t.test('setMaxBounds', async t => {
    await t.test('constrains map bounds', t => {
      const map = createMap({ zoom: 0 });
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.deepEqual(
        toFixed([
          [-130.4297, 7.0136641176],
          [-61.52344, 60.2398142283]
        ]),
        toFixed(map.getBounds().toArray())
      );
    });

    await t.test('when no argument is passed, map bounds constraints are removed', t => {
      const map = createMap({ zoom: 0 });
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.deepEqual(
        toFixed([
          [-166.28906999999964, -27.6835270554],
          [-25.664070000000066, 73.8248206697]
        ]),
        toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray())
      );
    });

    await t.test('should not zoom out farther than bounds', t => {
      const map = createMap();
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.notEqual(map.setZoom(0).getZoom(), 0);
    });

    await t.test('throws on invalid bounds', t => {
      const map = createMap({ zoom: 0 });
      t.assert.throws(
        () => {
          map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
        },
        Error,
        'throws on two decoupled array coordinate arguments'
      );
      t.assert.throws(
        () => {
          map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
        },
        Error,
        'throws on individual coordinate arguments'
      );
    });

    function toFixed(bounds) {
      const n = 9;
      return [
        [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
        [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
      ];
    }
  });

  await t.test('getMaxBounds', async t => {
    await t.test('returns null when no bounds set', t => {
      const map = createMap({ zoom: 0 });
      t.assert.equal(map.getMaxBounds(), null);
    });

    await t.test('returns bounds', t => {
      const map = createMap({ zoom: 0 });
      const bounds = [
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ];
      map.setMaxBounds(bounds);
      t.assert.deepEqual(map.getMaxBounds().toArray(), bounds);
    });
  });
});
