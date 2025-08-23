/**
 * Print a warning message to the console and ensure duplicate warning messages
 * are not printed.
 *
 * @private
 */
const warnOnceHistory = {};

function warnOnce(message) {
  if (!warnOnceHistory[message]) {
    console.warn(message);
    warnOnceHistory[message] = true;
  }
}

function noop() {}

const once = typeof console !== 'undefined' ? warnOnce : noop;

// console isn't defined in some WebWorkers, see #2558
export default { once };
