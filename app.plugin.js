const {
  createRunOncePlugin,
  withEntitlementsPlist,
} = require("expo/config-plugins");
const pkg = require("./package.json");

const ASSOCIATED_DOMAINS = "com.apple.developer.associated-domains";

const toWebCredentials = (domain) =>
  domain.startsWith("webcredentials:") ? domain : `webcredentials:${domain}`;

/**
 * Config plugin for @pj21/expo-credential-manager.
 *
 * iOS only reveals a saved password to an app whose Associated Domains
 * entitlement claims the site it was saved on. This merges the
 * `webcredentials:` entries in without disturbing `applinks:` ones that
 * `ios.associatedDomains` or another plugin already added.
 *
 * ```js
 * plugins: [
 *   ["@pj21/expo-credential-manager", { associatedDomains: ["example.com"] }],
 * ]
 * ```
 *
 * Android needs no native configuration — the association lives in
 * `.well-known/assetlinks.json` on your site, which must grant
 * `delegate_permission/common.get_login_creds`.
 */
const withCredentialManager = (config, props = {}) => {
  const domains = props.associatedDomains ?? [];
  if (domains.length === 0) return config;

  return withEntitlementsPlist(config, (plistConfig) => {
    const existing = plistConfig.modResults[ASSOCIATED_DOMAINS] ?? [];
    plistConfig.modResults[ASSOCIATED_DOMAINS] = Array.from(
      new Set([...existing, ...domains.map(toWebCredentials)]),
    );
    return plistConfig;
  });
};

module.exports = createRunOncePlugin(
  withCredentialManager,
  pkg.name,
  pkg.version,
);
