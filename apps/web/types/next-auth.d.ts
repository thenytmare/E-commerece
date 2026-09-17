import type { RoleName } from '@repo/database';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles: RoleName[];
      /**
       * True when the underlying account has been deactivated or soft-deleted
       * since this session was issued. JWT sessions are stateless, so this is
       * how an already-signed-in user gets locked out without waiting for the
       * token to expire.
       */
      disabled?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    roles?: RoleName[];
    disabled?: boolean;
  }
}
