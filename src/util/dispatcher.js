const uniqueId = require('./unique_id');
const actor = require('./actor');

module.exports = dispatcher;

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @private
 */
function dispatcher(workerPool, parent, makeActor = actor) {
  // exposed to allow stubbing in unit tests

  let currentActor = -1;
  const id = uniqueId();
  const workers = workerPool.acquire(id);
  const actors = workers.map((worker, i) => makeActor(worker, parent, id, `Worker ${i}`));

  /**
   * Broadcast a message to all Workers.
   */
  function broadcast(type, data) {
    const tasks = actors.map(actor => actor.send(type, data));
    return Promise.all(tasks);
  }

  // Use round robin to send requests to web workers.
  function nextActorId() {
    currentActor += 1;
    if (currentActor === actors.length) {
      currentActor = 0;
    }
    return currentActor;
  }

  /**
   * Send a message to a Worker.
   * @param targetID The ID of the Worker to which to send this message. Omit to allow the dispatcher to choose.
   * @returns The ID of the worker to which the message was sent.
   */
  function send(type, data, targetID = nextActorId()) {
    return actors[targetID]?.send(type, data) ?? Promise.resolve();
  }

  function remove() {
    actors.forEach(actor => actor.remove());
    actors.length = 0;
    workerPool.release(id);
  }

  function nextWorkerId(workerId = nextActorId()) {
    return workerId;
  }

  return {
    get id() {
      return id;
    },
    broadcast,
    send,
    nextWorkerId,
    remove
  };
}
