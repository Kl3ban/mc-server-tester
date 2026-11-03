const dns = require('dns').promises;

async function resolveMinecraftDns(inputHost, defaultPort = 25565) {
  let srvRecord = null;
  let targetHost = inputHost;
  let targetPort = defaultPort;
  let ipAddress = null;
  let ipFamily = null;
  const t0 = Date.now();

  try {
    const srvs = await dns.resolveSrv(`_minecraft._tcp.${inputHost}`);
    if (srvs && srvs.length > 0) {
      srvRecord = srvs[0];
      targetHost = srvRecord.name;
      targetPort = srvRecord.port;
    }
  } catch (err) {}

  try {
    const lookup = await dns.lookup(targetHost);
    ipAddress = lookup.address;
    ipFamily = lookup.family;
  } catch (err) {}

  const dnsTimeMs = Date.now() - t0;

  return {
    inputHost,
    targetHost,
    targetPort,
    srvRecord,
    ipAddress,
    ipFamily,
    dnsTimeMs
  };
}

module.exports = {
  resolveMinecraftDns
};
