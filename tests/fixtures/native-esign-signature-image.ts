import { deflateSync } from "node:zlib";

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])));
  return Buffer.concat([length, typeBytes, payload, checksum]);
}

export function createSyntheticSignaturePng(width = 160, height = 60): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rowBytes = width * 4 + 1;
  const pixels = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const targetX = Math.round((y / Math.max(1, height - 1)) * (width - 1));
    for (let x = Math.max(0, targetX - 3); x <= Math.min(width - 1, targetX + 3); x += 1) {
      const offset = y * rowBytes + 1 + x * 4;
      pixels[offset] = 23;
      pixels[offset + 1] = 23;
      pixels[offset + 2] = 23;
      pixels[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
