import { REQUEST_TIMEOUT_MS } from './config.js';

export async function requestHint({ model, apiKey, prompt, temperature = 0.3, maxOutputTokens = 1200 }) {
  if (!apiKey) throw { code: 'MISSING_KEY', userMessage: 'Add a Gemini API key in the extension popup.' };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        generationConfig: { temperature, maxOutputTokens },
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errors = {
        400: 'Gemini rejected the request. Check the selected model.',
        401: 'Gemini rejected the API key. Check it in the popup.',
        403: 'Gemini denied access. Check the key and model permissions.',
        404: 'Gemini could not find that model. Update it in the popup.',
        429: 'Gemini is rate limiting requests. Wait and retry.'
      };
      throw { code: `HTTP_${response.status}`, userMessage: errors[response.status] || 'Gemini is unavailable. Try again later.' };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n').trim();
    if (!text) throw { code: 'EMPTY_RESPONSE', userMessage: 'Gemini returned no hint. Retry this tier.' };
    return text;
  } catch (error) {
    if (error?.userMessage) throw error;
    if (controller.signal.aborted) throw { code: 'TIMEOUT', userMessage: 'Gemini timed out. Retry this tier.' };
    throw { code: 'NETWORK', userMessage: 'Could not reach Gemini. Check your connection and retry.' };
  } finally {
    clearTimeout(timeoutId);
  }
}
