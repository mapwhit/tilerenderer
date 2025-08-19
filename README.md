[![NPM version][npm-image]][npm-url]
[![Build Status][build-image]][build-url]
[![Dependency Status][deps-image]][deps-url]

# @mapwhit/tilerenderer

This project began as a fork of the [mapbox-gl-js] with the following changes:
- slimmed down to concentrate on tile rendering
- written in idiomatic java script
- targeting only ever-green browsers

## Coding style

Object properties and functions are:
- private, start with `#`, can only be used by the methods of the object
- internal, start with `_`, can only be used by objects defined witing this module, can be changed and removed without notice
- public, otherwise

## License

[BSD-3-Clause](LICENSE.txt)

[mapbox-gl-js]: https://npmjs.org/package/mapbox-gl

[npm-image]: https://img.shields.io/npm/v/@mapwhit/tilerenderer
[npm-url]: https://npmjs.org/package/@mapwhit/tilerenderer

[build-url]: https://github.com/mapwhit/tilerenderer/actions/workflows/check.yaml
[build-image]: https://img.shields.io/github/actions/workflow/status/mapwhit/tilerenderer/check.yaml?branch=main

[deps-image]: https://img.shields.io/librariesio/release/npm/@mapwhit/tilerenderer
[deps-url]: https://libraries.io/npm/@mapwhit%2Ftilerenderer
