const readline = require('readline');
const { inspectMinecraftServer } = require('./pinger');
const { formatReport } = require('./formatReport');

async function runCheck(address) {
  console.log(`\nConnecting to server: ${address}...`);
  try {
    const reportData = await inspectMinecraftServer(address);
    const output = formatReport(reportData);
    console.log(output);
  } catch (err) {
    console.log(`\nError: ${err.message}\n`);
  }
}

function showHelp() {
  console.log(`
================================================================================
 MINECRAFT SERVER TESTER CLI
================================================================================
Usage:
  test <address_or_name>         Check server directly (e.g. test hypixel)
  test                           Run interactive mode prompting for server
  test --help                    Show this help message

Supported inputs:
  Common server names (hypixel, cubecraft, 2b2t, the hive, wynncraft)
  Direct IP addresses or domains (hypixel.net, 127.0.0.1:25565)
  Pasted text from chats or websites ("IP: mc.hypixel.net", "Server: 2b2t")
  Addresses with quotes or web links ("play.cubecraft.net", https://hypixel.net)

Features:
  Minecraft Java Edition (version 1.0 up to latest 1.21+)
  Minecraft Bedrock Edition (Pocket Edition / Geyser)
  Automatic DNS SRV record discovery
  Precise response time (Ping ms) and online/offline status
  Players online, slots, version, server software, and MOTD
  Account requirements check (Premium vs Non-Premium)
  Plain clean terminal output without colored codes
================================================================================
`);
}

async function startInteractive() {
  console.log(`
================================================================================
 MINECRAFT SERVER TESTER (Interactive Mode)
 Type or paste server address or name.
 Type 'q' or 'exit' to quit.
================================================================================
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: !!process.stdin.isTTY
  });

  let isClosed = false;
  rl.on('close', () => {
    isClosed = true;
  });

  const promptUser = (query) => new Promise((resolve) => {
    if (isClosed) return resolve(null);
    try {
      rl.question(query, (ans) => {
        resolve(ans);
      });
    } catch (e) {
      resolve(null);
    }
  });

  try {
    while (!isClosed) {
      const answer = await promptUser('Enter or paste Minecraft server address: ');
      if (answer === null || isClosed) {
        break;
      }
      const trimmed = (answer || '').trim();

      if (!trimmed) {
        continue;
      }

      if (['q', 'quit', 'exit', 'stop'].includes(trimmed.toLowerCase())) {
        console.log('\nExiting server tester.\n');
        break;
      }

      await runCheck(trimmed);
    }
  } finally {
    if (!isClosed) {
      rl.close();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await startInteractive();
    return;
  }

  const firstArg = args[0];
  if (['-h', '--help', '/?', '-help'].includes(firstArg.toLowerCase())) {
    showHelp();
    return;
  }

  const fullInput = args.join(' ');
  await runCheck(fullInput);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main };
