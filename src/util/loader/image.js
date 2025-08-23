export default image;

function image(data) {
  if (!data) {
    throw new Error('image data not loaded');
  }
  return data.byteLength === 0 ? transparentImage() : imageFromData({ data });
}

async function imageFromData(imgData) {
  const { promise, resolve } = Promise.withResolvers();
  const blob = new window.Blob([imgData.data], { type: imgData.type || 'image/png' });
  const img = new window.Image();

  img.onload = () => {
    resolve(img);
    window.URL.revokeObjectURL(img.src);
  };
  img.src = await window.URL.createObjectURL(blob);
  return promise;
}

const transparentPngUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

function transparentImage() {
  const { promise, resolve } = Promise.withResolvers();
  const img = new window.Image();
  img.onload = () => resolve(img);
  img.src = transparentPngUrl;
  return promise;
}
