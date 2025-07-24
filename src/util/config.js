const { Evented } = require('@mapwhit/events');

function getDefaultWorkerCount() {
  const browser = require('./browser');
  return Math.max(Math.floor(browser.hardwareConcurrency / 2), 1);
}

const config = new Evented();

config.set = function set(c) {
  Object.assign(config, c);
  config.notify();
};

config.notify = function () {
  config.fire('change', config);
};

config.set({
  WORKER_COUNT: getDefaultWorkerCount(),
  WORKER_URL: ''
});

module.exports = config;
