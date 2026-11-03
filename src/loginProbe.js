const net = require('net');
const { writeVarInt, readVarInt, createPacket } = require('./varint');
const { parseChatComponent, cleanMinecraftFormatting } = require('./cleanText');

function createLoginStartPacket(username, protocolVersion) {
  const userBuf = Buffer.from(username, 'utf8');

  if (protocolVersion >= 764) {
    const uuidBuf = Buffer.alloc(16, 0);
    return createPacket(0x00, Buffer.concat([
      writeVarInt(userBuf.length),
      userBuf,
      uuidBuf
    ]));
  }

  return createPacket(0x00, Buffer.concat([
    writeVarInt(userBuf.length),
    userBuf
  ]));
}

function probeLoginPacket(host, port, protocolVersion, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let timer = null;
    let buf = Buffer.alloc(0);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      s.destroy();
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({
        status: 'TIMEOUT',
        hangsOnJoin: true,
        message: 'Server did not respond to login packet (connection hangs on joining world or filter is active)'
      });
    }, timeoutMs);

    s.connect(port, host, () => {
      const hostBuf = Buffer.from(host, 'utf8');
      const handshake = createPacket(0x00, Buffer.concat([
        writeVarInt(protocolVersion),
        writeVarInt(hostBuf.length),
        hostBuf,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        writeVarInt(2)
      ]));

      const loginStart = createLoginStartPacket('PlayerTest', protocolVersion);

      s.write(handshake);
      s.write(loginStart);
    });

    s.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        const len = readVarInt(buf, 0);
        if (len && buf.length >= len.bytesRead + len.value) {
          const id = readVarInt(buf, len.bytesRead);
          const packetId = id.value;
          const payload = buf.subarray(len.bytesRead + id.bytesRead, len.bytesRead + len.value);
          cleanup();

          if (packetId === 0x00) {
            let reasonText = '';
            try {
              const strLen = readVarInt(payload, 0);
              const jsonStr = payload.subarray(strLen.bytesRead, strLen.bytesRead + strLen.value).toString('utf8');
              const parsed = JSON.parse(jsonStr);
              reasonText = cleanMinecraftFormatting(parseChatComponent(parsed)).trim();
            } catch (e) {
              reasonText = cleanMinecraftFormatting(payload.toString('utf8')).trim();
            }
            return resolve({
              status: 'KICKED',
              hangsOnJoin: false,
              kickReason: reasonText || 'Connection rejected by server'
            });
          }

          if (packetId === 0x01) {
            return resolve({
              status: 'PREMIUM',
              hangsOnJoin: false,
              authType: 'PREMIUM only (Official Mojang/Microsoft account required)',
              isPremium: true
            });
          }

          if (packetId === 0x02 || packetId === 0x03 || packetId === 0x04) {
            return resolve({
              status: 'NON_PREMIUM',
              hangsOnJoin: false,
              authType: 'NON-PREMIUM and PREMIUM (Cracked clients allowed)',
              isPremium: false
            });
          }

          return resolve({
            status: 'ACCEPTED',
            hangsOnJoin: false,
            authType: 'Connection accepted by server'
          });
        }
      } catch (e) {}
    });

    s.on('error', (err) => {
      cleanup();
      resolve({
        status: 'ERROR',
        hangsOnJoin: false,
        message: err.message
      });
    });
  });
}

async function probeLogin(host, port, reportedProtocol = 765) {
  const mainProtocol = (typeof reportedProtocol === 'number' && reportedProtocol > 0) ? reportedProtocol : 765;
  const result = await probeLoginPacket(host, port, mainProtocol, 1100);

  if (result.status === 'PREMIUM' || result.status === 'NON_PREMIUM') {
    return result;
  }

  if (result.status === 'TIMEOUT' && mainProtocol !== 765) {
    const fallbackResult = await probeLoginPacket(host, port, 765, 900);
    if (fallbackResult.status !== 'TIMEOUT') {
      return fallbackResult;
    }
  }

  return result;
}

module.exports = {
  probeLogin
};
