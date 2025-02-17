/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
 */
function doubleClickZoomHandler(map) {
  let enabled = false;
  let active = false;

  let tapped;

  /**
   * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
   *
   * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
   */
  function isEnabled() {
    return enabled;
  }

  /**
   * Returns a Boolean indicating whether the "double click to zoom" interaction is active, i.e. currently being used.
   *
   * @returns {boolean} `true` if the "double click to zoom" interaction is active.
   */
  function isActive() {
    return active;
  }

  /**
   * Enables the "double click to zoom" interaction.
   *
   * @example
   * map.doubleClickZoom.enable();
   */
  function enable() {
    enabled = true;
  }

  /**
   * Disables the "double click to zoom" interaction.
   *
   * @example
   * map.doubleClickZoom.disable();
   */
  function disable() {
    enabled = false;
  }

  function onPointerDown(e) {
    if (!enabled) return;

    if (!tapped) {
      tapped = setTimeout(() => {
        tapped = undefined;
      }, 300);
    } else {
      clearTimeout(tapped);
      tapped = undefined;
      zoom(e);
    }
  }

  function onDblClick(e) {
    if (!enabled) return;
    e.originalEvent.preventDefault();
    zoom(e);
  }

  function zoom(e) {
    active = true;
    map.on('zoomend', onZoomEnd);
    map.zoomTo(map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1), { around: e.lngLat }, e);
  }

  function onZoomEnd() {
    active = false;
    map.off('zoomend', onZoomEnd);
  }

  return {
    isEnabled,
    isActive,
    enable,
    disable,
    onDblClick,
    onPointerDown
  };
}

module.exports = doubleClickZoomHandler;
