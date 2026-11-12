"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { checkConfig } = require("../lib/check.cjs");
const fixture = (name) => path.join(__dirname, "fixtures", name);
const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");

test("emits MATCH, MISMATCH, MISSING, and UNKNOWN for synthetic files", () => {
  const result = checkConfig({commands:[
    {id:"match",components:[{id:"f",path:fixture("match.txt"),sha256:digest("alpha\n")}]},
    {id:"mismatch",components:[{id:"f",path:fixture("mismatch.txt"),sha256:digest("other\n")}]},
    {id:"missing",components:[{id:"f",path:fixture("missing.txt"),sha256:digest("x")}]},
    {id:"unknown",components:[{id:"f",path:fixture("match.txt")}]}
  ]});
  assert.deepEqual(result.commands.map(({id,status}) => [id,status]), [["match","MATCH"],["mismatch","MISMATCH"],["missing","MISSING"],["unknown","UNKNOWN"]]);
  assert.equal(result.commandExecuted, false); assert.equal(result.mutationPerformed, false);
});

test("returns UNKNOWN for Git provenance without invoking a child process", (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-preflight-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp,"target.js"), "module.exports = 1;\n");
  const component = {id:"target",path:"target.js",git:{repository:".",ref:"HEAD",repoPath:"target.js",revision:"synthetic",blob:"synthetic"}};
  const result = checkConfig({commands:[{id:"tool",components:[component]}]},{baseDir:temp});
  assert.equal(result.status,"UNKNOWN");
  assert.match(result.commands[0].components[0].reasons.join(" "), /child process/);
  assert.deepEqual(result.commands[0].components[0].observed.git, { inspected: false });
});

test("recognizes inventory-bound gitProvenance without silently dropping it", (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-preflight-legacy-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.writeFileSync(path.join(temp,"target.js"), "module.exports = 1;\n");
  const component = {id:"target",path:"target.js",sha256:digest("module.exports = 1;\n"),gitProvenance:{repository:".",ref:"origin/main",repoPath:"target.js",expectedBlob:"synthetic"}};
  const result = checkConfig({commands:[{id:"tool",components:[component]}]},{baseDir:temp});
  const observed = result.commands[0].components[0];
  assert.equal(result.status,"UNKNOWN");
  assert.equal(observed.expected.gitSchema,"gitProvenance");
  assert.equal(observed.expected.git.expectedBlob,"synthetic");
  assert.equal(observed.observed.sha256,digest("module.exports = 1;\n"));
  assert.match(observed.reasons.join(" "), /child process/);
});

test("empty command list is UNKNOWN and makes no freshness claim", () => {
  const result = checkConfig({commands:[]}); assert.equal(result.status,"UNKNOWN"); assert.equal(result.remoteFreshnessClaimed,false);
});
