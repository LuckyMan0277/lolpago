import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export const getAnthropic = () => {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set in environment variables.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
};

export const MODEL_ID = "claude-opus-4-7";
