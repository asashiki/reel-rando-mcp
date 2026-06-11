export interface AppConfig {
  port: number;
  publicBaseUrl: string | null;
  mcpHttpPath: string;
  allowedOrigins: string[];
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function normalizePath(value: string | undefined, defaultValue: string): string {
  const p = value?.trim() || defaultValue;
  return p.startsWith("/") ? p : `/${p}`;
}

export function loadConfig(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || null;
  return {
    port: Number.isFinite(port) ? port : 3000,
    publicBaseUrl,
    mcpHttpPath: normalizePath(process.env.MCP_HTTP_PATH, "/mcp/reel"),
    allowedOrigins: parseList(process.env.ALLOWED_ORIGINS, publicBaseUrl ? [new URL(publicBaseUrl).origin] : [])
  };
}
