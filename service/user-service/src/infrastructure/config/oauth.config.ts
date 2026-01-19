import { registerAs } from '@nestjs/config';

export interface OAuthConfig {
  google: {
    clientId: string;
    clientSecret: string;
  };
}

export default registerAs(
  'oauth',
  (): OAuthConfig => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }

    return {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
    };
  },
);
