import { Evented } from '@mapwhit/events';
import browser from './browser.js';

function getDefaultWorkerCount() {
  return Math.max(Math.floor(browser.hardwareConcurrency / 2), 1);
}

const config = new Evented();

export default config;

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
