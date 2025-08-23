export function callback(fn, promise) {
  if (fn) {
    promise.then(result => fn(null, result), fn);
  }
  return promise;
}

export function callbackWithSpread(fn, promise) {
  if (fn) {
    promise.then(result => fn(null, ...result), fn);
  }
  return promise;
}

export function callbackWithNoResult(fn, promise) {
  if (fn) {
    promise.then(() => fn(null), fn);
  }
  return promise;
}
