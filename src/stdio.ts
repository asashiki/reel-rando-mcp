import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createReelServer } from "./mcp.js";

async function main() {
  const server = createReelServer(loadConfig());
  await server.connect(new StdioServerTransport());
  console.error("reel-rando-mcp running on stdio");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
