import { config } from "dotenv";
import http from "node:http";

import {
  x402Client,
  wrapFetchWithPayment,
  x402HTTPClient,
} from "@x402/fetch";

import {
  toClientAvmSigner,
  ExactAvmScheme,
} from "@x402/avm";

import {
  ed25519SigningKeyFromWrappedSecret,
} from "@algorandfoundation/algokit-utils/crypto";

import {
  seedFromMnemonic,
} from "@algorandfoundation/algokit-utils/algo25";

config();

const avmMnemonic = process.env.AVM_MNEMONIC;

if (!avmMnemonic) {
  throw new Error("AVM_MNEMONIC is missing from .env");
}

const ALGORAND_TESTNET =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

const url = "http://localhost:4021/api/analyze";

const PORT = 4022;

async function getSecretKeyFromMnemonic(mnemonic) {
  const seed = seedFromMnemonic(mnemonic);

  const seedCopy = new Uint8Array(seed);

  const wrappedSeed = {
    unwrapEd25519Seed: async () => seed,
    wrapEd25519Seed: async () => {},
  };

  const wrappedSecret =
    await ed25519SigningKeyFromWrappedSecret(wrappedSeed);

  return Buffer.concat([
    Buffer.from(seedCopy),
    Buffer.from(wrappedSecret.ed25519Pubkey),
  ]).toString("base64");
}

async function payForAnalysis() {
  const secretKey =
    await getSecretKeyFromMnemonic(avmMnemonic);

  const avmSigner = toClientAvmSigner(secretKey);

  const client = new x402Client();

  client.register(
    ALGORAND_TESTNET,
    new ExactAvmScheme(avmSigner)
  );

  const fetchWithPayment =
    wrapFetchWithPayment(fetch, client);

  const response = await fetchWithPayment(url, {
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `x402 payment failed: ${response.status} ${body}`
    );
  }

  const paymentResponse =
    new x402HTTPClient(client).getPaymentSettleResponse(
      (name) => response.headers.get(name)
    );

  const responseBody = await response.text();

  return {
    success: true,
    payment: paymentResponse,
    response: JSON.parse(responseBody),
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4028");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        name: "LabelGuard x402 Payment Bridge",
        status: "running",
      })
    );
    return;
  }

  if (req.method === "POST" && req.url === "/api/pay") {
    try {
      console.log("Starting x402 payment...");

      const result = await payForAnalysis();

      console.log(
        "x402 payment settled:",
        result.payment?.transaction
      );

      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("x402 payment failed:", error);

      res.writeHead(500);
      res.end(
        JSON.stringify({
          success: false,
          error: error?.message || "Payment failed",
        })
      );
    }

    return;
  }

  res.writeHead(404);
  res.end(
    JSON.stringify({
      success: false,
      error: "Not found",
    })
  );
});

server.listen(PORT, () => {
  console.log(
    `LabelGuard x402 payment bridge running on http://localhost:${PORT}`
  );
});