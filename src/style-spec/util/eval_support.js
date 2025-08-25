export default (function () {
  try {
    new Function('');
    return true;
  } catch {
    return false;
  }
})();
