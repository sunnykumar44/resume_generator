const { GoogleGenAI } = require("@google/genai");

// Use your actual API key
const ai = new GoogleGenAI({
  apiKey: "AIzaSyAcL66pdi-x_0y_XVDNpuOXvfUgLgxTzQ8"
});

async function list() {
  console.log("Connecting to Google AI (2026 SDK)...");
  try {
    // In the new SDK, models.list() returns an iterator for easy pagination
    const models = await ai.models.list();
    
    console.log("\n--- AVAILABLE MODELS ---");
    
    // Use for await...of to handle the paginated results correctly
    for await (const model of models) {
      console.log(`> Model ID: ${model.name}`);
      console.log(`  Display Name: ${model.displayName}`);
      console.log('---');
    }
    
    console.log("\n✅ Done! Copy the Model ID (e.g., gemini-2.5-pro) to your code.");
  } catch (error) {
    console.error("\n❌ Error fetching models:", error.message);
  }
}

list();