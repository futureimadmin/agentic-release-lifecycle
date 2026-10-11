import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

let genAI = null;
let model = null;

/**
 * Initialize Gemini client. Requires GEMINI_API_KEY.
 */
export function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is not set. Copy .env.example to .env and add your key from https://aistudio.google.com/apikey'
    );
  }

  genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
  });
  logger.info(`Gemini client initialized (model: ${modelName})`);
  return model;
}

/**
 * Get the generative model (must call initGemini first).
 */
export function getModel() {
  if (!model) {
    return initGemini();
  }
  return model;
}

/**
 * Run a single generateContent call with optional tools (function declarations).
 * @param {string} systemInstruction
 * @param {Array} contents - conversation turns
 * @param {Array} [tools] - Gemini tool declarations
 * @returns {Promise<import('@google/generative-ai').GenerateContentResult>}
 */
export async function generateWithTools(systemInstruction, contents, tools = []) {
  const m = getModel();
  const request = {
    contents,
    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
  };
  if (tools.length > 0) {
    request.tools = [{ functionDeclarations: tools }];
  }
  return m.generateContent(request);
}
