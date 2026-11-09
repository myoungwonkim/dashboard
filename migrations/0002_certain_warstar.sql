CREATE TABLE `admob_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_envelope` text NOT NULL,
	`token_envelope` text,
	`created_at` text NOT NULL,
	`verified_at` text
);
--> statement-breakpoint
CREATE TABLE `admob_oauth_state` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`cookie_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` text NOT NULL
);
