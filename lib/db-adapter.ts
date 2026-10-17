import net from "node:net";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";

// Node gives each IPv4/IPv6 connection attempt only 250 ms by default, which is
// shorter than the round trip to distant database regions and makes every attempt time out.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

/**
 * Neon is reached over WebSockets (HTTPS port 443) because many networks block
 * the Postgres port 5432. Any other database uses a regular TCP connection.
 */
export function createDbAdapter(connectionString: string) {
  if (new URL(connectionString).hostname.endsWith(".neon.tech")) {
    neonConfig.webSocketConstructor = ws;
    return new PrismaNeon({ connectionString });
  }
  return new PrismaPg({ connectionString });
}
