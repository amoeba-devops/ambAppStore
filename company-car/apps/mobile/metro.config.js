const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch entire monorepo so changes in packages/* hot-reload
config.watchFolders = [monorepoRoot];

// Resolve modules from project + monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Avoid duplicate React when imported from packages/*
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
