#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_URL = "https://storyvault-mcp-q2uwnmd3yq-an.a.run.app/mcp";
const SERVER_NAME = "storyvault";
const LEGACY_SERVER_NAME = "vibe_control";
const TOKEN_ENV = "STORYVAULT_MCP_TOKEN";
const LEGACY_TOKEN_ENV = "VIBE_CONTROL_MCP_TOKEN";
const PACKAGE_NAME = "@enostech/storyvault-mcp-setup";

const usage = () => `
StoryVault MCP Setup

Usage:
  npx -y ${PACKAGE_NAME} --token <sv_mcp_...> --client codex
  npx -y ${PACKAGE_NAME} --token <sv_mcp_...> --client all

Options:
  --token <token>       Required. StoryVault MCP bearer token.
  --client <name>       codex, cursor, antigravity, claude, generic, or all. Default: codex.
  --url <url>           Remote MCP endpoint. Default: ${DEFAULT_URL}
  --dry-run             Show planned changes without writing files.
  --help                Show this help.
`;

const parseArgs = (argv) => {
  const args = {
    client: "codex",
    url: DEFAULT_URL,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--token") {
      args.token = argv[++index];
    } else if (arg.startsWith("--token=")) {
      args.token = arg.slice("--token=".length);
    } else if (arg === "--client") {
      args.client = argv[++index];
    } else if (arg.startsWith("--client=")) {
      args.client = arg.slice("--client=".length);
    } else if (arg === "--url") {
      args.url = argv[++index];
    } else if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
};

const expandHome = (path) => path.replace(/^~(?=$|\/)/, homedir());

const ensureParentDir = (path) => {
  mkdirSync(dirname(path), { recursive: true });
};

const backupFile = (path, dryRun) => {
  if (!existsSync(path)) return null;
  const backupPath = `${path}.storyvault-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  if (!dryRun) {
    copyFileSync(path, backupPath);
  }
  return backupPath;
};

const readJsonFile = (path) => {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8").trim();
  if (!content) return {};
  return JSON.parse(content);
};

const writeJsonFile = (path, value, dryRun) => {
  ensureParentDir(path);
  const backupPath = backupFile(path, dryRun);
  if (!dryRun) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  return backupPath;
};

const upsertMcpServer = (path, serverConfig, dryRun) => {
  const config = readJsonFile(path);
  if (config.mcpServers && Object.prototype.hasOwnProperty.call(config.mcpServers, LEGACY_SERVER_NAME)) {
    delete config.mcpServers[LEGACY_SERVER_NAME];
  }
  config.mcpServers = {
    ...(config.mcpServers || {}),
    [SERVER_NAME]: serverConfig,
  };
  return writeJsonFile(path, config, dryRun);
};

const run = (command, args, dryRun) => {
  if (dryRun) return;
  execFileSync(command, args, { stdio: "pipe" });
};

const setLaunchctlEnv = (token, dryRun) => {
  if (process.platform !== "darwin") return;
  run("launchctl", ["setenv", TOKEN_ENV, token], dryRun);
  run("launchctl", ["setenv", LEGACY_TOKEN_ENV, token], dryRun);
};

const upsertShellEnv = (token, dryRun) => {
  const zshrcPath = join(homedir(), ".zshrc");
  const markerStart = "# StoryVault MCP";
  const markerLine = `${markerStart}\nexport ${TOKEN_ENV}='${token.replace(/'/g, "'\\''")}'`;
  const current = existsSync(zshrcPath) ? readFileSync(zshrcPath, "utf8") : "";
  const stripped = current
    .replace(/\n?# StoryVault MCP\nexport (?:STORYVAULT_MCP_TOKEN|VIBE_CONTROL_MCP_TOKEN)='[^']*'\n(?:export VIBE_CONTROL_MCP_TOKEN="\$STORYVAULT_MCP_TOKEN"\n)?/g, "\n")
    .trimEnd();
  const next = `${stripped}\n\n${markerLine}\nexport ${LEGACY_TOKEN_ENV}="$${TOKEN_ENV}"\n`;
  if (!dryRun) {
    writeFileSync(zshrcPath, next, "utf8");
  }
};

