/**
 * Throttle the given function to run at most every `period` milliseconds.
 Throttle the given function to run at most every period milliseconds.
 * @private
 */
export default function throttle(fn, time) {
  let pending = false;
  let timerId = 0;

  const later = () => {
    timerId = 0;
    if (pending) {
      fn();
      timerId = setTimeout(later, time);
      pending = false;
    }
  };

  return () => {
    pending = true;
    if (!timerId) {
      later();
    }
    return timerId;
  };
}
