-- Raised by one on every password change or reset. Sign-ins made under an
-- older value stop working, which signs the account out on other devices.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
