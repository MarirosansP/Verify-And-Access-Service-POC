-- Migration: Add WorkerKey table
-- This adds worker keys to the same SQLite database as API keys

CREATE TABLE IF NOT EXISTS "WorkerKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "callbackPath" TEXT NOT NULL DEFAULT '/',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Unique index on keyHash for fast lookups during validation
CREATE UNIQUE INDEX IF NOT EXISTS "WorkerKey_keyHash_key" ON "WorkerKey"("keyHash");
