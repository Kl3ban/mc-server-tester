const dgram = require('dgram');

const RAKNET_MAGIC = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');

function pingBedrockRaknet(host, port = 19132, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let timer = null;
    let t0 = 0;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try { socket.close(); } catch (e) {}
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`UDP RakNet query timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    const pingBuf = Buffer.alloc(33);
    pingBuf.writeUInt8(0x01, 0);
    pingBuf.writeBigInt64BE(BigInt(Date.now()), 1);
    RAKNET_MAGIC.copy(pingBuf, 9);
    pingBuf.writeBigInt64BE(BigInt(0x12345678), 25);

    socket.on('message', (msg) => {
      const pingMs = Math.max(1, Date.now() - t0);
      if (msg[0] === 0x1c) {
        cleanup();
        try {
          if (msg.length < 35) {
            return reject(new Error('RakNet Pong packet is too short'));
          }
          const strLen = msg.readUInt16BE(33);
          const serverStr = msg.toString('utf8', 35, 35 + strLen);
          const parts = serverStr.split(';');

          resolve({
            success: true,
            pingMs,
            edition: parts[0] || 'MCPE',
            motdLine1: parts[1] || '',
            protocolVersion: parts[2] ? parseInt(parts[2], 10) : null,
            versionName: parts[3] || 'Bedrock',
            playersOnline: parseInt(parts[4] || '0', 10),
            playersMax: parseInt(parts[5] || '0', 10),
            serverId: parts[6] || '',
            motdLine2: parts[7] || '',
            gameMode: parts[8] || '',
            gameModeNumeric: parts[9] || '',
            portIPv4: parts[10] || '',
            portIPv6: parts[11] || ''
          });
        } catch (e) {
          reject(e);
        }
      }
    });

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });

    t0 = Date.now();
    socket.send(pingBuf, 0, pingBuf.length, port, host, (err) => {
      if (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

module.exports = {
  pingBedrockRaknet
};
