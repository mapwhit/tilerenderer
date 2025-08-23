// The main thread interface. Provided by Worker in a browser environment,
// and MessageBus below in a node environment.

class MessageBus {
  constructor(addListeners, postListeners) {
    this.addListeners = addListeners;
    this.postListeners = postListeners;
  }

  addEventListener(event, callback) {
    if (event === 'message') {
      this.addListeners.push(callback);
    }
  }

  removeEventListener(event, callback) {
    const i = this.addListeners.indexOf(callback);
    if (i >= 0) {
      this.addListeners.splice(i, 1);
    }
  }

  postMessage(data) {
    setImmediate(() => {
      try {
        for (const listener of this.postListeners) {
          listener({ data: data, target: this.target });
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  terminate() {
    this.addListeners.splice(0, this.addListeners.length);
    this.postListeners.splice(0, this.postListeners.length);
  }

  importScripts() {}
}

function WebWorker() {
  const parentListeners = [];
  const workerListeners = [];
  const parentBus = new MessageBus(workerListeners, parentListeners);
  const workerBus = new MessageBus(parentListeners, workerListeners);

  parentBus.target = workerBus;
  workerBus.target = parentBus;

  new WebWorker.Worker(workerBus);

  return parentBus;
}

export default WebWorker;
