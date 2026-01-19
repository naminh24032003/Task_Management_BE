/**
 * OAuth Configuration Port
 * Defines the contract for OAuth configuration
 */
export interface IOAuthConfig {
  google: {
    clientId: string;
    clientSecret: string;
  };
}

export const OAUTH_CONFIG = Symbol('IOAuthConfig');
