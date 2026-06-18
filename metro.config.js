const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow bundling .db files as assets
config.resolver.assetExts.push('db');

module.exports = config;
