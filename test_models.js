const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function run() {
  try {
    // List models
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); // wait, getGenerativeModel is for a specific model! To list models, can we just use listModels?
    // In v0 of @google/generative-ai, can we list models? 
    console.log("Listing models is not easily done without full setup, let's try gemini-1.5-pro as a fallback!");
  } catch (e) {
    console.error(e);
  }
}

run();
