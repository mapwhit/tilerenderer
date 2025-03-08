const fs = require('node:fs/promises');
const mapnik = require('mapnik');

function addData(vector, ...args) {
  return new Promise((resolve, reject) => {
    vector.addData(...args, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function upgrade(z, x, y, path) {
  console.log('Updating ', path);
  const buffer = fs.readFileSync(path);
  const vt = new mapnik.VectorTile(z, x, y);
  await addData(vt, buffer, { upgrade: true, validate: true });
  await fs.writeFile(path, vt.getDataSync());
}

async function createExtent1024() {
  console.log('Creating extent1024');
  const buffer = fs.readFileSync('14-8802-5374.mvt');
  const vt = new mapnik.VectorTile(14, 8802, 5374, { tileSize: 1024 });
  await addData(vt, buffer, { validate: true });
  await fs.writeFileSync('extent1024-14-8802-5374.mvt', vt.getDataSync());
}

async function run() {
  await upgrade(0, 0, 0, '0-0-0.mvt');
  await upgrade(14, 8802, 5374, '14-8802-5374.mvt');
  await upgrade(14, 8802, 5375, '14-8802-5375.mvt');
  await upgrade(14, 8803, 5374, '14-8803-5374.mvt');
  await upgrade(14, 8803, 5375, '14-8803-5375.mvt');
  await upgrade(2, 1, 1, '2-1-1.mvt');
  await upgrade(2, 1, 2, '2-1-2.mvt');
  await upgrade(2, 2, 1, '2-2-1.mvt');
  await upgrade(2, 2, 2, '2-2-2.mvt');
  await upgrade(7, 37, 48, 'counties-7-37-48.mvt');
  await createExtent1024();
}

run().then(() => {
  console.log('Done.');
});
