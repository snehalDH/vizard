import "dotenv/config";
import { runAgent } from "./src/agent/index.js";

const prompt = process.argv[2] ?? "draw a simple login flow";
console.log(`User: ${prompt}\n`);

const response = await runAgent(prompt);
console.log(`\nAgent: ${response}`);
