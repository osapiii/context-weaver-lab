#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const args = process.argv.slice(2);

const readArg = (name, fallback = "") => {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1).trim();
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1].trim();
  return fallback;
};

const hasFlag = (name) => args.includes(name);

const showHelp = hasFlag("--help") || hasFlag("-h");
const startUrl = readArg("--url");
const outPath = resolve(
  readArg("--out", "./.screen-atlas/session-storage-state.json")
);
const shouldCopy = !hasFlag("--no-copy");

if (showHelp || !startUrl) {
  const usage =
    [
      "Usage:",
      "  yarn screen-atlas:capture-session --url https://example.com/app",
      "",
      "Options:",
      "  --out ./path/storage-state.json",
      "  --no-copy",
    ].join("\n");
  if (showHelp) {
    console.log(usage);
    process.exit(0);
  }
  console.error(usage);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });

const rl = readline.createInterface({ input, output });
const browser = await chromium.launch({
  headless: false,
  args: ["--start-maximized"],
});
const context = await browser.newContext({
  viewport: null,
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

console.log(`Opening ${startUrl}`);
await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("");
console.log("Login in the opened browser window.");
console.log("After the target application is fully signed in, return here and press Enter.");
await rl.question("");

await context.storageState({ path: outPath });
await browser.close();
rl.close();

const json = readFileSync(outPath, "utf8");
console.log(`Saved Playwright storageState: ${outPath}`);

if (shouldCopy && process.platform === "darwin") {
  const result = spawnSync("pbcopy", { input: json });
  if (result.status === 0) {
    console.log("Copied storageState JSON to clipboard.");
  }
}
