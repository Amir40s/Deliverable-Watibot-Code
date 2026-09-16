import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN || 'mock_token',
  baseUrl: process.env.QSTASH_URL || "https://qstash.upstash.io",
});
