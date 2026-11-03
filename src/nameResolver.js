const dns = require('dns').promises;

const KNOWN_SERVERS = {
  'hypixel': 'mc.hypixel.net',
  'hypixel network': 'mc.hypixel.net',
  'cubecraft': 'play.cubecraft.net',
  'cubecraft games': 'play.cubecraft.net',
  '2b2t': '2b2t.org',
  'wynncraft': 'play.wynncraft.com',
  'hive': 'geo.hivebedrock.network:19132',
  'the hive': 'geo.hivebedrock.network:19132',
  'hive bedrock': 'geo.hivebedrock.network:19132',
  'manacube': 'play.manacube.com',
  'minemen': 'minemen.club',
  'minemenclub': 'minemen.club',
  'mmc': 'minemen.club',
  'pika': 'play.pika-network.net',
  'pika network': 'play.pika-network.net',
  'pikanetwork': 'play.pika-network.net',
  'jartex': 'top.jartex.fun',
  'jartex network': 'top.jartex.fun',
  'jartexnetwork': 'top.jartex.fun',
  'donut': 'donutsmp.net',
  'donutsmp': 'donutsmp.net',
  'donut smp': 'donutsmp.net',
  'pvp land': 'pvp.land',
  'pvpland': 'pvp.land',
  'invaded lands': 'invadedlands.net',
  'invadedlands': 'invadedlands.net',
  'gomme': 'gommehd.net',
  'gommehd': 'gommehd.net',
  'mineplex': 'mineplex.com',
  'complex': 'hub.complexgaming.net',
  'complex gaming': 'hub.complexgaming.net',
  'purple prison': 'purpleprison.net',
  'purpleprison': 'purpleprison.net',
  'anarchia': 'anarchia.gg',
  'anarchia gg': 'anarchia.gg',
  'crafted': 'crafted.pl',
  'crafted pl': 'crafted.pl',
  'mchc': 'mchc.pl',
  'lcs': 'lcs.gg',
  'earthmc': 'play.earthmc.net',
  'applecraft': 'play.applecraft.org',
  'lemoncloud': 'play.lemoncloud.org',
  'insanitycraft': 'play.insanitycraft.net',
  'bedwarspractice': 'bedwarspractice.club'
};

async function resolveServerInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { address: '', originalInput: rawInput, aliasNotice: null };
  }

  let str = rawInput
    .replace(/[\u200B-\u200D\uFEFF\u00A0\t\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const originalCleaned = str;

  str = str.replace(/^["'`*~_\[\(<]+|["'`*~_\]\)>]+$/g, '').trim();
  str = str.replace(/^(minecraft:\/\/|mc:\/\/|http:\/\/|https:\/\/)/i, '');
  str = str.replace(/^(ip|server|serwer|adres|address|host|connect|join)\s*[:=-]\s*/i, '').trim();

  const lower = str.toLowerCase();
  if (KNOWN_SERVERS[lower]) {
    const resolved = KNOWN_SERVERS[lower];
    return {
      address: resolved,
      originalInput: rawInput,
      aliasNotice: `Recognized server alias '${str}' -> mapped to ${resolved}`
    };
  }

  const domainOrIpMatch = str.match(/((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d{1,5})?|(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?|\[[0-9a-fA-F:]+\](?::\d{1,5})?)/);
  if (domainOrIpMatch) {
    const extracted = domainOrIpMatch[1];
    return {
      address: extracted,
      originalInput: rawInput,
      aliasNotice: (extracted !== originalCleaned) ? `Extracted address from input text -> ${extracted}` : null
    };
  }

  for (const [name, target] of Object.entries(KNOWN_SERVERS)) {
    const wordRegex = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (wordRegex.test(lower)) {
      return {
        address: target,
        originalInput: rawInput,
        aliasNotice: `Found '${name}' in text -> mapped to ${target}`
      };
    }
  }

  if (!str.includes('.') && !str.includes(':') && /^[a-zA-Z0-9-]+$/.test(str)) {
    const tlds = ['.net', '.com', '.org', '.pl', '.gg', '.eu'];
    for (const tld of tlds) {
      const candidate = `${str}${tld}`;
      try {
        await dns.lookup(candidate);
        return {
          address: candidate,
          originalInput: rawInput,
          aliasNotice: `Resolved domain '${candidate}' for name '${str}'`
        };
      } catch (e) {}
    }
  }

  return {
    address: str,
    originalInput: rawInput,
    aliasNotice: null
  };
}

module.exports = {
  resolveServerInput,
  KNOWN_SERVERS
};
