const net = require('net');
const { writeVarInt, readVarInt, createPacket } = require('./varint');

function pingJavaSlp(host, port = 25565, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let received = Buffer.alloc(0);
    let t0 = 0;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket.destroy();
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`TCP connection timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    socket.connect(port, host, () => {
      t0 = Date.now();
      const hostBuf = Buffer.from(host, 'utf8');
      
      const handshake = createPacket(0x00, Buffer.concat([
        writeVarInt(47),
        writeVarInt(hostBuf.length),
        hostBuf,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        writeVarInt(1)
      ]));
      const statusReq = createPacket(0x00, Buffer.alloc(0));

      socket.write(handshake);
      socket.write(statusReq);
    });

    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);

      const lenInfo = readVarInt(received, 0);
      if (!lenInfo) return;

      let offset = lenInfo.bytesRead;
      if (received.length < offset + lenInfo.value) return;

      const idInfo = readVarInt(received, offset);
      if (!idInfo) return;
      offset += idInfo.bytesRead;

      if (idInfo.value === 0x00) {
        const strLenInfo = readVarInt(received, offset);
        if (!strLenInfo) return;
        offset += strLenInfo.bytesRead;

        const pingMs = Math.max(1, Date.now() - t0);
        const jsonStr = received.toString('utf8', offset, offset + strLenInfo.value);
        cleanup();

        try {
          const parsed = JSON.parse(jsonStr);
          resolve({
            success: true,
            pingMs,
            rawJson: parsed,
            versionName: parsed.version?.name || 'Unknown',
            protocolVersion: parsed.version?.protocol ?? null,
            playersOnline: parsed.players?.online ?? 0,
            playersMax: parsed.players?.max ?? 0,
            playerSample: Array.isArray(parsed.players?.sample) ? parsed.players.sample : [],
            description: parsed.description,
            hasFavicon: !!parsed.favicon,
            enforcesSecureChat: parsed.enforcesSecureChat ?? null,
            previewsChat: parsed.previewsChat ?? null,
            modInfo: parsed.modinfo || parsed.forgeData || null
          });
        } catch (err) {
          reject(new Error('Invalid JSON status format from server'));
        }
      }
    });

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

module.exports = {
  pingJavaSlp
};
