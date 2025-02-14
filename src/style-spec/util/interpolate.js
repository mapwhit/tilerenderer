const Color = require('./color');

function number(a, b, t) {
  return a * (1 - t) + b * t;
}

function color(from, to, t) {
  return new Color(number(from.r, to.r, t), number(from.g, to.g, t), number(from.b, to.b, t), number(from.a, to.a, t));
}

function array(from, to, t) {
  return from.map((d, i) => {
    return number(d, to[i], t);
  });
}

module.exports = {
  number,
  color,
  array
};
