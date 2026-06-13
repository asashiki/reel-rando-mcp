import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { REEL_WIDGET_MIME, REEL_WIDGET_URI, reelWidgetHtml } from "./widget/reel-widget-html.js";

const MODES = ["slot", "wheel", "cards"] as const;
export type SpinMode = (typeof MODES)[number];

export interface SpinResult {
  title: string;
  options: string[];
  mode: SpinMode;
  resultIndex: number;
  resultLabel: string;
  drawId: string;
  createdAt: string;
}

/** The widget loads no external resources, so the CSP origin lists stay empty. */
const CSP_META = {
  ui: { csp: { resourceDomains: [], connectDomains: [] } },
  "openai/widgetCSP": { resource_domains: [], connect_domains: [] }
};

export function createReelServer(_config: AppConfig): McpServer {
  const server = new McpServer({ name: "reel-rando", version: "0.1.0" });

  server.registerResource(
    "reel-widget",
    REEL_WIDGET_URI,
    {
      title: "Reel Rando",
      description: "Playable slot machine / wheel / card draw for random decisions.",
      mimeType: REEL_WIDGET_MIME,
      _meta: CSP_META
    },
    async () => ({
      contents: [
        { uri: REEL_WIDGET_URI, mimeType: REEL_WIDGET_MIME, text: reelWidgetHtml(), _meta: CSP_META }
      ]
    })
  );

  server.registerTool(
    "spin_picker",
    {
      title: "Spin Picker",
      description:
        "Turn a set of choices into a playable random picker rendered in the chat — a slot machine, a spinning wheel, or a card draw. " +
        "Use this whenever the user faces a decision among concrete alternatives (午饭吃什么 / which movie / pick one for me / 选择困难), " +
        "instead of just listing the options and making the user choose. " +
        "Provide 2-12 short option labels (≤12 chars each works best). " +
        "Pick a mode that fits: 'slot' (default, any count), 'wheel' (nice for 3-8), 'cards' (nice for 2-6). " +
        "The outcome is decided server-side and included in the tool result FOR YOUR REFERENCE ONLY — " +
        "after calling, just invite the user to spin/draw in one short sentence. Do NOT reveal or hint at the result " +
        "until the user has interacted with the widget or explicitly asks. " +
        "If the user wants a re-roll, call this tool again with the same options.",
      inputSchema: {
        title: z
          .string()
          .max(40)
          .optional()
          .describe("Short question shown above the widget, e.g. '今天中午吃什么'. Defaults to '试试手气'."),
        options: z
          .array(z.string().min(1).max(24))
          .min(2)
          .max(12)
          .describe("The candidate choices, short labels work best."),
        mode: z.enum(MODES).optional().describe("Interaction style: slot | wheel | cards. Default slot.")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: { resourceUri: REEL_WIDGET_URI },
        "openai/outputTemplate": REEL_WIDGET_URI
      }
    },
    async ({ title, options, mode }) => {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) {
        return {
          content: [{ type: "text", text: "Need at least 2 non-empty options." }],
          isError: true
        };
      }
      const resultIndex = crypto.randomInt(cleaned.length);
      const payload: SpinResult = {
        title: title?.trim() || "试试手气",
        options: cleaned,
        mode: mode ?? "slot",
        resultIndex,
        resultLabel: cleaned[resultIndex] ?? "",
        drawId: crypto.randomBytes(4).toString("hex"),
        createdAt: new Date().toISOString()
      };
      return {
        content: [
          {
            type: "text",
            text:
              `The ${payload.mode} widget is now showing in the chat with ${cleaned.length} options. ` +
              `Hidden outcome (draw ${payload.drawId}): "${payload.resultLabel}". ` +
              "Do not reveal it — just invite the user to spin/draw with one short, fun sentence."
          },
          { type: "text", text: JSON.stringify(payload) }
        ],
        structuredContent: payload as unknown as Record<string, unknown>,
        _meta: { ui: { resourceUri: REEL_WIDGET_URI } }
      };
    }
  );

  return server;
}
