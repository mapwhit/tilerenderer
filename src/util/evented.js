class Event {
  constructor(type, data) {
    Object.assign(this, data);
    this.type = type;
  }
}

class ErrorEvent extends Event {
  constructor(error, data) {
    super('error', Object.assign({ error }, data));
  }
}

/**
 * Methods mixed in to other classes for event capabilities.
 *
 * @mixin Evented
 */
class Evented {
  #listeners;
  #oneTimeListeners;
  #parent;
  #parentData;

  /**
   * Adds a listener to a specified event type.
   *
   * @param {string} type The event type to add a listen for.
   * @param {Function} listener The function to be called when the event is fired.
   *   The listener function is called with the data object passed to `fire`,
   *   extended with `target` and `type` properties.
   * @returns {Object} `this`
   */
  on(type, listener) {
    this.#listeners ??= listeners();
    this.#listeners.add(type, listener);

    return this;
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param {string} type The event type to remove listeners for.
   * @param {Function} listener The listener function to remove.
   * @returns {Object} `this`
   */
  off(type, listener) {
    this.#listeners?.remove(type, listener);
    this.#oneTimeListeners?.remove(type, listener);

    return this;
  }

  /**
   * Adds a listener that will be called only once to a specified event type.
   *
   * The listener will be called first time the event fires after the listener is registered.
   *
   * @param {string} type The event type to listen for.
   * @param {Function} listener The function to be called when the event is fired the first time.
   * @returns {Object} `this`
   */
  once(type, listener) {
    this.#oneTimeListeners ??= listeners({ once: true });
    this.#oneTimeListeners.add(type, listener);

    return this;
  }

  fire(event) {
    // Compatibility with (type: string, properties: Object) signature from previous versions.
    // See https://github.com/mapbox/mapbox-gl-js/issues/6522,
    //     https://github.com/mapbox/mapbox-gl-draw/issues/766
    if (typeof event === 'string') {
      event = new Event(event, arguments[1]);
    }

    const { type } = event;

    if (this.listens(type)) {
      event.target = this;
      this.#listeners?.fire(type, this, event);
      this.#oneTimeListeners?.fire(type, this, event);

      const parent = this.#parent;
      if (parent) {
        Object.assign(event, this.#parentData);
        parent.fire(event);
      }
    } else if (event instanceof ErrorEvent) {
      // To ensure that no error events are dropped, print them to the
      // console if they have no listeners.
      console.error(event.error);
    }

    return this;
  }

  /**
   * Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.
   *
   * @param {string} type The event type
   * @returns {boolean} `true` if there is at least one registered listener for specified event type, `false` otherwise
   */
  listens(type) {
    return this.#listeners?.listens(type) || this.#oneTimeListeners?.listens(type) || this.#parent?.listens(type);
  }

  /**
   * Bubble all events fired by this instance of Evented to this parent instance of Evented.
   *
   * @returns {Object} `this`
   */
  setEventedParent(parent, data) {
    this.#parent = parent;
    this.#parentData = data;

    return this;
  }
}

module.exports = {
  Event,
  ErrorEvent,
  Evented
};

function listeners({ once } = {}) {
  const bag = new Map();

  return {
    add,
    remove,
    fire,
    listens
  };

  function add(type, listener) {
    const list = bag.get(type);
    if (!list) {
      bag.set(type, [listener]);
    } else if (!list.includes(listener)) {
      list.push(listener);
    }
  }

  function remove(type, listener) {
    const list = bag.get(type);
    if (!list) {
      return;
    }
    const index = list.indexOf(listener);
    if (index !== -1) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      bag.delete(type);
    }
  }

  function fire(type, thisArg, data) {
    let list = bag.get(type);
    if (!list || list.length === 0) {
      return;
    }
    if (once) {
      bag.delete(type);
    } else {
      // make sure adding or removing listeners inside other listeners won't cause an infinite loop
      list = list.slice();
    }
    for (const listener of list) {
      listener.call(thisArg, data);
    }
  }

  function listens(type) {
    return bag.get(type)?.length > 0;
  }
}
