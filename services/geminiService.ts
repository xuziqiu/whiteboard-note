import { GoogleGenAI, Type } from "@google/genai";
import { AIBrainstormResult } from '../types';

// Initialize Gemini Client
// Note: API Key must be provided in the environment or passed appropriately.
// In this demo structure, we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * brainstormRelatedIdeas
 * Generates 3-4 related concepts based on a source note.
 */
export const brainstormRelatedIdeas = async (
  sourceTitle: string,
  sourceContent: string
): Promise<AIBrainstormResult[]> => {
  if (!process.env.API_KEY) {
    console.error("Missing API Key");
    throw new Error("API Key is missing. Please set your Gemini API Key.");
  }

  const prompt = `
    I am using a visual note-taking app. I have a note titled "${sourceTitle}" with the following content:
    "${sourceContent}"

    Please generate 3 to 4 distinct, interesting, and brief follow-up ideas or related concepts that branch off from this note.
    Each idea should have a short title and a one-sentence summary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ["title", "content"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as AIBrainstormResult[];
  } catch (error) {
    console.error("Error generating brainstorming ideas:", error);
    throw error;
  }
};

/**
 * summarizeNote
 * Summarizes the content of a note.
 */
export const summarizeNote = async (content: string): Promise<string> => {
   if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const prompt = `Summarize the following text in a concise, clear manner suitable for a quick note review:\n\n${content}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error summarizing note:", error);
    throw error;
  }
};
