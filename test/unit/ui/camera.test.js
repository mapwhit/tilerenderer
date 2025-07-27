const { test } = require('../../util/mapbox-gl-js-test');
const Camera = require('../../../src/ui/camera');
const Transform = require('../../../src/geo/transform');
const taskQueue = require('../../../src/util/task_queue');
const browser = require('../../../src/util/browser');
const fixed = require('../../util/mapbox-gl-js-test/fixed');
const fixedLngLat = fixed.LngLat;
const fixedNum = fixed.Num;

test('camera', async t => {
  function attachSimulateFrame(camera) {
    const queue = taskQueue(camera);
    camera._requestRenderFrame = cb => queue.add(cb);
    camera._cancelRenderFrame = id => queue.remove(id);
    camera.simulateFrame = () => queue.run();
    return camera;
  }

  function createCamera(options = {}) {
    const transform = new Transform(0, 20, options.renderWorldCopies);
    transform.resize(512, 512);

    const camera = attachSimulateFrame(new Camera(transform, {})).jumpTo(options);

    camera._update = () => {};

    return camera;
  }

  await t.test('#jumpTo', async t => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const camera = createCamera({ zoom: 1 });

    await t.test('sets center', t => {
      camera.jumpTo({ center: [1, 2] });
      t.assert.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
    });

    await t.test('throws on invalid center argument', t => {
      t.assert.throws(
        () => {
          camera.jumpTo({ center: 1 });
        },
        Error,
        'throws with non-LngLatLike argument'
      );
    });

    await t.test('keeps current center if not specified', t => {
      camera.jumpTo({});
      t.assert.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
    });

    await t.test('sets zoom', t => {
      camera.jumpTo({ zoom: 3 });
      t.assert.deepEqual(camera.getZoom(), 3);
    });

    await t.test('keeps current zoom if not specified', t => {
      camera.jumpTo({});
      t.assert.deepEqual(camera.getZoom(), 3);
    });

    await t.test('sets bearing', t => {
      camera.jumpTo({ bearing: 4 });
      t.assert.deepEqual(camera.getBearing(), 4);
    });

    await t.test('keeps current bearing if not specified', t => {
      camera.jumpTo({});
      t.assert.deepEqual(camera.getBearing(), 4);
    });

    await t.test('sets pitch', t => {
      camera.jumpTo({ pitch: 45 });
      t.assert.deepEqual(camera.getPitch(), 45);
    });

    await t.test('keeps current pitch if not specified', t => {
      camera.jumpTo({});
      t.assert.deepEqual(camera.getPitch(), 45);
    });

    await t.test('sets multiple properties', t => {
      camera.jumpTo({
        center: [10, 20],
        zoom: 10,
        bearing: 180,
        pitch: 60
      });
      t.assert.deepEqual(camera.getCenter(), { lng: 10, lat: 20 });
      t.assert.deepEqual(camera.getZoom(), 10);
      t.assert.deepEqual(camera.getBearing(), 180);
      t.assert.deepEqual(camera.getPitch(), 60);
    });

    await t.test('emits move events, preserving eventData', t => {
      let started;
      let moved;
      let ended;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          started = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          ended = d.data;
        });

      camera.jumpTo({ center: [1, 2] }, eventData);
      t.assert.equal(started, 'ok');
      t.assert.equal(moved, 'ok');
      t.assert.equal(ended, 'ok');
    });

    await t.test('emits zoom events, preserving eventData', t => {
      let started;
      let zoomed;
      let ended;
      const eventData = { data: 'ok' };

      camera
        .on('zoomstart', d => {
          started = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          ended = d.data;
        });

      camera.jumpTo({ zoom: 3 }, eventData);
      t.assert.equal(started, 'ok');
      t.assert.equal(zoomed, 'ok');
      t.assert.equal(ended, 'ok');
    });

    await t.test('emits rotate events, preserving eventData', t => {
      let started;
      let rotated;
      let ended;
      const eventData = { data: 'ok' };

      camera
        .on('rotatestart', d => {
          started = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          ended = d.data;
        });

      camera.jumpTo({ bearing: 90 }, eventData);
      t.assert.equal(started, 'ok');
      t.assert.equal(rotated, 'ok');
      t.assert.equal(ended, 'ok');
    });

    await t.test('emits pitch events, preserving eventData', t => {
      let started;
      let pitched;
      let ended;
      const eventData = { data: 'ok' };

      camera
        .on('pitchstart', d => {
          started = d.data;
        })
        .on('pitch', d => {
          pitched = d.data;
        })
        .on('pitchend', d => {
          ended = d.data;
        });

      camera.jumpTo({ pitch: 10 }, eventData);
      t.assert.equal(started, 'ok');
      t.assert.equal(pitched, 'ok');
      t.assert.equal(ended, 'ok');
    });

    await t.test('cancels in-progress easing', t => {
      camera.panTo([3, 4]);
      t.assert.ok(camera.isEasing());
      camera.jumpTo({ center: [1, 2] });
      t.assert.ok(!camera.isEasing());
    });
  });

  await t.test('#setCenter', async t => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const camera = createCamera({ zoom: 1 });

    await t.test('sets center', t => {
      camera.setCenter([1, 2]);
      t.assert.deepEqual(camera.getCenter(), { lng: 1, lat: 2 });
    });

    await t.test('throws on invalid center argument', t => {
      t.assert.throws(
        () => {
          camera.jumpTo({ center: 1 });
        },
        Error,
        'throws with non-LngLatLike argument'
      );
    });

    await t.test('emits move events, preserving eventData', t => {
      let started;
      let moved;
      let ended;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          started = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          ended = d.data;
        });

      camera.setCenter([10, 20], eventData);
      t.assert.equal(started, 'ok');
      t.assert.equal(moved, 'ok');
      t.assert.equal(ended, 'ok');
    });

    await t.test('cancels in-progress easing', t => {
      camera.panTo([3, 4]);
      t.assert.ok(camera.isEasing());
      camera.setCenter([1, 2]);
      t.assert.ok(!camera.isEasing());
    });
  });

  await t.test('#setZoom', async t => {
    const camera = createCamera();

    await t.test('sets zoom', t => {
      camera.setZoom(3);
      t.assert.deepEqual(camera.getZoom(), 3);
    });

    await t.test('emits move and zoom events, preserving eventData', t => {
      let movestarted;
      let moved;
      let moveended;
      let zoomstarted;
      let zoomed;
      let zoomended;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          moveended = d.data;
        })
        .on('zoomstart', d => {
          zoomstarted = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          zoomended = d.data;
        });

      camera.setZoom(4, eventData);
      t.assert.equal(movestarted, 'ok');
      t.assert.equal(moved, 'ok');
      t.assert.equal(moveended, 'ok');
      t.assert.equal(zoomstarted, 'ok');
      t.assert.equal(zoomed, 'ok');
      t.assert.equal(zoomended, 'ok');
    });

    await t.test('cancels in-progress easing', t => {
      camera.panTo([3, 4]);
      t.assert.ok(camera.isEasing());
      camera.setZoom(5);
      t.assert.ok(!camera.isEasing());
    });
  });

  await t.test('#setBearing', async t => {
    const camera = createCamera();

    await t.test('sets bearing', t => {
      camera.setBearing(4);
      t.assert.deepEqual(camera.getBearing(), 4);
    });

    await t.test('emits move and rotate events, preserving eventData', t => {
      let movestarted;
      let moved;
      let moveended;
      let rotatestarted;
      let rotated;
      let rotateended;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          moveended = d.data;
        })
        .on('rotatestart', d => {
          rotatestarted = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          rotateended = d.data;
        });

      camera.setBearing(5, eventData);
      t.assert.equal(movestarted, 'ok');
      t.assert.equal(moved, 'ok');
      t.assert.equal(moveended, 'ok');
      t.assert.equal(rotatestarted, 'ok');
      t.assert.equal(rotated, 'ok');
      t.assert.equal(rotateended, 'ok');
    });

    await t.test('cancels in-progress easing', t => {
      camera.panTo([3, 4]);
      t.assert.ok(camera.isEasing());
      camera.setBearing(6);
      t.assert.ok(!camera.isEasing());
    });
  });

  await t.test('#panBy', async t => {
    await t.test('pans by specified amount', t => {
      const camera = createCamera();
      camera.panBy([100, 0], { duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 70.3125, lat: 0 });
    });

    await t.test('pans relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.panBy([100, 0], { duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: -70.3125, lat: 0 });
    });

    await t.test('emits move events, preserving eventData', (t, done) => {
      const camera = createCamera();
      let started;
      let moved;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          started = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          t.assert.equal(started, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(d.data, 'ok');
          done();
        });

      camera.panBy([100, 0], { duration: 0 }, eventData);
    });
    await t.test('supresses movestart if noMoveStart option is true', (t, done) => {
      const camera = createCamera();
      let started;

      camera
        .on('movestart', () => {
          started = true;
        })
        .on('moveend', () => {
          t.assert.ok(!started);
          done();
        });

      camera.panBy([100, 0], { duration: 0, noMoveStart: true });
    });
  });

  await t.test('#panTo', async t => {
    await t.test('pans to specified location', t => {
      const camera = createCamera();
      camera.panTo([100, 0], { duration: 0 });
      t.assert.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
    });

    await t.test('throws on invalid center argument', t => {
      const camera = createCamera();
      t.assert.throws(
        () => {
          camera.panTo({ center: 1 });
        },
        Error,
        'throws with non-LngLatLike argument'
      );
    });

    await t.test('pans with specified offset', t => {
      const camera = createCamera();
      camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
    });

    await t.test('pans with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.panTo([100, 0], { offset: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
    });

    await t.test('emits move events, preserving eventData', (t, done) => {
      const camera = createCamera();
      let started;
      let moved;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          started = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          t.assert.equal(started, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(d.data, 'ok');
          done();
        });

      camera.panTo([100, 0], { duration: 0 }, eventData);
    });

    await t.test('supresses movestart if noMoveStart option is true', (t, done) => {
      const camera = createCamera();
      let started;

      camera
        .on('movestart', () => {
          started = true;
        })
        .on('moveend', () => {
          t.assert.ok(!started);
          done();
        });

      camera.panTo([100, 0], { duration: 0, noMoveStart: true });
    });
  });

  await t.test('#zoomTo', async t => {
    await t.test('zooms to specified level', t => {
      const camera = createCamera();
      camera.zoomTo(3.2, { duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
    });

    await t.test('zooms around specified location', t => {
      const camera = createCamera();
      camera.zoomTo(3.2, { around: [5, 0], duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 4.455905897939886, lat: 0 }));
    });

    await t.test('zooms with specified offset', t => {
      const camera = createCamera();
      camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
    });

    await t.test('zooms with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.zoomTo(3.2, { offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
    });

    await t.test('emits move and zoom events, preserving eventData', { plan: 6 }, (t, done) => {
      const camera = createCamera();
      let movestarted;
      let moved;
      let zoomstarted;
      let zoomed;
      const eventData = { data: 'ok' };

      const result = {};
      function isItDone(prop) {
        result[prop] = true;
        if (result.move && result.zoom) {
          done();
        }
      }

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          t.assert.equal(movestarted, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('move');
        });

      camera
        .on('zoomstart', d => {
          zoomstarted = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          t.assert.equal(zoomstarted, 'ok');
          t.assert.equal(zoomed, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('zoom');
        });

      camera.zoomTo(5, { duration: 0 }, eventData);
    });
  });

  await t.test('#rotateTo', async t => {
    await t.test('rotates to specified bearing', t => {
      const camera = createCamera();
      camera.rotateTo(90, { duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('rotates around specified location', t => {
      const camera = createCamera({ zoom: 3 });
      camera.rotateTo(90, { around: [5, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(
        fixedLngLat(camera.getCenter()),
        fixedLngLat({ lng: 4.999999999999972, lat: 4.993665859353271 })
      );
    });

    await t.test('rotates around specified location, constrained to fit the view', t => {
      const camera = createCamera({ zoom: 0 });
      camera.rotateTo(90, { around: [5, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(
        fixedLngLat(camera.getCenter()),
        fixedLngLat({ lng: 4.999999999999972, lat: 0.000002552471840999715 })
      );
    });

    await t.test('rotates with specified offset', t => {
      const camera = createCamera({ zoom: 1 });
      camera.rotateTo(90, { offset: [200, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 57.3265212252 }));
    });

    await t.test('rotates with specified offset, constrained to fit the view', t => {
      const camera = createCamera({ zoom: 0 });
      camera.rotateTo(90, { offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.000002552471840999715 }));
    });

    await t.test('rotates with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180, zoom: 1 });
      camera.rotateTo(90, { offset: [200, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 57.3265212252 }));
    });

    await t.test('emits move and rotate events, preserving eventData', { plan: 6 }, (t, done) => {
      const camera = createCamera();
      let movestarted;
      let moved;
      let rotatestarted;
      let rotated;
      const eventData = { data: 'ok' };

      const result = {};
      function isItDone(prop) {
        result[prop] = true;
        if (result.move && result.rotate) {
          done();
        }
      }

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          t.assert.equal(movestarted, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('move');
        });

      camera
        .on('rotatestart', d => {
          rotatestarted = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          t.assert.equal(rotatestarted, 'ok');
          t.assert.equal(rotated, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('rotate');
        });

      camera.rotateTo(90, { duration: 0 }, eventData);
    });
  });

  await t.test('#easeTo', async t => {
    await t.test('pans to specified location', t => {
      const camera = createCamera();
      camera.easeTo({ center: [100, 0], duration: 0 });
      t.assert.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
    });

    await t.test('zooms to specified level', t => {
      const camera = createCamera();
      camera.easeTo({ zoom: 3.2, duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
    });

    await t.test('rotates to specified bearing', t => {
      const camera = createCamera();
      camera.easeTo({ bearing: 90, duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('pitches to specified pitch', t => {
      const camera = createCamera();
      camera.easeTo({ pitch: 45, duration: 0 });
      t.assert.equal(camera.getPitch(), 45);
    });

    await t.test('pans and zooms', t => {
      const camera = createCamera();
      camera.easeTo({ center: [100, 0], zoom: 3.2, duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
      t.assert.equal(camera.getZoom(), 3.2);
    });

    await t.test('zooms around a point', t => {
      const camera = createCamera();
      camera.easeTo({ around: [100, 0], zoom: 3, duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 87.5, lat: 0 }));
      t.assert.equal(camera.getZoom(), 3);
    });

    await t.test('pans and rotates', t => {
      const camera = createCamera();
      camera.easeTo({ center: [100, 0], bearing: 90, duration: 0 });
      t.assert.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('zooms and rotates', t => {
      const camera = createCamera();
      camera.easeTo({ zoom: 3.2, bearing: 90, duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('pans, zooms, and rotates', t => {
      const camera = createCamera({ bearing: -90 });
      camera.easeTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 100, lat: 0 }));
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('noop', t => {
      const camera = createCamera();
      camera.easeTo({ duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
      t.assert.equal(camera.getZoom(), 0);
      t.assert.equal(camera.getBearing(), 0);
    });

    await t.test('noop with offset', t => {
      const camera = createCamera();
      camera.easeTo({ offset: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
      t.assert.equal(camera.getZoom(), 0);
      t.assert.equal(camera.getBearing(), 0);
    });

    await t.test('pans with specified offset', t => {
      const camera = createCamera();
      camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
    });

    await t.test('pans with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.easeTo({ center: [100, 0], offset: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
    });

    await t.test('zooms with specified offset', t => {
      const camera = createCamera();
      camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 62.66117668978015, lat: 0 }));
    });

    await t.test('zooms with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.easeTo({ zoom: 3.2, offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getZoom(), 3.2);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -62.66117668978012, lat: 0 }));
    });

    await t.test('rotates with specified offset', t => {
      const camera = createCamera();
      camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: 70.3125, lat: 0.000002552471840999715 }));
    });

    await t.test('rotates with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.easeTo({ bearing: 90, offset: [100, 0], duration: 0 });
      t.assert.equal(camera.getBearing(), 90);
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({ lng: -70.3125, lat: 0.000002552471840999715 }));
    });

    await t.test('emits move, zoom, rotate, and pitch events, preserving eventData', { plan: 18 }, (t, done) => {
      const camera = createCamera();
      let movestarted;
      let moved;
      let zoomstarted;
      let zoomed;
      let rotatestarted;
      let rotated;
      let pitchstarted;
      let pitched;
      const eventData = { data: 'ok' };

      const result = {};
      function isItDone(prop) {
        result[prop] = true;
        if (result.move && result.zoom && result.rotate && result.pitch) {
          done();
        }
      }

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('moveend', d => {
          t.assert.notOk(camera._zooming);
          t.assert.notOk(camera._panning);
          t.assert.notOk(camera._rotating);

          t.assert.equal(movestarted, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(zoomed, 'ok');
          t.assert.equal(rotated, 'ok');
          t.assert.equal(pitched, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('move');
        });

      camera
        .on('zoomstart', d => {
          zoomstarted = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          t.assert.equal(zoomstarted, 'ok');
          t.assert.equal(zoomed, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('zoom');
        });

      camera
        .on('rotatestart', d => {
          rotatestarted = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          t.assert.equal(rotatestarted, 'ok');
          t.assert.equal(rotated, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('rotate');
        });

      camera
        .on('pitchstart', d => {
          pitchstarted = d.data;
        })
        .on('pitch', d => {
          pitched = d.data;
        })
        .on('pitchend', d => {
          t.assert.equal(pitchstarted, 'ok');
          t.assert.equal(pitched, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('pitch');
        });

      camera.easeTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45 }, eventData);
    });

    await t.test('does not emit zoom events if not zooming', (t, done) => {
      const camera = createCamera();

      camera
        .on('zoomstart', () => {
          t.assert.fail();
        })
        .on('zoom', () => {
          t.assert.fail();
        })
        .on('zoomend', () => {
          t.assert.fail();
        })
        .on('moveend', () => {
          done();
        });

      camera.easeTo({ center: [100, 0], duration: 0 });
    });

    await t.test('stops existing ease', t => {
      const camera = createCamera();
      camera.easeTo({ center: [200, 0], duration: 100 });
      camera.easeTo({ center: [100, 0], duration: 0 });
      t.assert.deepEqual(camera.getCenter(), { lng: 100, lat: 0 });
    });

    await t.test('can be called from within a moveend event handler', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.easeTo({ center: [100, 0], duration: 10 });

      camera.once('moveend', () => {
        camera.easeTo({ center: [200, 0], duration: 10 });
        camera.once('moveend', () => {
          camera.easeTo({ center: [300, 0], duration: 10 });
          camera.once('moveend', () => {
            done();
          });

          setTimeout(() => {
            tick = 30;
            camera.simulateFrame();
          }, 0);
        });

        // setTimeout to avoid a synchronous callback
        setTimeout(() => {
          tick = 20;
          camera.simulateFrame();
        }, 0);
      });

      // setTimeout to avoid a synchronous callback
      setTimeout(() => {
        tick = 10;
        camera.simulateFrame();
      }, 0);
    });

    await t.test('pans eastward across the antimeridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (camera.getCenter().lng > 170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedAntimeridian);
        done();
      });

      camera.easeTo({ center: [-170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('pans westward across the antimeridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([-170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (camera.getCenter().lng < -170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedAntimeridian);
        done();
      });

      camera.easeTo({ center: [170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });
  });

  await t.test('#flyTo', async t => {
    await t.test('pans to specified location', t => {
      const camera = createCamera();
      camera.flyTo({ center: [100, 0], animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
    });

    await t.test('throws on invalid center argument', t => {
      const camera = createCamera();
      t.assert.throws(
        () => {
          camera.flyTo({ center: 1 });
        },
        Error,
        'throws with non-LngLatLike argument'
      );
    });

    await t.test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', t => {
      const camera = createCamera({ zoom: 22, center: [0, 0] });
      t.assert.doesNotThrow(() => camera.flyTo({ zoom: 10, center: [0, 0] }));
    });

    await t.test(
      'does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor',
      (t, done) => {
        const transform = new Transform(0, 20.9999, true);
        transform.resize(512, 512);
        const camera = attachSimulateFrame(new Camera(transform, {})).jumpTo({ zoom: 21, center: [0, 0] });
        camera._update = () => {};
        t.assert.doesNotThrow(() => camera.flyTo({ zoom: 7.5, center: [0, 0], offset: [0, 70] }));
        done();
      }
    );

    await t.test('zooms to specified level', t => {
      const camera = createCamera();
      camera.flyTo({ zoom: 3.2, animate: false });
      t.assert.equal(fixedNum(camera.getZoom()), 3.2);
    });

    await t.test('zooms to integer level without floating point errors', t => {
      const camera = createCamera({ zoom: 0.6 });
      camera.flyTo({ zoom: 2, animate: false });
      t.assert.equal(camera.getZoom(), 2);
    });

    await t.test('Zoom out from the same position to the same position with animation', (t, done) => {
      const pos = { lng: 0, lat: 0 };
      const camera = createCamera({ zoom: 20, center: pos });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.once('zoomend', () => {
        t.assert.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat(pos));
        t.assert.equal(camera.getZoom(), 19);
        done();
      });

      camera.flyTo({ zoom: 19, center: pos, duration: 2 });

      tick = 3;
      camera.simulateFrame();
    });

    await t.test('rotates to specified bearing', t => {
      const camera = createCamera();
      camera.flyTo({ bearing: 90, animate: false });
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('tilts to specified pitch', t => {
      const camera = createCamera();
      camera.flyTo({ pitch: 45, animate: false });
      t.assert.equal(camera.getPitch(), 45);
    });

    await t.test('pans and zooms', t => {
      const camera = createCamera();
      camera.flyTo({ center: [100, 0], zoom: 3.2, animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
      t.assert.equal(fixedNum(camera.getZoom()), 3.2);
    });

    await t.test('pans and rotates', t => {
      const camera = createCamera();
      camera.flyTo({ center: [100, 0], bearing: 90, animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('zooms and rotates', t => {
      const camera = createCamera();
      camera.flyTo({ zoom: 3.2, bearing: 90, animate: false });
      t.assert.equal(fixedNum(camera.getZoom()), 3.2);
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('pans, zooms, and rotates', t => {
      const camera = createCamera();
      camera.flyTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
      t.assert.equal(fixedNum(camera.getZoom()), 3.2);
      t.assert.equal(camera.getBearing(), 90);
    });

    await t.test('noop', t => {
      const camera = createCamera();
      camera.flyTo({ animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
      t.assert.equal(camera.getZoom(), 0);
      t.assert.equal(camera.getBearing(), 0);
    });

    await t.test('noop with offset', t => {
      const camera = createCamera();
      camera.flyTo({ offset: [100, 0], animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 0, lat: 0 });
      t.assert.equal(camera.getZoom(), 0);
      t.assert.equal(camera.getBearing(), 0);
    });

    await t.test('pans with specified offset', t => {
      const camera = createCamera();
      camera.flyTo({ center: [100, 0], offset: [100, 0], animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 29.6875, lat: 0 });
    });

    await t.test('pans with specified offset relative to viewport on a rotated camera', t => {
      const camera = createCamera({ bearing: 180 });
      camera.easeTo({ center: [100, 0], offset: [100, 0], animate: false });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 170.3125, lat: 0 });
    });

    await t.test('emits move, zoom, rotate, and pitch events, preserving eventData', { plan: 18 }, (t, done) => {
      const camera = createCamera();
      let movestarted;
      let moved;
      let zoomstarted;
      let zoomed;
      let rotatestarted;
      let rotated;
      let pitchstarted;
      let pitched;
      const eventData = { data: 'ok' };

      const result = {};
      function isItDone(prop) {
        result[prop] = true;
        if (result.move && result.zoom && result.rotate && result.pitch) {
          done();
        }
      }

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('pitch', d => {
          pitched = d.data;
        })
        .on('moveend', function (d) {
          t.assert.notOk(this._zooming);
          t.assert.notOk(this._panning);
          t.assert.notOk(this._rotating);

          t.assert.equal(movestarted, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(zoomed, 'ok');
          t.assert.equal(rotated, 'ok');
          t.assert.equal(pitched, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('move');
        });

      camera
        .on('zoomstart', d => {
          zoomstarted = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          t.assert.equal(zoomstarted, 'ok');
          t.assert.equal(zoomed, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('zoom');
        });

      camera
        .on('rotatestart', d => {
          rotatestarted = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          t.assert.equal(rotatestarted, 'ok');
          t.assert.equal(rotated, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('rotate');
        });

      camera
        .on('pitchstart', d => {
          pitchstarted = d.data;
        })
        .on('pitch', d => {
          pitched = d.data;
        })
        .on('pitchend', d => {
          t.assert.equal(pitchstarted, 'ok');
          t.assert.equal(pitched, 'ok');
          t.assert.equal(d.data, 'ok');
          isItDone('pitch');
        });

      camera.flyTo({ center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false }, eventData);
    });

    await t.test('for short flights, emits (solely) move events, preserving eventData', (t, done) => {
      //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
      //As such; it deserves a separate test case. This test case flies the map from A to A.
      const camera = createCamera({ center: [100, 0] });
      let movestarted;
      let moved;
      let zoomstarted;
      let zoomed;
      let zoomended;
      let rotatestarted;
      let rotated;
      let rotateended;
      let pitchstarted;
      let pitched;
      let pitchended;
      const eventData = { data: 'ok' };

      camera
        .on('movestart', d => {
          movestarted = d.data;
        })
        .on('move', d => {
          moved = d.data;
        })
        .on('zoomstart', d => {
          zoomstarted = d.data;
        })
        .on('zoom', d => {
          zoomed = d.data;
        })
        .on('zoomend', d => {
          zoomended = d.data;
        })
        .on('rotatestart', d => {
          rotatestarted = d.data;
        })
        .on('rotate', d => {
          rotated = d.data;
        })
        .on('rotateend', d => {
          rotateended = d.data;
        })
        .on('pitchstart', d => {
          pitchstarted = d.data;
        })
        .on('pitch', d => {
          pitched = d.data;
        })
        .on('pitchend', d => {
          pitchended = d.data;
        })
        .on('moveend', function (d) {
          t.assert.notOk(this._zooming);
          t.assert.notOk(this._panning);
          t.assert.notOk(this._rotating);

          t.assert.equal(movestarted, 'ok');
          t.assert.equal(moved, 'ok');
          t.assert.equal(zoomstarted, undefined);
          t.assert.equal(zoomed, undefined);
          t.assert.equal(zoomended, undefined);
          t.assert.equal(rotatestarted, undefined);
          t.assert.equal(rotated, undefined);
          t.assert.equal(rotateended, undefined);
          t.assert.equal(pitched, undefined);
          t.assert.equal(pitchstarted, undefined);
          t.assert.equal(pitchended, undefined);
          t.assert.equal(d.data, 'ok');
          done();
        });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.flyTo({ center: [100, 0], duration: 10 }, eventData);

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('stops existing ease', t => {
      const camera = createCamera();
      camera.flyTo({ center: [200, 0], duration: 100 });
      camera.flyTo({ center: [100, 0], duration: 0 });
      t.assert.deepEqual(fixedLngLat(camera.getCenter()), { lng: 100, lat: 0 });
    });

    await t.test('can be called from within a moveend event handler', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.flyTo({ center: [100, 0], duration: 10 });
      camera.once('moveend', () => {
        camera.flyTo({ center: [200, 0], duration: 10 });
        camera.once('moveend', () => {
          camera.flyTo({ center: [300, 0], duration: 10 });
          camera.once('moveend', () => {
            done();
          });
        });
      });

      setTimeout(() => {
        tick = 10;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 20;
          camera.simulateFrame();

          setTimeout(() => {
            tick = 30;
            camera.simulateFrame();
          }, 0);
        }, 0);
      }, 0);
    });

    await t.test('ascends', (t, done) => {
      const camera = createCamera();
      camera.setZoom(18);
      let ascended;

      camera.on('zoom', () => {
        if (camera.getZoom() < 18) {
          ascended = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(ascended);
        done();
      });

      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.flyTo({ center: [100, 0], zoom: 18, duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('pans eastward across the prime meridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([-10, 0]);
      let crossedPrimeMeridian;

      camera.on('move', () => {
        if (Math.abs(camera.getCenter().lng) < 10) {
          crossedPrimeMeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedPrimeMeridian);
        done();
      });

      camera.flyTo({ center: [10, 0], duration: 20 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 20;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('pans westward across the prime meridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([10, 0]);
      let crossedPrimeMeridian;

      camera.on('move', () => {
        if (Math.abs(camera.getCenter().lng) < 10) {
          crossedPrimeMeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedPrimeMeridian);
        done();
      });

      camera.flyTo({ center: [-10, 0], duration: 20 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 20;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('pans eastward across the antimeridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (camera.getCenter().lng > 170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedAntimeridian);
        done();
      });

      camera.flyTo({ center: [-170, 0], duration: 20 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 20;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('pans westward across the antimeridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([-170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (camera.getCenter().lng < -170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(crossedAntimeridian);
        done();
      });

      camera.flyTo({ center: [170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('does not pan eastward across the antimeridian if no world copies', (t, done) => {
      const camera = createCamera({ renderWorldCopies: false });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (camera.getCenter().lng > 170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.notOk(crossedAntimeridian);
        done();
      });

      camera.flyTo({ center: [-170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('does not pan westward across the antimeridian if no world copies', (t, done) => {
      const camera = createCamera({ renderWorldCopies: false });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([-170, 0]);
      let crossedAntimeridian;

      camera.on('move', () => {
        if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
          crossedAntimeridian = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.notOk(crossedAntimeridian);
        done();
      });

      camera.flyTo({ center: [170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('jumps back to world 0 when crossing the antimeridian', (t, done) => {
      const camera = createCamera();
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      camera.setCenter([-170, 0]);

      let leftWorld0 = false;

      camera.on('move', () => {
        leftWorld0 = leftWorld0 || camera.getCenter().lng < -180;
      });

      camera.on('moveend', () => {
        t.assert.notOk(leftWorld0);
        done();
      });

      camera.flyTo({ center: [170, 0], duration: 10 });

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test('peaks at the specified zoom level', (t, done) => {
      const camera = createCamera({ zoom: 20 });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);

      const minZoom = 1;
      let zoomed = false;

      camera.on('zoom', () => {
        const zoom = camera.getZoom();
        if (zoom < 1) {
          t.assert.fail(`${zoom} should be >= ${minZoom} during flyTo`);
        }

        if (camera.getZoom() < minZoom + 1) {
          zoomed = true;
        }
      });

      camera.on('moveend', () => {
        t.assert.ok(zoomed, 'zoom came within satisfactory range of minZoom provided');
        done();
      });

      camera.flyTo({ center: [1, 0], zoom: 20, minZoom, duration: 10 });

      setTimeout(() => {
        tick = 3;
        camera.simulateFrame();

        setTimeout(() => {
          tick = 10;
          camera.simulateFrame();
        }, 0);
      }, 0);
    });

    await t.test("respects transform's maxZoom", (t, done) => {
      const transform = new Transform(2, 10, false);
      transform.resize(512, 512);

      const camera = attachSimulateFrame(new Camera(transform, {}));
      camera._update = () => {};

      camera.on('moveend', () => {
        t.assert.equalWithPrecision(camera.getZoom(), 10, 1e-10);
        const { lng, lat } = camera.getCenter();
        t.assert.equalWithPrecision(lng, 12, 1e-10);
        t.assert.equalWithPrecision(lat, 34, 1e-10);

        done();
      });

      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.flyTo({ center: [12, 34], zoom: 30, duration: 10 });

      setTimeout(() => {
        tick = 10;
        camera.simulateFrame();
      }, 0);
    });

    await t.test("respects transform's minZoom", (t, done) => {
      const transform = new Transform(2, 10, false);
      transform.resize(512, 512);

      const camera = attachSimulateFrame(new Camera(transform, {}));
      camera._update = () => {};

      camera.on('moveend', () => {
        t.assert.equalWithPrecision(camera.getZoom(), 2, 1e-10);
        const { lng, lat } = camera.getCenter();
        t.assert.equalWithPrecision(lng, 12, 1e-10);
        t.assert.equalWithPrecision(lat, 34, 1e-10);

        done();
      });

      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.flyTo({ center: [12, 34], zoom: 1, duration: 10 });

      setTimeout(() => {
        tick = 10;
        camera.simulateFrame();
      }, 0);
    });

    await t.test('resets duration to 0 if it exceeds maxDuration', (t, done) => {
      let startTime;
      let endTime;
      let timeDiff;
      const camera = createCamera({ center: [37.63454, 55.75868], zoom: 18 });

      camera
        .on('movestart', () => {
          startTime = new Date();
        })
        .on('moveend', () => {
          endTime = new Date();
          timeDiff = endTime - startTime;
          t.assert.equalWithPrecision(timeDiff, 0, 1e1);
          done();
        });

      camera.flyTo({ center: [-122.3998631, 37.7884307], maxDuration: 100 });
    });
  });

  await t.test('#isEasing', async t => {
    await t.test('returns false when not easing', t => {
      const camera = createCamera();
      t.assert.ok(!camera.isEasing());
    });

    await t.test('returns true when panning', t => {
      const camera = createCamera();
      camera.panTo([100, 0], { duration: 1 });
      t.assert.ok(camera.isEasing());
    });

    await t.test('returns false when done panning', (t, done) => {
      const camera = createCamera();
      camera.on('moveend', () => {
        t.assert.ok(!camera.isEasing());
        done();
      });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.panTo([100, 0], { duration: 1 });
      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();
      }, 0);
    });

    await t.test('returns true when zooming', t => {
      const camera = createCamera();
      camera.zoomTo(3.2, { duration: 1 });
      t.assert.ok(camera.isEasing());
    });

    await t.test('returns false when done zooming', (t, done) => {
      const camera = createCamera();
      camera.on('moveend', () => {
        t.assert.ok(!camera.isEasing());
        done();
      });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.zoomTo(3.2, { duration: 1 });
      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();
      }, 0);
    });

    await t.test('returns true when rotating', t => {
      const camera = createCamera();
      camera.rotateTo(90, { duration: 1 });
      t.assert.ok(camera.isEasing());
    });

    await t.test('returns false when done rotating', (t, done) => {
      const camera = createCamera();
      camera.on('moveend', () => {
        t.assert.ok(!camera.isEasing());
        done();
      });
      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.rotateTo(90, { duration: 1 });
      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();
      }, 0);
    });
  });

  await t.test('#stop', async t => {
    await t.test('resets camera._zooming', t => {
      const camera = createCamera();
      camera.zoomTo(3.2);
      camera.stop();
      t.assert.ok(!camera._zooming);
    });

    await t.test('resets camera._rotating', t => {
      const camera = createCamera();
      camera.rotateTo(90);
      camera.stop();
      t.assert.ok(!camera._rotating);
    });

    await t.test('emits moveend if panning, preserving eventData', (t, done) => {
      const camera = createCamera();
      const eventData = { data: 'ok' };

      camera.on('moveend', d => {
        t.assert.equal(d.data, 'ok');
        done();
      });

      camera.panTo([100, 0], {}, eventData);
      camera.stop();
    });

    await t.test('emits moveend if zooming, preserving eventData', (t, done) => {
      const camera = createCamera();
      const eventData = { data: 'ok' };

      camera.on('moveend', d => {
        t.assert.equal(d.data, 'ok');
        done();
      });

      camera.zoomTo(3.2, {}, eventData);
      camera.stop();
    });

    await t.test('emits moveend if rotating, preserving eventData', (t, done) => {
      const camera = createCamera();
      const eventData = { data: 'ok' };

      camera.on('moveend', d => {
        t.assert.equal(d.data, 'ok');
        done();
      });

      camera.rotateTo(90, {}, eventData);
      camera.stop();
    });

    await t.test('does not emit moveend if not moving', (t, done) => {
      const camera = createCamera();
      const eventData = { data: 'ok' };

      camera.on('moveend', d => {
        t.assert.equal(d.data, 'ok');
        camera.stop();
        done(); // Fails with "done() called twice" if we get here a second time.
      });

      let tick = 0;
      const stub = t.mock.method(browser, 'now', () => tick);
      camera.panTo([100, 0], { duration: 1 }, eventData);

      setTimeout(() => {
        tick = 1;
        camera.simulateFrame();
      }, 0);
    });
  });

  await t.test('#cameraForBounds', async t => {
    await t.test('no padding passed', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      const transform = camera.cameraForBounds(bb);
      t.assert.deepEqual(
        fixedLngLat(transform.center, 4),
        { lng: -100.5, lat: 34.7171 },
        'correctly calculates coordinates for new bounds'
      );
      t.assert.equal(fixedNum(transform.zoom, 3), 2.469);
    });

    await t.test('padding number', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      const transform = camera.cameraForBounds(bb, { padding: 15 });
      t.assert.deepEqual(
        fixedLngLat(transform.center, 4),
        { lng: -100.5, lat: 34.7171 },
        'correctly calculates coordinates for bounds with padding option as number applied'
      );
      t.assert.equal(fixedNum(transform.zoom, 3), 2.382);
    });

    await t.test('padding object', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      const transform = camera.cameraForBounds(bb, {
        padding: { top: 10, right: 75, bottom: 50, left: 25 },
        duration: 0
      });
      t.assert.deepEqual(
        fixedLngLat(transform.center, 4),
        { lng: -100.5, lat: 34.7171 },
        'correctly calculates coordinates for bounds with padding option as object applied'
      );
    });
  });

  await t.test('#fitBounds', async t => {
    await t.test('no padding passed', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      camera.fitBounds(bb, { duration: 0 });
      t.assert.deepEqual(
        fixedLngLat(camera.getCenter(), 4),
        { lng: -100.5, lat: 34.7171 },
        'pans to coordinates based on fitBounds'
      );
      t.assert.equal(fixedNum(camera.getZoom(), 3), 2.469);
    });

    await t.test('padding number', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      camera.fitBounds(bb, { padding: 15, duration: 0 });
      t.assert.deepEqual(
        fixedLngLat(camera.getCenter(), 4),
        { lng: -100.5, lat: 34.7171 },
        'pans to coordinates based on fitBounds with padding option as number applied'
      );
      t.assert.equal(fixedNum(camera.getZoom(), 3), 2.382);
    });

    await t.test('padding object', t => {
      const camera = createCamera();
      const bb = [
        [-133, 16],
        [-68, 50]
      ];

      camera.fitBounds(bb, { padding: { top: 10, right: 75, bottom: 50, left: 25 }, duration: 0 });
      t.assert.deepEqual(
        fixedLngLat(camera.getCenter(), 4),
        { lng: -96.5558, lat: 32.0833 },
        'pans to coordinates based on fitBounds with padding option as object applied'
      );
    });
  });
});
