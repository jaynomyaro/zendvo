import net from "net";
import { Pool } from "pg";

/**
 * Infrastructure smoke tests for the documented runtime requirements.
 *
 * These tests are opt-in: they run only when the corresponding environment
 * variable is configured, so CI without infrastructure stays green while
 * staging/production can verify connectivity before deploy.
 *
 * - DATABASE_URL: PostgreSQL (documented primary datastore, Drizzle ORM)
 * - REDIS_URL:    Redis (optional shared store for rate limiting / sessions)
 */

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

const CONNECT_TIMEOUT_MS = 5_000;

const describeWithDatabase = DATABASE_URL ? describe : describe.skip;
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithDatabase("smoke: PostgreSQL (DATABASE_URL)", () => {
  it("accepts a connection and answers SELECT 1", async () => {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    try {
      const result = await pool.query("SELECT 1 AS ok");
      expect(result.rows[0]?.ok).toBe(1);
    } finally {
      await pool.end();
    }
  }, CONNECT_TIMEOUT_MS + 5_000);
});

describeWithRedis("smoke: Redis (REDIS_URL)", () => {
  it("accepts a connection and answers PING", async () => {
    const url = new URL(REDIS_URL!);
    const host = url.hostname;
    const port = Number(url.port || 6379);

    const reply = await new Promise<string>((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = "";
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("Redis PING timed out"));
      }, CONNECT_TIMEOUT_MS);

      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      socket.connect(port, host, () => {
        socket.write("PING\r\n");
      });
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const line = buffer.split("\r\n")[0];
        if (line) {
          clearTimeout(timer);
          socket.destroy();
          resolve(line);
        }
      });
    });

    expect(reply).toBe("+PONG");
  }, CONNECT_TIMEOUT_MS + 5_000);
});
