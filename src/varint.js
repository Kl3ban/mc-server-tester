function writeVarInt(value) {
  const bytes = [];
  while (true) {
    if ((value & 0xffffff80) === 0) {
      bytes.push(value);
      return Buffer.from(bytes);
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
}

function readVarInt(buffer, offset = 0) {
  let value = 0;
  let bytesRead = 0;
  let currentByte = 0;
  do {
    if (offset + bytesRead >= buffer.length) {
      return null;
    }
    currentByte = buffer[offset + bytesRead];
    value |= (currentByte & 0x7f) << (7 * bytesRead);
    bytesRead++;
    if (bytesRead > 5) {
      throw new Error('VarInt is too big');
    }
  } while ((currentByte & 0x80) !== 0);
  return { value, bytesRead };
}

function createPacket(id, payload) {
  const idBuf = writeVarInt(id);
  const lenBuf = writeVarInt(idBuf.length + payload.length);
  return Buffer.concat([lenBuf, idBuf, payload]);
}

module.exports = {
  writeVarInt,
  readVarInt,
  createPacket
};
