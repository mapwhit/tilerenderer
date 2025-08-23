const DOM = {};
export default DOM;

DOM.create = function (tagName, className, container) {
  const el = window.document.createElement(tagName);
  if (className) el.className = className;
  if (container) container.appendChild(el);
  return el;
};

DOM.createNS = function (namespaceURI, tagName) {
  const el = window.document.createElementNS(namespaceURI, tagName);
  return el;
};
