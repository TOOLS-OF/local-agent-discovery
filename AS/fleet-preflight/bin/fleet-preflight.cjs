#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { checkConfig } = require("../lib/check.cjs");
function usage(message) {
  if (message) console.error(message);
  console.error("Usage: fleet-preflight --config <config.json>");
  process.exit(2);
}
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--config") usage();
const configPath = path.resolve(args[1]);
if (!fs.existsSync(configPath)) usage("config does not exist");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
console.log(JSON.stringify(checkConfig(config, { baseDir: path.dirname(configPath) }), null, 2));
