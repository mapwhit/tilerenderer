const test = require('node:test');
const Coordinate = require('../../../src/geo/coordinate');

test('Coordinate', async t => {
  await t.test('#constructor', t => {
    const c = new Coordinate(1, 2, 3);
    t.assert.equal(c.column, 1);
    t.assert.equal(c.row, 2);
    t.assert.equal(c.zoom, 3);
  });

  await t.test('#zoomTo', t => {
    let c = new Coordinate(1, 2, 3);
    c = c.zoomTo(3);
    t.assert.equal(c.column, 1);
    t.assert.equal(c.row, 2);
    t.assert.equal(c.zoom, 3);
    c = c.zoomTo(2);
    t.assert.equal(c.column, 0.5);
    t.assert.equal(c.row, 1);
    t.assert.equal(c.zoom, 2);
    c = c.zoomTo(5);
    t.assert.equal(c.column, 4);
    t.assert.equal(c.row, 8);
    t.assert.equal(c.zoom, 5);
  });

  await t.test('#sub', t => {
    const o = new Coordinate(5, 4, 3);
    const c = new Coordinate(1, 2, 3);
    const r = o.sub(c);
    t.assert.equal(r.column, 4);
    t.assert.equal(r.row, 2);
    t.assert.equal(r.zoom, 3);
    const otherZoom = new Coordinate(4, 4, 4);
    const r2 = o.sub(otherZoom);
    t.assert.equal(r2.column, 3);
    t.assert.equal(r2.row, 2);
    t.assert.equal(r2.zoom, 3);
  });
});
