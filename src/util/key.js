export default createKey;

function stringify(obj) {
  if (obj == null) {
    return 'null';
  }
  const type = typeof obj;
  if (type === 'number' || type === 'boolean' || type === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(val => stringify(val)).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  return '{' + keys.map(key => `${key}:${stringify(obj[key])}`).join(',') + '}';
}

/**
 * Create a unique key for an based on its properties.
 */
function createKey(properties, object) {
  return properties.map(k => stringify(object[k])).join('/');
}
