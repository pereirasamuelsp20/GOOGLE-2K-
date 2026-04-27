import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function generateSmartReplies(messagesContext) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    return ["On my way", "Need help"]; // Fallback if no key
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a smart reply assistant in an emergency messaging app. 
Context (last 3 messages):
${messagesContext.map(m => `${m.sender}: ${m.text}`).join('\n')}

Suggest exactly 2 short, distinct reply options (max 4 words each) for the user receiving these messages. 
Respond in JSON format: ["reply 1", "reply 2"]. Nothing else.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const suggestions = JSON.parse(responseText.match(/\[.*\]/s)[0]);
    return suggestions;
  } catch (error) {
    console.error("Smart reply error", error);
    return ["Okay", "Thanks"]; // Fallbacks
  }
}

export async function rewriteAdminPost(text, tags) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") return text;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are an emergency management AI assistant. Rewrite the following admin update to be extremely clear, concise, and actionable for disaster victims. Keep it under 400 characters. Preserve all critical facts.
Original text: "${text}"
Tags associated: [${tags.join(', ')}]
Return ONLY the rewritten text, no quotes or intro.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error("Rewrite error", e);
    return text;
  }
}
