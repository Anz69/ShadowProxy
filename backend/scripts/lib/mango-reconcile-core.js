const fs = require("fs");
const path = require("path");

const ONE_MB = 1024n * 1024n;
const MAX_SAFE_MB = BigInt(Number.MAX_SAFE_INTEGER);

function bytesToMb(value) {
  const bytes = BigInt(value || "0");
  if (bytes < 0n) throw new Error("Баланс трафика не может быть отрицательным");
  const mb = (bytes + ONE_MB - 1n) / ONE_MB;
  if (mb > MAX_SAFE_MB) throw new Error("Баланс трафика превышает безопасный диапазон Mango API");
  return Number(mb);
}

function parseUsername(value, source = "username") {
  const username = String(value || "").trim();
  if (!username) throw new Error(`${source}: пустой username`);
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    throw new Error(`${source}: недопустимый Mango username`);
  }
  return username;
}

function usernameFromPremium(value, source) {
  const [username] = String(value || "").split(":");
  return parseUsername(username, source);
}

function readUsernameManifest(filename) {
  const resolved = path.resolve(filename);
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
  const usernames = new Set();
  lines.forEach((line, index) => {
    const value = line.trim();
    if (!value || value.startsWith("#")) return;
    const username = parseUsername(value, `${resolved}:${index + 1}`);
    if (usernames.has(username)) throw new Error(`${resolved}:${index + 1}: повтор username ${username}`);
    usernames.add(username);
  });
  if (usernames.size === 0) throw new Error(`${resolved}: manifest пуст`);
  return { resolved, usernames };
}

function buildTargets(users, manifestUsernames = null) {
  const targets = new Map();
  for (const user of users) {
    const username = usernameFromPremium(user.premiumUsername, `user ${user.id}`);
    const targetMb = bytesToMb(user.premiumTrafficLeft);
    const existing = targets.get(username);
    if (existing && (existing.userId !== user.id || existing.targetMb !== targetMb)) {
      throw new Error(`Mango username ${username} привязан к нескольким пользователям`);
    }
    targets.set(username, { username, userId: user.id, targetMb, source: "database" });
  }

  if (manifestUsernames) {
    for (const username of targets.keys()) {
      if (!manifestUsernames.has(username)) {
        throw new Error(`Полный Mango manifest не содержит аккаунт из БД: ${username}`);
      }
    }
    for (const username of manifestUsernames) {
      if (!targets.has(username)) {
        targets.set(username, { username, userId: null, targetMb: 0, source: "manifest" });
      }
    }
  }
  return targets;
}

function writePrivateJson(filename, payload) {
  const resolved = path.resolve(filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const temporary = `${resolved}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, resolved);
  try { fs.chmodSync(resolved, 0o600); } catch (_) {}
  return resolved;
}

module.exports = {
  buildTargets,
  bytesToMb,
  parseUsername,
  readUsernameManifest,
  usernameFromPremium,
  writePrivateJson,
};
