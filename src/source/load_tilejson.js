'use strict';

const { pick } = require('../util/object');

const { getJSON } = require('../util/ajax');
const browser = require('../util/browser');
const { normalizeSourceURL: normalizeURL } = require('../util/mapbox');


module.exports = function(options, callback) {
    const loaded = function(err, tileJSON) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            const result = pick(
                tileJSON,
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds']
            );

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            callback(null, result);
        }
    };

    if (options.url) {
        getJSON({ url: normalizeURL(options.url) }, loaded);
    } else {
        browser.frame(() => loaded(null, options));
    }
};
