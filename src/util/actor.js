const { serialize, deserialize } = require('./web_worker_transfer');

module.exports = actor;

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 *
 * @param {WebWorker} target
 * @param {WebWorker} parent
 * @param {string|number} mapId A unique identifier for the Map instance using this Actor.
 * @private
 */

function actor(target, parent, mapId, name) {
  const promises = new Map();
  let callbackID = Number.MIN_SAFE_INTEGER;
  target.addEventListener('message', receive, false);

  return {
    send,
    receive,
    remove,
    name
  };

  /**
   * Sends a message from a main-thread map to a Worker or from a Worker back to
   * a main-thread map instance.
   *
   * @param type The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
   * @param targetMapId A particular mapId to which to send this message.
   * @private
   */
  function send(type, data, targetMapId) {
    const id = `${mapId}:${callbackID++}`;
    const p = Promise.withResolvers();
    promises.set(id, p);
    postMessage(targetMapId, id, type, data);
    return p.promise;
  }

  function receive(message) {
    const { data } = message;
    const { id, type, targetMapId } = data;

    if (targetMapId && mapId !== targetMapId) return;

    if (type === '<response>') {
      const p = promises.get(id);
      if (p) {
        promises.delete(id);
        if (data.error) {
          p.reject(deserialize(data.error));
        } else {
          p.resolve(deserialize(data.data));
        }
      }
      return;
    }

    if (typeof id !== 'undefined') {
      const done = (err, data) => postMessage(undefined, id, '<response>', data, err);
      if (parent[type]) {
        // data.type == 'loadTile', 'removeTile', etc.
        parent[type](data.sourceMapId, deserialize(data.data), done);
        return;
      }
      if (parent.getWorkerSource) {
        // data.type == sourcetype.method
        const [sourcetype, method] = type.split('.');
        const params = deserialize(data.data);
        const workerSource = parent.getWorkerSource(data.sourceMapId, sourcetype, params.source);
        workerSource[method](params, done);
        return;
      }
    }

    parent[type](deserialize(data.data));
  }

  function remove() {
    target.removeEventListener('message', receive, false);
  }

  function postMessage(targetMapId, id, type, data, err) {
    const buffers = [];
    const payload = {
      targetMapId,
      sourceMapId: mapId,
      type,
      id,
      data: serialize(data, buffers)
    };
    if (err) {
      payload.error = serialize(err);
    }
    target.postMessage(payload, buffers);
  }
}
