const fs = require('fs');
const path = require('path');

/**
 * Minimal .env loader (no dotenv dependency, matching the rest of scripts/).
 * Checks the repo root first, then packages/database, without overwriting
 * any variable already present in process.env.
 */
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '..', 'packages', 'database', '.env'),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const contents = fs.readFileSync(file, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

module.exports = { loadEnv };
