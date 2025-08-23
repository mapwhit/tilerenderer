import config from './config.js';

export default function () {
  return new window.Worker(config.WORKER_URL);
}
