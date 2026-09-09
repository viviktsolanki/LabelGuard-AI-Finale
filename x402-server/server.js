import "dotenv/config";

import { Hono } from "hono";
import { serve } from "@hono/node-server";

import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";

import { ExactAvmScheme } from "@x402/avm/exact/server";

import {
  USDC_TESTNET_ASA_ID,
} from "@x402/avm";

const app = new Hono();
const ALGORAND_TESTNET = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient);

resourceServer.register(
  ALGORAND_TESTNET,
  new ExactAvmScheme()
);

const routes = {
  "POST /api/analyze": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET,
      payTo: process.env.RECEIVER_ADDRESS,
      price: {
        asset: USDC_TESTNET_ASA_ID,
        amount: "100000",
        extra: {
          name: "USDC",
          decimals: 6,
        },
      },
    },
    description: "LabelGuard AI compliance analysis",
    mimeType: "application/json",
  },
};

app.use(
  "*",
  paymentMiddleware(routes, resourceServer)
);

app.post("/api/analyze", async (c) => {
  return c.json({
    success: true,
    product: "LabelGuard AI",
    message: "Paid compliance analysis unlocked.",
    status: "READY",
  });
});

app.get("/", (c) => {
  return c.json({
    name: "LabelGuard AI x402 API",
    status: "running",
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: "labelguard-x402",
  });
});

const port = Number(process.env.PORT || 4021);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(
      `LabelGuard x402 server running on http://localhost:${info.port}`
    );
  }
);