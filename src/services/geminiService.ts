import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAIResponse(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  if (!process.env.GEMINI_API_KEY) {
    return "I'm currently in demo mode. Please connect a Gemini API key to enable full AI capabilities! I can tell you that Aahwanam is the premier event management platform for premium weddings, corporate galas, and tech conferences.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `You are Aahwanam's elite AI event concierge. 
        Aahwanam is a premium, high-tech event management platform.
        Your goal is to assist users in planning extraordinary events: weddings, DJ nights, Holi festivals, corporate meetups, and college fests.
        
        INTENT DETECTION:
        - If the user wants to book or host an event, mention that you can open the booking form for them.
        - If the user asks for suggestions, use your internal knowledge to recommend Wedding, DJ, Holi, Corporate, or College Fest based on keywords like "fun", "celebration", "ceremony", "office", etc.
        
        STYLE:
        Be professional, sophisticated, and helpful. Keep responses concise but elegant.`,
        temperature: 0.7,
      }
    });

    return response.text || "I'm sorry, I couldn't process that request at the moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The intelligence core is currently recalibrating. Please try again in a moment.";
  }
}

export const geminiService = {
  getAIResponse,

  async detectIntent(message: string) {
    if (!process.env.GEMINI_API_KEY) {
      const msg = message.toLowerCase();
      if (msg.includes('book') || msg.includes('host')) return { intent: 'book_event' };
      if (msg.includes('fun') || msg.includes('party')) return { intent: 'get_recommendation', suggestedType: 'DJ' };
      if (msg.includes('color') || msg.includes('festival')) return { intent: 'get_recommendation', suggestedType: 'Holi' };
      if (msg.includes('formal') || msg.includes('office')) return { intent: 'get_recommendation', suggestedType: 'Corporate' };
      if (msg.includes('marriage')) return { intent: 'get_recommendation', suggestedType: 'Wedding' };
      return { intent: 'chat' };
    }
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this user message and categorize it.
        Mappings to prioritize:
        - "fun", "party" -> DJ
        - "color", "festival" -> Holi
        - "formal", "office" -> Corporate
        - "marriage" -> Wedding
        - "college", "fest" -> College Fest

        Message: "${message}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ["book_event", "get_recommendation", "contact", "chat"] },
              suggestedType: { type: Type.STRING, description: "If intent is get_recommendation, suggest one of: Wedding, DJ, Holi, Corporate, College Fest" }
            },
            required: ["intent"]
          }
        }
      });
      return JSON.parse(response.text || '{"intent": "chat"}');
    } catch (e) {
      return { intent: 'chat' };
    }
  },

  async generateEventImage(eventType: string) {
    if (!process.env.GEMINI_API_KEY) {
      return `https://picsum.photos/seed/${eventType}/800/600`;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `A professional, high-quality, cinematic photo for a ${eventType} event. Sophisticated lighting, vibrant colors, premium event production style, 4k resolution, editorial aesthetic.` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return `https://picsum.photos/seed/${eventType}/800/600`;
    } catch (error) {
      console.error("Image Gen Error:", error);
      return `https://picsum.photos/seed/${eventType}/800/600`;
    }
  },
  
  async getEventSuggestions(category: string) {
    // ... rest of the existing methods ...
    if (!process.env.GEMINI_API_KEY) {
      return [
        { title: `${category} Expo 2026`, date: '2026-06-15', location: 'Metropolitan Center' },
        { title: `${category} Summit`, date: '2026-08-20', location: 'Silicon Valley Hall' }
      ];
    }
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Suggest 3 unique event ideas for the category: ${category}. Return only a JSON array of objects with title, date (YYYY-MM-DD), and location.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                date: { type: Type.STRING },
                location: { type: Type.STRING }
              },
              required: ["title", "date", "location"]
            }
          }
        }
      });
      
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("getEventSuggestions error:", error);
      return [];
    }
  },

  async generateEventNarrative(title: string, description: string) {
    if (!process.env.GEMINI_API_KEY) {
      return {
        vision: "A conceptual exploration of excellence.",
        pillars: ["Innovation", "Exclusivity", "Intelligence"],
        aesthetic: "Minimalist, Industrial, High-Contrast"
      };
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a creative manifesto for an event titled "${title}" with description: "${description}". Return JSON with vision (string), pillars (array of strings), and aesthetic (string).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vision: { type: Type.STRING },
              pillars: { type: Type.ARRAY, items: { type: Type.STRING } },
              aesthetic: { type: Type.STRING }
            },
            required: ["vision", "pillars", "aesthetic"]
          }
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("generateEventNarrative error:", error);
      return null;
    }
  }
};
