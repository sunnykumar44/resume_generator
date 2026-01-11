const { GoogleGenAI } = require('@google/genai');

const client = new GoogleGenAI({ 
  apiKey: "AIzaSyAcL66pdi-x_0y_XVDNpuOXvfUgLgxTzQ8" 
});

async function list() {
  console.log("Connecting to Google AI...");
  try {
    // The SDK returns a pager, so we use a for-await loop
    const models = await client.models.list();
    
    console.log("\n--- AVAILABLE MODELS ---");
    
    for await (const model of models) {
      console.log(`> Model ID: ${model.name}`);
      // This will show if it's Flash, Pro, or a Thinking model
    }
    
    console.log("\n-------------------------");
    console.log("Look for names like 'gemini-3-flash-preview' or 'gemini-2.5-flash'.");
  } catch (error) {
    console.error("\n❌ Error fetching models:", error.message);
  }
}

list();