function padLabel(label, width = 26) {
  return label.padEnd(width, ' ');
}

function formatReport(data) {
  const lineSeparator = '='.repeat(80);
  const out = [];

  out.push(lineSeparator);
  out.push(` MINECRAFT SERVER REPORT: ${data.inputAddress}`);
  if (data.aliasNotice) {
    out.push(` [INFO]: ${data.aliasNotice}`);
  }
  out.push(lineSeparator);

  if (data.isOnline) {
    out.push('\n[1. STATUS AND BASIC INFO]');
    out.push(`  ${padLabel('Server Status')}: ONLINE`);
    out.push(`  ${padLabel('Game Edition')}: ${data.edition}`);
    out.push(`  ${padLabel('Response Time (Ping)')}: ${data.performance.pingMs}`);
    out.push(`  ${padLabel('Verification Source')}: ${data.source === 'DIRECT_SOCKET' ? 'Direct socket connection (native protocol)' : 'Public Minecraft API fallback'}`);

    out.push('\n[2. NETWORK CONNECTION]');
    out.push(`  ${padLabel('Input Text')}: ${data.originalInput || data.network.hostInput}`);
    out.push(`  ${padLabel('Resolved Address')}: ${data.network.hostInput}`);
    out.push(`  ${padLabel('Target Host')}: ${data.network.targetHost}`);
    out.push(`  ${padLabel('IP Address')}: ${data.network.ipAddress}`);
    out.push(`  ${padLabel('Target Port')}: ${data.network.port}`);
    out.push(`  ${padLabel('DNS SRV Record')}: ${data.network.srvRecord}`);
    out.push(`  ${padLabel('DNS Lookup Time')}: ${data.network.dnsTimeMs} ms`);

    out.push('\n[3. VERSION AND SOFTWARE]');
    out.push(`  ${padLabel('Game Version')}: ${data.version.name}`);
    out.push(`  ${padLabel('Protocol Version')}: ${data.version.protocol}`);
    out.push(`  ${padLabel('Server Software')}: ${data.version.software || 'Vanilla / Bukkit'}`);

    if (data.joinProbe) {
      out.push('\n[4. JOINABILITY AND AUTHENTICATION]');
      out.push(`  ${padLabel('Account Requirement')}: ${data.joinProbe.authType}`);
      if (data.joinProbe.diagnostic) {
        out.push(`  ${padLabel('Join Diagnostic')}: ${data.joinProbe.diagnostic}`);
      }
      if (data.joinProbe.kickReason) {
        out.push(`  ${padLabel('Server Message')}: "${data.joinProbe.kickReason}"`);
      }
    }

    out.push('\n[5. PLAYERS]');
    const onlineFormatted = Number(data.players.online).toLocaleString('en-US');
    const maxFormatted = Number(data.players.max).toLocaleString('en-US');
    out.push(`  ${padLabel('Online Players')}: ${onlineFormatted} / ${maxFormatted} (${data.players.percentage})`);
    
    if (data.players.sample && data.players.sample.length > 0) {
      out.push(`  ${padLabel('Player Sample')}: ${data.players.sample.slice(0, 15).join(', ')}${data.players.sample.length > 15 ? '...' : ''}`);
    } else {
      out.push(`  ${padLabel('Player Sample')}: [no public player sample available]`);
    }

    out.push('\n[6. SERVER DESCRIPTION (MOTD)]');
    for (const motdLine of data.motd.lines) {
      out.push(`  > ${motdLine}`);
    }

    out.push('\n[7. ADVANCED DETAILS AND STABILITY]');
    out.push(`  ${padLabel('TPS (Ticks Per Second)')}: ${data.performance.tps}`);
    if (data.advanced.gamemode) {
      out.push(`  ${padLabel('Game Mode')}: ${data.advanced.gamemode}`);
    }
    if (data.advanced.hasFavicon !== undefined) {
      out.push(`  ${padLabel('Server Favicon')}: ${data.advanced.hasFavicon ? 'Available (64x64 PNG sent by server)' : 'None'}`);
    }
    if (data.advanced.enforcesSecureChat !== undefined) {
      out.push(`  ${padLabel('Secure Chat Enforcement')}: ${data.advanced.enforcesSecureChat}`);
    }
    if (data.advanced.previewsChat !== undefined) {
      out.push(`  ${padLabel('Chat Preview')}: ${data.advanced.previewsChat}`);
    }
    if (data.advanced.mods && data.advanced.mods.length > 0) {
      out.push(`  ${padLabel('Mods / Plugins')}: ${data.advanced.mods.slice(0, 10).join(', ')}${data.advanced.mods.length > 10 ? ' (more...)' : ''}`);
    } else {
      out.push(`  ${padLabel('Mods / Plugins')}: None detected (Standard Vanilla / Bukkit server)`);
    }
    if (data.advanced.eulaBlocked !== undefined) {
      out.push(`  ${padLabel('Mojang EULA Status')}: ${data.advanced.eulaBlocked}`);
    }

  } else {
    out.push('\n[1. STATUS AND BASIC INFO]');
    out.push(`  ${padLabel('Server Status')}: OFFLINE`);
    out.push(`  ${padLabel('Game Edition')}: ${data.edition}`);
    out.push(`  ${padLabel('Failure Reason')}: ${data.errorReason}`);

    out.push('\n[2. NETWORK CONNECTION]');
    out.push(`  ${padLabel('Input Text')}: ${data.originalInput || data.network.hostInput}`);
    out.push(`  ${padLabel('Resolved Address')}: ${data.network.hostInput}`);
    out.push(`  ${padLabel('Target Host')}: ${data.network.targetHost}`);
    out.push(`  ${padLabel('IP Address')}: ${data.network.ipAddress}`);
    out.push(`  ${padLabel('Target Port')}: ${data.network.port}`);
    out.push(`  ${padLabel('DNS SRV Record')}: ${data.network.srvRecord}`);
    out.push(`  ${padLabel('DNS Lookup Time')}: ${data.network.dnsTimeMs} ms`);

    out.push('\n[3. TROUBLESHOOTING TIPS]');
    out.push('  Check if the address was entered or pasted correctly.');
    out.push('  You can paste server names (hypixel, 2b2t, the hive) or full IPs with ports.');
    out.push('  Check if the server requires a non standard port (e.g. server.com:25570).');
    out.push('  The server might currently be undergoing maintenance or a restart.');
  }

  out.push('\n' + lineSeparator);
  return out.join('\n');
}

module.exports = {
  formatReport
};
