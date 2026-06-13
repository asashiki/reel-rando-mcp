import cors from "cors";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { setupOAuth } from "./oauth.js";
import { createReelServer } from "./mcp.js";

const config = loadConfig();
const mcpPaths = Array.from(new Set([config.mcpHttpPath, "/mcp"]));

async function main() {
  const app = express();
  app.set("trust proxy", true);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));

  const bearerAuth = setupOAuth(app, config.publicBaseUrl, "reel-rando");

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "reel-rando",
      transport: "streamable-http",
      publicBaseUrl: config.publicBaseUrl,
      mcpEndpoint: `${config.publicBaseUrl ?? `http://127.0.0.1:${config.port}`}${config.mcpHttpPath}`
    });
  });

  app.all(mcpPaths, bearerAuth, async (req, res) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.length > 0 && !config.allowedOrigins.includes(origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    const server = createReelServer(config);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: error instanceof Error ? error.message : "Internal server error" },
          id: null
        });
      }
    } finally {
      void transport.close();
      void server.close();
    }
  });

  const httpServer = app.listen(config.port, "0.0.0.0", () => {
    console.log(`reel-rando MCP listening on :${config.port} (${config.mcpHttpPath})`);
  });
  httpServer.keepAliveTimeout = 70_000;
  httpServer.headersTimeout = 75_000;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
