import { GoogleGenAI, Type } from "@google/genai";
import { AIBrainstormResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-3-flash-preview';

export const brainstormRelatedIdeas = async (
  sourceContent: string
): Promise<AIBrainstormResult[]> => {
  if (!process.env.API_KEY) {
    console.error("Missing API Key");
    throw new Error("API Key is missing.");
  }

  const prompt = `
    I have a note with the following content:
    "${sourceContent}"

    Please generate 3 distinct, interesting, and brief follow-up ideas or related concepts that branch off from this note.
    Return only the content for the new notes.
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
              content: { type: Type.STRING },
            },
            required: ["content"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as AIBrainstormResult[];
  } catch (error) {
    console.error("Error generating ideas:", error);
    throw error;
  }
};

export const summarizeNote = async (content: string): Promise<string> => {
   if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }
  const prompt = `Summarize this text concisely:\n\n${content}`;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error summarizing:", error);
    throw error;
  }
};
