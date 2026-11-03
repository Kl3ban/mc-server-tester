const { pingJavaSlp } = require('./javaSlp');
const { pingBedrockRaknet } = require('./bedrockRaknet');
const { resolveMinecraftDns } = require('./dnsResolver');
const { fetchServerApi } = require('./apiEnricher');
const { parseChatComponent, cleanMinecraftFormatting } = require('./cleanText');
const { resolveServerInput } = require('./nameResolver');
const { probeLogin } = require('./loginProbe');

function parseAddress(input) {
  let str = (input || '').trim();
  str = str.replace(/^(minecraft:\/\/|mc:\/\/|http:\/\/|https:\/\/)/i, '');
  str = str.replace(/\/.*$/, '');

  let host = str;
  let port = null;

  if (str.startsWith('[')) {
    const closeBracket = str.indexOf(']');
    if (closeBracket !== -1) {
      host = str.substring(1, closeBracket);
      if (str[closeBracket + 1] === ':') {
        port = parseInt(str.substring(closeBracket + 2), 10);
      }
    }
  } else if (str.includes(':')) {
    const parts = str.split(':');
    host = parts[0];
    port = parseInt(parts[1], 10);
  }

  if (isNaN(port) || port <= 0 || port > 65535) {
    port = null;
  }

  return { host, port };
}

async function inspectMinecraftServer(rawInput) {
  const resolved = await resolveServerInput(rawInput);
  const { host, port } = parseAddress(resolved.address);

  if (!host) {
    throw new Error('Unable to resolve server address from the given input.');
  }

  const isExplicitBedrockPort = (port === 19132 || port === 19133);
  const startTime = Date.now();

  let report = null;
  if (isExplicitBedrockPort) {
    report = await handleBedrockInspection(host, port || 19132, resolved.address, startTime);
  } else {
    report = await handleJavaInspection(host, port, resolved.address, startTime);
  }

  report.originalInput = rawInput;
  report.aliasNotice = resolved.aliasNotice;
  return report;
}

async function handleJavaInspection(host, explicitPort, rawInput, startTime) {
  const dnsInfo = await resolveMinecraftDns(host, explicitPort || 25565);
  const targetHost = dnsInfo.targetHost;
  const targetPort = explicitPort || dnsInfo.targetPort;

  const slpPromise = pingJavaSlp(targetHost, targetPort, 2200).catch(err => ({ error: err }));
  const apiPromise = fetchServerApi(host, false, 2500).catch(() => null);

  const [slpResult, apiResult] = await Promise.all([slpPromise, apiPromise]);

  if (slpResult && !slpResult.error && slpResult.success) {
    const loginProbeResult = await probeLogin(targetHost, targetPort, slpResult.protocolVersion).catch(() => null);

    return assembleJavaReport({
      input: rawInput,
      host,
      dnsInfo,
      targetHost,
      targetPort,
      slp: slpResult,
      api: apiResult,
      loginProbe: loginProbeResult,
      source: 'DIRECT_SOCKET'
    });
  }

  if (apiResult && apiResult.online) {
    return assembleJavaReport({
      input: rawInput,
      host,
      dnsInfo,
      targetHost,
      targetPort,
      slp: null,
      api: apiResult,
      loginProbe: null,
      source: 'PUBLIC_API_FALLBACK'
    });
  }

  try {
    const bedrockCheck = await pingBedrockRaknet(host, 19132, 1200);
    if (bedrockCheck && bedrockCheck.success) {
      return assembleBedrockReport({
        input: rawInput,
        host,
        targetPort: 19132,
        dnsInfo,
        raknet: bedrockCheck,
        api: null,
        source: 'DIRECT_SOCKET'
      });
    }
  } catch (e) {}

  return assembleOfflineReport({
    input: rawInput,
    host,
    targetHost,
    targetPort,
    dnsInfo,
    reason: slpResult?.error?.message || 'Server did not respond to status request (timeout)'
  });
}

async function handleBedrockInspection(host, port, rawInput, startTime) {
  const dnsInfo = await resolveMinecraftDns(host, port);
  const targetHost = dnsInfo.targetHost;

  const raknetPromise = pingBedrockRaknet(targetHost, port, 2500).catch(err => ({ error: err }));
  const apiPromise = fetchServerApi(host, true, 2500).catch(() => null);

  const [raknetResult, apiResult] = await Promise.all([raknetPromise, apiPromise]);

  if (raknetResult && !raknetResult.error && raknetResult.success) {
    return assembleBedrockReport({
      input: rawInput,
      host,
      targetPort: port,
      dnsInfo,
      raknet: raknetResult,
      api: apiResult,
      source: 'DIRECT_SOCKET'
    });
  }

  if (apiResult && apiResult.online) {
    return assembleBedrockReport({
      input: rawInput,
      host,
      targetPort: port,
      dnsInfo,
      raknet: null,
      api: apiResult,
      source: 'PUBLIC_API_FALLBACK'
    });
  }

  return assembleOfflineReport({
    input: rawInput,
    host,
    targetHost,
    targetPort: port,
    dnsInfo,
    edition: 'Bedrock Edition',
    reason: raknetResult?.error?.message || 'No response to RakNet UDP ping'
  });
}

