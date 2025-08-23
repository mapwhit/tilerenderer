import assert from 'assert';

export default function taskQueue(thisArg) {
  const queues = {
    running: [],
    later: []
  };
  let id = Number.MIN_SAFE_INTEGER;
  let cleared = false;

  return {
    add,
    remove,
    run,
    clear
  };

  function add(fn) {
    if (id === Number.MAX_SAFE_INTEGER) id = Number.MIN_SAFE_INTEGER;
    id += 1;
    queues.later.push({ fn, id, cancelled: false });
    return id;
  }

  function remove(id) {
    const task = queues.running.find(t => t.id === id) ?? queues.later.find(t => t.id === id);
    if (task) {
      task.cancelled = true;
    }
  }

  function run() {
    assert(queues.running.length === 0);
    queues.running = queues.later;
    queues.later = [];
    for (const { fn, cancelled } of queues.running) {
      if (cancelled) continue;
      fn.call(thisArg);
      if (cleared) break;
    }
    queues.running.length = 0;
    cleared = false;
  }

  function clear() {
    if (queues.running.length > 0) {
      cleared = true;
    }
    queues.later.length = 0;
  }
}
