const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildTargets,
  bytesToMb,
  readUsernameManifest,
  writePrivateJson,
} = require("./mango-reconcile-core");

test("bytesToMb rounds up without unsafe Number conversion", () => {
  assert.equal(bytesToMb("0"), 0);
  assert.equal(bytesToMb("1"), 1);
  assert.equal(bytesToMb(String(1024 * 1024)), 1);
  assert.equal(bytesToMb(String(1024 * 1024 + 1)), 2);
  assert.throws(() => bytesToMb("-1"), /не может быть отрицательным/);
});

test("complete manifest must contain every database Mango account", () => {
  const users = [{ id: "u1", premiumUsername: "mango-one:account:password", premiumTrafficLeft: "1048576" }];
  assert.throws(() => buildTargets(users, new Set(["another-account"])), /не содержит аккаунт из БД/);
  const targets = buildTargets(users, new Set(["mango-one", "external-user"]));
  assert.equal(targets.get("mango-one").targetMb, 1);
  assert.equal(targets.get("external-user").targetMb, 0);
});

test("duplicate Mango ownership is rejected", () => {
  const users = [
    { id: "u1", premiumUsername: "same:a:p", premiumTrafficLeft: "0" },
    { id: "u2", premiumUsername: "same:b:p", premiumTrafficLeft: "0" },
  ];
  assert.throws(() => buildTargets(users), /привязан к нескольким пользователям/);
});

test("manifest parser rejects duplicates and report is private", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mango-reconcile-"));
  const manifest = path.join(dir, "manifest.txt");
  fs.writeFileSync(manifest, "# all users\nfirst\nsecond\n");
  assert.deepEqual([...readUsernameManifest(manifest).usernames], ["first", "second"]);
  fs.writeFileSync(manifest, "first\nfirst\n");
  assert.throws(() => readUsernameManifest(manifest), /повтор username/);

  const report = path.join(dir, "reports", "result.json");
  writePrivateJson(report, { ok: true });
  assert.equal(fs.statSync(report).mode & 0o777, 0o600);
});
