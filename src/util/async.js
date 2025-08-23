/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param array input to each call of the async function.
 * @param fn an async function with signature (data, callback)
 * @param callback a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 * @private
 */
export function all(array, fn, callback) {
  if (!array.length) return callback(null, []);
  let remaining = array.length;
  const results = new Array(array.length);
  let error = null;
  array.forEach((item, i) => {
    fn(item, (err, result) => {
      if (err) error = err;
      results[i] = result;
      if (--remaining === 0) callback(error, results);
    });
  });
}
