import assert from 'node:assert/strict';
import { glob, mkdir } from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readPNG, writePNG } from '../png.js';

/**
 * Checks if rendered `data` matches any of the expected images in `expectedPaths`.
 * @param {*} test
 * @param {*} param
 */
export default async function renderTest(test, { data, directory }) {
  const png = new PNG({
    width: Math.floor(test.width * test.pixelRatio),
    height: Math.floor(test.height * test.pixelRatio)
  });

  // PNG data must be unassociated (not premultiplied)
  for (let i = 0; i < data.length; i++) {
    const a = data[i * 4 + 3] / 255;
    if (a !== 0) {
      data[i * 4 + 0] /= a;
      data[i * 4 + 1] /= a;
      data[i * 4 + 2] /= a;
    }
  }

  png.data = data;

  const dir = path.join(directory, test.id);
  await mkdir(dir, { recursive: true });
  // there may be multiple expected images, covering different platforms
  const expectedPaths = await Array.fromAsync(glob(path.join(dir, 'expected*.png')));
  if (!process.env.UPDATE && expectedPaths.length === 0) {
    throw new Error('No expected*.png files found; did you mean to run tests with UPDATE=true?');
  }

  if (process.env.UPDATE) {
    const expected = path.join(dir, 'expected.png');
    await writePNG(expected, png);
    return;
  }

  const actual = path.join(dir, 'actual.png');
  const diff = path.join(dir, 'diff.png');
  await writePNG(actual, png);

  const { difference } = await compare(png, expectedPaths, diff);
  test.difference = difference;
  assert(difference <= test.allowed, `the difference ${difference} is bigger than allowed ${test.allowed}`);
}

/**
 * Compares actual image with expected images and returns the difference.
 *
 * If we have multiple expected images, we'll compare against each one and pick the one
 * with the least amount of difference; this is useful for covering features that render
 * differently depending on platform, i.e. heatmaps use half-float textures for improved
 * rendering where supported
 *
 * @param {string} actualPath - Path to the actual image.
 * @param {string} expectedPaths - Array of paths to expected images.
 * @param {string} diffPath - Path to save the difference image.
 * @returns {Promise<{difference: number, expected: string}>} - Object containing the difference and the expected image path.
 */
async function compare(actualImg, expectedPaths, diffPath) {
  const expectedImgs = await Promise.all(expectedPaths.map(readPNG));

  let minNumPixels = Number.POSITIVE_INFINITY;
  let minDiff;
  let expected;

  const { width, height, data } = actualImg;
  for (let i = 0; i < expectedImgs.length; i++) {
    const expectedImg = expectedImgs[i];
    const diff = new PNG({ width, height });
    const numPixels = pixelmatch(data, expectedImg.data, diff.data, width, height, {
      threshold: 0.13
    });

    if (numPixels < minNumPixels) {
      minNumPixels = numPixels;
      minDiff = diff;
      expected = expectedPaths[i];
    }
  }

  await writePNG(diffPath, minDiff);
  return {
    difference: minNumPixels / (minDiff.width * minDiff.height),
    expected
  };
}
