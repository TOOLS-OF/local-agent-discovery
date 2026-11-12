"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ORDER = { MATCH: 0, UNKNOWN: 1, MISMATCH: 2, MISSING: 3 };
function aggregate(items) {
  return items.reduce((state, item) => ORDER[item.status] > ORDER[state] ? item.status : state, "MATCH");
}
function resolveFrom(base, candidate) {
  return path.isAbsolute(candidate) ? path.normalize(candidate) : path.resolve(base, candidate);
}
function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function checkComponent(component, base) {
  const file = resolveFrom(base, component.path);
  const output = { id: component.id, configuredPath: component.path, resolvedPath: file, status: "MATCH", reasons: [], expected: {}, observed: {} };
  if (!fs.existsSync(file)) return { ...output, status: "MISSING", reasons: ["configured file does not exist"] };
  if (!fs.statSync(file).isFile()) return { ...output, status: "MISMATCH", reasons: ["configured path is not a regular file"] };
  const checks = [];
  if (component.sha256) {
    const observed = sha256(file); output.expected.sha256 = component.sha256; output.observed.sha256 = observed;
    checks.push({ status: observed === component.sha256 ? "MATCH" : "MISMATCH", reason: observed === component.sha256 ? "SHA-256 matches" : "SHA-256 drift" });
  }
  const gitProvenance = component.git || component.gitProvenance;
  if (gitProvenance) {
    const repository = resolveFrom(base, gitProvenance.repository);
    output.expected.git = gitProvenance;
    output.expected.gitSchema = component.git ? "git" : "gitProvenance";
    if (!fs.existsSync(repository)) checks.push({ status: "UNKNOWN", reason: "Git repository is unavailable" });
    else {
      output.observed.git = { inspected: false };
      checks.push({ status: "UNKNOWN", reason: "Git provenance inspection is disabled in offline mode because it would require a child process" });
    }
  }
  if (!checks.length) checks.push({ status: "UNKNOWN", reason: "no digest or provenance expectation configured" });
  output.status = aggregate(checks); output.reasons = checks.map((item) => item.reason); return output;
}
function checkConfig(config, options = {}) {
  const base = options.baseDir || process.cwd();
  const commands = (config.commands || []).map((command) => {
    const components = (command.components || []).map((component) => checkComponent(component, base));
    return { id: command.id, status: components.length ? aggregate(components) : "UNKNOWN", components };
  });
  return {
    schemaVersion: "tools-of.fleet-preflight.result.v1",
    remoteFreshnessClaimed: false,
    commandExecuted: false,
    mutationPerformed: false,
    commands,
    status: commands.length ? aggregate(commands) : "UNKNOWN"
  };
}
module.exports = { aggregate, checkComponent, checkConfig };