function assembleJavaReport({ input, host, dnsInfo, targetHost, targetPort, slp, api, loginProbe, source }) {
  let motdLines = [];
  if (slp?.description) {
    const parsedText = parseChatComponent(slp.description);
    motdLines = parsedText.split('\n').map(l => l.trim()).filter(Boolean);
  } else if (api?.motd?.clean) {
    motdLines = Array.isArray(api.motd.clean) ? api.motd.clean.map(l => l.trim()).filter(Boolean) : [api.motd.clean];
  }

  const onlinePlayers = slp ? slp.playersOnline : (api?.players?.online ?? 0);
  const maxPlayers = slp ? slp.playersMax : (api?.players?.max ?? 0);
  const percentage = maxPlayers > 0 ? ((onlinePlayers / maxPlayers) * 100).toFixed(1) : '0.0';

  let samplePlayers = [];
  if (slp?.playerSample?.length) {
    samplePlayers = slp.playerSample
      .map(p => cleanMinecraftFormatting(p.name || p.id).trim())
      .filter(Boolean);
  } else if (api?.players?.list?.length) {
    samplePlayers = api.players.list
      .map(p => cleanMinecraftFormatting(typeof p === 'string' ? p : p.name).trim())
      .filter(Boolean);
  }

  let versionName = slp?.versionName || api?.version || 'Unknown';
  versionName = cleanMinecraftFormatting(versionName).trim();
  const protocolNumber = slp?.protocolVersion ?? api?.protocol?.version ?? 'Unknown';

  let software = api?.software || null;
  if (!software) {
    const vLower = (versionName + ' ' + motdLines.join(' ')).toLowerCase();
    const hasModList = slp?.modInfo?.modList && slp.modInfo.modList.length > 0;
    
    if (hasModList) {
      software = 'Forge / NeoForge (Modded)';
    } else if (vLower.includes('velocity')) {
      software = 'Velocity (Proxy)';
    } else if (vLower.includes('bungeecord') || vLower.includes('bungee')) {
      software = 'BungeeCord (Proxy)';
    } else if (vLower.includes('purpur')) {
      software = 'Purpur (Paper Fork)';
    } else if (vLower.includes('paper')) {
      software = 'Paper (High Performance Bukkit)';
    } else if (vLower.includes('spigot')) {
      software = 'Spigot';
    } else if (vLower.includes('fabric')) {
      software = 'Fabric';
    } else if (slp?.modInfo?.type === 'FML') {
      software = 'BungeeCord / Paper (with FML handshake support)';
    } else {
      software = 'Vanilla / Spigot / Paper compatible';
    }
  }

  let modsList = [];
  if (slp?.modInfo?.modList?.length) {
    modsList = slp.modInfo.modList.map(m => typeof m === 'string' ? m : `${m.modid} (${m.version})`);
  } else if (api?.mods?.names?.length) {
    modsList = api.mods.names;
  } else if (api?.plugins?.names?.length) {
    modsList = api.plugins.names;
  }

  const pingMs = slp?.pingMs || (api?.debug?.cachehit ? 'Cached response' : '~50-100');

  let joinDiagnostic = null;
  const motdText = motdLines.join(' ').toLowerCase();

  if (loginProbe?.status === 'TIMEOUT') {
    joinDiagnostic = 'Server hangs on login packet (likely offline backend lobby server or active bot filter).';
  } else if (loginProbe?.status === 'KICKED') {
    joinDiagnostic = `Server rejected connection with message: "${loginProbe.kickReason}"`;
  } else if (motdText.includes('the end') || motdText.includes('maintenance') || (onlinePlayers === 0 && maxPlayers <= 30 && motdText.includes('end'))) {
    joinDiagnostic = 'Notice: Server appears closed or ended (MOTD indicates THE END or maintenance).';
  }

  return {
    status: 'ONLINE',
    isOnline: true,
    edition: 'Minecraft Java Edition',
    source,
    inputAddress: input,
    network: {
      hostInput: host,
      targetHost,
      ipAddress: dnsInfo.ipAddress || api?.ip || 'Unresolved',
      port: targetPort,
      srvRecord: dnsInfo.srvRecord 
        ? `_minecraft._tcp.${host} -> ${dnsInfo.srvRecord.name}:${dnsInfo.srvRecord.port} (Priority: ${dnsInfo.srvRecord.priority})`
        : 'None (direct connection or default port)',
      dnsTimeMs: dnsInfo.dnsTimeMs
    },
    version: {
      name: versionName,
      protocol: protocolNumber,
      software: software
    },
    performance: {
      pingMs: typeof pingMs === 'number' ? `${pingMs} ms` : pingMs,
      tps: 'Hidden (server protocol does not expose TPS to players for security)'
    },
    players: {
      online: onlinePlayers,
      max: maxPlayers,
      percentage: `${percentage}%`,
      sample: samplePlayers
    },
    motd: {
      lines: motdLines.length ? motdLines : ['[No MOTD description]']
    },
    joinProbe: {
      authType: loginProbe?.authType || 'Unknown Premium/Non-Premium requirement',
      status: loginProbe?.status || 'UNKNOWN',
      kickReason: loginProbe?.kickReason || null,
      diagnostic: joinDiagnostic
    },
    advanced: {
      hasFavicon: slp?.hasFavicon || !!api?.icon,
      enforcesSecureChat: slp?.enforcesSecureChat === true ? 'Enforced (Secure chat active)' : (slp?.enforcesSecureChat === false ? 'Disabled / Not enforced' : 'Unknown'),
      previewsChat: slp?.previewsChat === true ? 'Enabled' : (slp?.previewsChat === false ? 'Disabled' : 'Unknown'),
      mods: modsList,
      eulaBlocked: api?.eula_blocked === true ? 'YES (Blocked by Mojang EULA)' : 'NO (Compliant)'
    }
  };
}

