import type { Core } from '@strapi/strapi';

const driveScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      providers: {
        google: {
          clientId: env('GOOGLE_CLIENT_ID'),
          clientSecret: env('GOOGLE_CLIENT_SECRET'),
          callback: env('GOOGLE_CALLBACK_URL', 'http://localhost:1337/api/connect/google/callback'),
          scope: driveScopes,
        },
      },
      // Force authorization-code flow for Google
      grant: {
        google: {
          response_type: 'code',
          callback: env('GOOGLE_CALLBACK_URL', 'http://localhost:1337/api/connect/google/callback'),
          scope: driveScopes,
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    },
  },
});

export default config;
