import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { report } from 'node:process';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import colors from 'chalk';
import template from 'lodash.template';
import shuffler from 'shuffle-seed';
import loader from './loader.js';
export default harness;

async function harness(cwd, implementation, options, run) {
  const sequence = await generateTestSequence(cwd, implementation, options);
  const runTest = promisify(run);
  const tests = await runSequence(sequence, runTest, options);

  if (process.env.UPDATE) {
    console.log(`Updated ${tests.length} tests.`);
    process.exit(0);
  }

  let passedCount = 0;
  let ignoreCount = 0;
  let ignorePassCount = 0;
  let failedCount = 0;
  let erroredCount = 0;

  tests.forEach(test => {
    if (test.ignored && !test.ok) {
      ignoreCount++;
    } else if (test.ignored) {
      ignorePassCount++;
    } else if (test.error) {
      erroredCount++;
    } else if (!test.ok) {
      failedCount++;
    } else {
      passedCount++;
    }
  });

  const totalCount = passedCount + ignorePassCount + ignoreCount + failedCount + erroredCount;

  if (passedCount > 0) {
    console.log(colors.green('%d passed (%s%)'), passedCount, ((100 * passedCount) / totalCount).toFixed(1));
  }

  if (ignorePassCount > 0) {
    console.log(
      colors.yellow('%d passed but were ignored (%s%)'),
      ignorePassCount,
      ((100 * ignorePassCount) / totalCount).toFixed(1)
    );
  }

  if (ignoreCount > 0) {
    console.log(colors.white('%d ignored (%s%)'), ignoreCount, ((100 * ignoreCount) / totalCount).toFixed(1));
  }

  if (failedCount > 0) {
    console.log(colors.red('%d failed (%s%)'), failedCount, ((100 * failedCount) / totalCount).toFixed(1));
  }

  if (erroredCount > 0) {
    console.log(colors.red('%d errored (%s%)'), erroredCount, ((100 * erroredCount) / totalCount).toFixed(1));
  }

  await writeResults(cwd, options, tests);

  if (failedCount > 0 || erroredCount > 0) {
    process.exit(1);
  }
}

async function runSequence(sequence, runTest, { testReporter, bail }) {
  const tests = [];

  for (const style of sequence) {
    const test = style.metadata.test;
    const reporter = testReporter === 'dot' ? dotReporter(test) : verboseReporter(test);
    try {
      reporter.start();
      await runTest(style, test);
    } catch (error) {
      test.error = error;
    } finally {
      reporter.end();
    }
    tests.push(test);
    if (bail && (!test.ok || test.error)) {
      break;
    }
  }
  return tests;
}

async function generateTestSequence(cwd, implementation, options) {
  const loaderInstance = loader();
  const { tests = [], ignores = {}, fixtureFilename = 'style.json' } = options;

  const files = fs.glob(`**/${fixtureFilename}`, { cwd });
  const styles = await Promise.all(await Array.fromAsync(files, fixtureToStyle));
  const sequence = styles.filter(filterTest);

  if (!options.shuffle) {
    return sequence;
  }
  console.log(colors.white('* shuffle seed: ') + colors.bold(`${options.seed}`));
  return shuffler.shuffle(sequence, options.seed);

  async function fixtureToStyle(fixture) {
    const id = path.dirname(fixture);
    const styleData = await fs.readFile(path.join(cwd, fixture), 'utf8');
    const style = JSON.parse(styleData);

    await loaderInstance.localizeURLs(style);

    style.metadata ??= style.metadata || {};
    const test = (style.metadata.test = Object.assign(
      {
        id,
        ignored: ignores[`${path.basename(cwd)}/${id}`],
        width: 512,
        height: 512,
        pixelRatio: 1,
        recycleMap: options.recycleMap || false,
        allowed: 0.00015
      },
      style.metadata.test
    ));

    if ('diff' in test) {
      if (typeof test.diff === 'number') {
        test.allowed = test.diff;
      } else if (implementation in test.diff) {
        test.allowed = test.diff[implementation];
      }
    }

    return style;
  }

  function filterTest(style) {
    const { id, ignored } = style.metadata.test;

    if (tests.length !== 0 && !tests.some(t => id.indexOf(t) !== -1)) {
      return false;
    }

    if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && id.match(/^debug\//)) {
      console.log(colors.gray(`* skipped ${id}`));
      return false;
    }

    if (/^skip/.test(ignored)) {
      console.log(colors.gray(`* skipped ${id} (${ignored})`));
      return false;
    }

    return true;
  }
}

async function writeResults(cwd, options, tests) {
  const p = path.join(cwd, options.recycleMap ? 'index-recycle-map.html' : 'index.html');
  await pipeline(resuts(), createWriteStream(p));

  console.log(`Results at: ${p}`);

  async function* resuts() {
    const resultsTemplate = template(
      await fs.readFile(path.join(import.meta.dirname, '..', 'results.html.tmpl'), 'utf8')
    );
    const itemTemplate = template(await fs.readFile(path.join(cwd, 'result_item.html.tmpl'), 'utf8'));
    const unsuccessful = tests.filter(test => test.status === 'failed' || test.status === 'errored');
    const hasFailedTests = unsuccessful.length > 0;
    const [header, footer] = resultsTemplate({
      unsuccessful,
      tests,
      shuffle: options.shuffle,
      seed: options.seed
    }).split('<!-- results go here -->');
    yield header;
    for (const r of tests) {
      yield itemTemplate({ r, hasFailedTests });
    }
    yield footer;
  }
}

function verboseReporter(test) {
  return {
    start,
    end
  };

  function start() {
    console.log(colors.blue(`* testing ${test.id}`));
  }

  function end() {
    if (test.ignored && !test.ok) {
      test.color = '#9E9E9E';
      test.status = 'ignored failed';
      console.log(colors.white(`* ignore ${test.id} (${test.ignored})`));
    } else if (test.ignored) {
      test.color = '#E8A408';
      test.status = 'ignored passed';
      console.log(colors.yellow(`* ignore ${test.id} (${test.ignored})`));
    } else if (test.error) {
      test.color = 'red';
      test.status = 'errored';
      console.log(colors.red(`* errored ${test.id}`));
    } else if (!test.ok) {
      test.color = 'red';
      test.status = 'failed';
      console.log(colors.red(`* failed ${test.id}`));
    } else {
      test.color = 'green';
      test.status = 'passed';
      console.log(colors.green(`* passed ${test.id}`));
    }
  }
}

function dotReporter(test) {
  return {
    start,
    end
  };

  function start() {}

  function end() {
    if (test.ignored && !test.ok) {
      test.status = 'ignored failed';
      process.stdout.write(colors.white('*'));
    } else if (test.ignored) {
      test.status = 'ignored passed';
      process.stdout.write(colors.yellow('*'));
    } else if (test.error) {
      test.color = 'red';
      test.status = 'errored';
      console.log(colors.red(`\n* errored ${test.id}`));
    } else if (!test.ok) {
      test.color = 'red';
      test.status = 'failed';
      console.log(colors.red(`\n* failed ${test.id}`));
    } else {
      test.color = 'green';
      test.status = 'passed';
      process.stdout.write(colors.green('.'));
    }
  }
} // end of dotReporter
