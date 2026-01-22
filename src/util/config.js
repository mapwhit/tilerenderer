import { Evented } from '@mapwhit/events';

const config = new Evented();

export default config;

config.set = function set(c) {
  Object.assign(config, c);
  config.notify();
};

config.notify = function () {
  config.fire('change', config);
};

config.set({});