const setupCodex = ({ token, url, dryRun }) => {
  upsertShellEnv(token, dryRun);
  setLaunchctlEnv(token, dryRun);
  const codex = spawnSync("codex", ["--version"], { stdio: "ignore" });
  if (codex.status !== 0) {
    return {
      name: "Codex",
      status: "skipped",
      message: "codex command was not found. Install Codex CLI, then rerun this setup.",
    };
  }
  if (!dryRun) {
    spawnSync("codex", ["mcp", "remove", SERVER_NAME], { stdio: "ignore" });
    spawnSync("codex", ["mcp", "remove", LEGACY_SERVER_NAME], { stdio: "ignore" });
  }
  run("codex", ["mcp", "add", SERVER_NAME, "--url", url, "--bearer-token-env-var", TOKEN_ENV], dryRun);
  return {
    name: "Codex",
    status: dryRun ? "planned" : "configured",
    message: `Registered ${SERVER_NAME} in Codex MCP settings.`,
  };
};

const setupCursor = ({ token, url, dryRun }) => {
  const path = join(homedir(), ".cursor", "mcp.json");
  const backupPath = upsertMcpServer(
    path,
    {
      url,
      headers: { Authorization: `Bearer ${token}` },
    },
    dryRun
  );
  return {
    name: "Cursor",
    status: dryRun ? "planned" : "configured",
    path,
    backupPath,
    message: `Updated ${path}.`,
  };
};

const setupAntigravity = ({ token, url, dryRun }) => {
  const path = join(homedir(), ".gemini", "antigravity", "mcp_config.json");
  const backupPath = upsertMcpServer(
    path,
    {
      serverUrl: url,
      headers: { Authorization: `Bearer ${token}` },
    },
    dryRun
  );
  return {
    name: "Antigravity",
    status: dryRun ? "planned" : "configured",
    path,
    backupPath,
    message: `Updated ${path}.`,
  };
};

const setupClaude = ({ token, url, dryRun }) => {
  const path =
    process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  const backupPath = upsertMcpServer(
    path,
    {
      command: "npx",
      args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${token}`],
    },
    dryRun
  );
  return {
    name: "Claude Desktop",
    status: dryRun ? "planned" : "configured",
    path,
    backupPath,
    message: `Updated ${path}.`,
  };
};

const setupGeneric = ({ token, url }) => ({
  name: "Generic HTTP MCP",
  status: "manual",
  message: `Use endpoint ${url} with Authorization: Bearer ${token}`,
});

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      return;
    }
    if (!args.token || (!args.token.startsWith("sv_mcp_") && !args.token.startsWith("vc_mcp_"))) {
      throw new Error("A valid --token value starting with sv_mcp_ is required.");
    }

    const installers = {
      codex: setupCodex,
      cursor: setupCursor,
      antigravity: setupAntigravity,
      claude: setupClaude,
      generic: setupGeneric,
    };
    const clients =
      args.client === "all"
        ? ["codex", "cursor", "antigravity", "claude"]
        : args.client.split(",").map((client) => client.trim()).filter(Boolean);

    const results = clients.map((client) => {
      const installer = installers[client];
      if (!installer) {
        throw new Error(`Unsupported client: ${client}`);
      }
      return installer({ token: args.token, url: args.url, dryRun: args.dryRun });
    });

    process.stdout.write("\nStoryVault MCP setup results\n");
    for (const result of results) {
      process.stdout.write(`- ${result.name}: ${result.status} - ${result.message}\n`);
      if (result.backupPath) {
        process.stdout.write(`  backup: ${result.backupPath}\n`);
      }
    }
    process.stdout.write("\nRestart the configured AI coding tool, then ask it to list storyvault MCP tools.\n");
  } catch (error) {
    process.stderr.write(`StoryVault MCP setup failed: ${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  }
};

main();
