import {requireUseClient} from './rules/require-use-client.js';

const configs: Record<string, unknown> = {};

const plugin = {
  meta: {
    name: 'eslint-plugin-use-client',
    version: '0.0.1',
  },
  rules: {
    'require-use-client': requireUseClient,
  },
  configs,
};

// Flat-config preset. Referenced after `plugin` is defined so it can point back
// at the plugin object.
plugin.configs.recommended = {
  plugins: {'use-client': plugin},
  rules: {
    'use-client/require-use-client': 'error',
  },
};

export default plugin;
