import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
// The service-account private key is encrypted. The wrapping key is a Sites secret.
export const ga4Connection=sqliteTable('ga4_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),
 envelope:text('envelope').notNull(),createdAt:text('created_at').notNull(),checks:text('checks'),checkedAt:text('checked_at'),
});
// Credentials and refresh tokens are encrypted; the key lives in native runtime secrets.
export const admobConnection=sqliteTable('admob_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),clientEnvelope:text('client_envelope').notNull(),tokenEnvelope:text('token_envelope'),createdAt:text('created_at').notNull(),verifiedAt:text('verified_at'),
});
export const admobOAuthState=sqliteTable('admob_oauth_state',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),cookieHash:text('cookie_hash').notNull(),verifier:text('verifier').notNull(),expiresAt:text('expires_at').notNull(),
});
