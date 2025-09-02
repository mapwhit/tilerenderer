import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { PNG } from 'pngjs';

export function readPNG(filePath) {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    createReadStream(filePath)
      .pipe(png)
      .on('parsed', () => resolve(png))
      .on('error', reject);
  });
}

export function writePNG(filePath, png) {
  return pipeline(png.pack(), createWriteStream(filePath));
}
