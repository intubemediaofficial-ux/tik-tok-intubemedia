import sharp from "sharp";

const svg = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb020"/><stop offset=".55" stop-color="#ff3d7f"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="512" height="512" rx="120" fill="url(#g)"/><path d="M150 150h212v62h-75v190h-62V212h-75z" fill="#120f1d"/><circle cx="360" cy="360" r="34" fill="#120f1d"/></svg>`;

async function main() {
  for (const size of [192, 512]) await sharp(Buffer.from(svg(size))).png().toFile(`public/icon-${size}.png`);
  await sharp(Buffer.from(svg(64))).png().toFile("src/app/icon.png");
  console.log("icons ok");
}
main();