function assembleBedrockReport({ input, host, targetPort, dnsInfo, raknet, api, source }) {
  let motdLines = [];
  if (raknet) {
    if (raknet.motdLine1) motdLines.push(cleanMinecraftFormatting(raknet.motdLine1).trim());
    if (raknet.motdLine2) motdLines.push(cleanMinecraftFormatting(raknet.motdLine2).trim());
  } else if (api?.motd?.clean) {
    motdLines = Array.isArray(api.motd.clean) ? api.motd.clean.map(l => l.trim()).filter(Boolean) : [api.motd.clean];
  }

  const onlinePlayers = raknet ? raknet.playersOnline : (api?.players?.online ?? 0);
  const maxPlayers = raknet ? raknet.playersMax : (api?.players?.max ?? 0);
  const percentage = maxPlayers > 0 ? ((onlinePlayers / maxPlayers) * 100).toFixed(1) : '0.0';

  const versionName = cleanMinecraftFormatting(raknet?.versionName || api?.version || 'Bedrock').trim();
  const protocolNumber = raknet?.protocolVersion ?? api?.protocol?.version ?? 'Unknown';
  const gamemode = raknet?.gameMode || api?.gamemode || 'Survival / Unknown';
  const pingMs = raknet?.pingMs ? `${raknet.pingMs} ms` : '~60 ms';

  return {
    status: 'ONLINE',
    isOnline: true,
    edition: 'Minecraft Bedrock Edition (Pocket / Geyser)',
    source,
    inputAddress: input,
    network: {
      hostInput: host,
      targetHost: dnsInfo.targetHost,
      ipAddress: dnsInfo.ipAddress || api?.ip || 'Unresolved',
      port: targetPort,
      srvRecord: 'None (Bedrock uses direct UDP)',
      dnsTimeMs: dnsInfo.dnsTimeMs
    },
    version: {
      name: versionName,
      protocol: protocolNumber,
      software: 'Bedrock Dedicated Server / GeyserMC / PocketMine'
    },
    performance: {
      pingMs,
      tps: 'Hidden (server protocol does not expose TPS to players for security)'
    },
    players: {
      online: onlinePlayers,
      max: maxPlayers,
      percentage: `${percentage}%`,
      sample: []
    },
    motd: {
      lines: motdLines.length ? motdLines : ['[No MOTD description]']
    },
    joinProbe: {
      authType: 'Bedrock Xbox Live / Microsoft Account',
      status: 'BEDROCK',
      diagnostic: null
    },
    advanced: {
      gamemode,
      serverId: raknet?.serverId || 'Unknown',
      portIPv4: raknet?.portIPv4 || targetPort,
      portIPv6: raknet?.portIPv6 || 'Not specified',
      eulaBlocked: 'Unknown'
    }
  };
}

function assembleOfflineReport({ input, host, targetHost, targetPort, dnsInfo, edition = 'Minecraft Java / Bedrock', reason }) {
  return {
    status: 'OFFLINE',
    isOnline: false,
    edition,
    inputAddress: input,
    network: {
      hostInput: host,
      targetHost: targetHost || host,
      ipAddress: dnsInfo?.ipAddress || 'Unable to resolve IP address',
      port: targetPort,
      srvRecord: dnsInfo?.srvRecord 
        ? `_minecraft._tcp.${host} -> ${dnsInfo.srvRecord.name}:${dnsInfo.srvRecord.port}`
        : 'No SRV record',
      dnsTimeMs: dnsInfo?.dnsTimeMs || 0
    },
    errorReason: reason || 'Server did not respond (offline, wrong address, or blocking connections)'
  };
}

module.exports = {
  inspectMinecraftServer,
  parseAddress
};
