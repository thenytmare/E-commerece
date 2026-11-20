/** Parses DATABASE_URL (postgresql://user:pass@host:port/db?schema=...) into parts. */
function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, ''),
  };
}

module.exports = { parseDatabaseUrl };
