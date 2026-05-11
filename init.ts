import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import https from "node:https";
import { spawn } from "node:child_process";

const UCI_DEFAULTS_PATH = "files/etc/uci-defaults/99-custom-settings";

const CORE_URL_DEFAULT =
  "https://github.com/vernesong/OpenClash/raw/refs/heads/core/master/meta/clash-linux-amd64-v1.tar.gz";
const CORE_URL_ARM64 =
  "https://github.com/vernesong/OpenClash/raw/refs/heads/core/master/meta/clash-linux-arm64.tar.gz";

function usage() {
  console.log(`Usage: node init.ts [--arm64]

Options:
  --arm64   Download OpenClash core from the arm64 meta URL (instead of default URL)
  -h,--help Show this help`);
}

async function writeUciDefaults() {
  console.log(`Writing UCI defaults to ${UCI_DEFAULTS_PATH}`);
  const content = `#!/bin/sh

# 修改 LAN 口为 DHCP 协议
uci set network.lan.proto='dhcp'
# 移除之前可能存在的静态 IP 设置（可选）
uci delete network.lan.ipaddr
uci delete network.lan.netmask
uci delete network.lan.ip6assign

# 关闭 LAN 口的 DHCP 服务 (DHCP Server)
# 如果 dhcp.lan 不存在，uci 会报错，所以先尝试设置
uci set dhcp.lan.ignore='1'

# 禁用 LAN 口的路由通告服务
uci set dhcp.lan.ra='disabled'
# 禁用 LAN 口的 DHCPv6 服务
uci set dhcp.lan.dhcpv6='disabled'
# 禁用 LAN 口的 NDP 代理 (Neighbor Discovery Protocol)
uci set dhcp.lan.ndp='disabled'
# 禁用主接口的主动探测
uci set dhcp.lan.ra_management='0'

# 移除全局 IPv6 唯一本地地址 (ULA) 前缀
uci delete network.globals.ula_prefix
# 禁用 LAN 口的 IPv6 分配前缀长度
uci delete network.lan.ip6assign

# 提交修改
uci commit network
uci commit dhcp
`;

  await fs.mkdir(path.dirname(UCI_DEFAULTS_PATH), { recursive: true });
  await fs.writeFile(UCI_DEFAULTS_PATH, content);
  await fs.chmod(UCI_DEFAULTS_PATH, 0o755);
  console.log("UCI defaults script written.");
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}`);
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        console.log(`Redirected to ${response.headers.location}`);
        response.resume();
        downloadFile(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      console.log(`Saving to ${destination}`);
      const fileStream = createWriteStream(destination);
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close(() => resolve());
      });
      fileStream.on("error", (err) => {
        fs.unlink(destination).catch(() => undefined).finally(() => reject(err));
      });
    });

    request.on("error", (err) => {
      fs.unlink(destination).catch(() => undefined).finally(() => reject(err));
    });
  });
}

function runCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function findFile(
  root: string,
  targetName: string,
  depth: number,
  maxDepth: number
): Promise<string | undefined> {
  if (depth > maxDepth) {
    return undefined;
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name === targetName) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = await findFile(fullPath, targetName, depth + 1, maxDepth);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

async function installOpenClashCore(coreUrl: string) {
  const coreDir = "files/etc/openclash/core";
  const coreTarName = path.basename(new URL(coreUrl).pathname);
  const coreTmpTar = path.join("/tmp", coreTarName);
  const coreTmpDir = "/tmp/openclash_core";

  console.log(`Preparing OpenClash core in ${coreDir}`);
  await fs.rm(coreTmpDir, { recursive: true, force: true });
  await fs.mkdir(coreDir, { recursive: true });
  await fs.mkdir(coreTmpDir, { recursive: true });

  try {
    await downloadFile(coreUrl, coreTmpTar);
  } catch (error) {
    console.error(`Failed to download OpenClash core: ${(error as Error).message}`);
    return;
  }

  console.log(`Extracting ${coreTmpTar}`);
  const tarOk = await runCommand("tar", ["-xzf", coreTmpTar, "-C", coreTmpDir]);
  if (!tarOk) {
    console.error("Failed to extract OpenClash core archive.");
    return;
  }

  console.log("Searching for clash binary...");
  const clashBin = await findFile(coreTmpDir, "clash", 0, 3);
  if (!clashBin) {
    console.error("Failed to find clash binary after extraction.");
    return;
  }

  const targetPath = path.join(coreDir, "clash_meta");
  console.log(`Installing clash binary to ${targetPath}`);
  await fs.rename(clashBin, targetPath);
  await fs.chmod(targetPath, 0o777);
  console.log("OpenClash core installed.");
}

async function main() {
  let coreUrl = CORE_URL_DEFAULT;
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === "--arm64") {
      coreUrl = CORE_URL_ARM64;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      return;
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  console.log(`Using core URL: ${coreUrl}`);
  await writeUciDefaults();
  await installOpenClashCore(coreUrl);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
