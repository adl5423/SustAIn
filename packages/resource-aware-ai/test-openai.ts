import { ResourceAwareAI } from "./src/index.js";

(async () => {
  if (!process.env["OPENAI_API_KEY"]) {
    console.error("Missing OPENAI_API_KEY — add it to Replit Secrets.");
    process.exit(1);
  }

  const ai = new ResourceAwareAI();

  console.log("Sending request to OpenAI...\n");

  const res = await ai.chat({
    model: "gpt-4o-mini",
    provider: "openai",
    messages: [{ role: "user", content: "What is the water cycle? One sentence." }],
  });

  console.log("Response:", res.output);
  console.log("\n--- Sustainability Report ---");
  console.log(res.footnote);
})();
