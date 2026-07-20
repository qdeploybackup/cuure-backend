const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Configuration (tunable via environment)
const GEMINI_MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 4;
const GEMINI_BASE_DELAY_MS = parseInt(process.env.GEMINI_BASE_DELAY_MS, 10) || 500;
const GEMINI_MAX_JITTER_MS = parseInt(process.env.GEMINI_MAX_JITTER_MS, 10) || 200;
const GEMINI_CALL_TIMEOUT_MS = parseInt(process.env.GEMINI_CALL_TIMEOUT_MS, 10) || 10000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || null;
const modelName = primaryModel; // for backward-compat logging

// Basic sanity checks / visibility
if (!process.env.GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. Gemini requests will fail without a valid API key.');
} else {
  console.info('Gemini API key loaded from environment');
}
console.info(`Using Gemini model: ${modelName}`);

// Transient errors to retry: 429, 500, 502, 503, 504 and common network/connect timeouts
const isTransientError = (err) => {
  const msg = (err && (err.message || '')).toString();
  const code = err && err.code;
  const status = err && err.status;
  const transientStatuses = [429, 500, 502, 503, 504];
  return (
    transientStatuses.includes(Number(status)) ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    msg.includes('Connect Timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('UNAVAILABLE')
  );
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runWithTimeout = (promiseFactory, timeoutMs) => {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      const e = new Error('Connect Timeout Error');
      e.code = 'UND_ERR_CONNECT_TIMEOUT';
      finished = true;
      reject(e);
    }, timeoutMs);

    promiseFactory()
      .then((r) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(r);
      })
      .catch((err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Call a function with retries, exponential backoff and jitter.
 * Logs concise info about attempts and elapsed time.
 */
const callWithRetries = async (fn, args, maxAttempts = GEMINI_MAX_RETRIES, baseDelay = GEMINI_BASE_DELAY_MS) => {
  const start = performance.now();
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxAttempts) {
    const attemptStart = performance.now();
    try {
      const result = await runWithTimeout(() => fn(...args), GEMINI_CALL_TIMEOUT_MS);
      const elapsed = Math.round(performance.now() - start);
      console.info(`Gemini call succeeded (attempt ${attempt + 1}/${maxAttempts}) elapsed=${elapsed}ms`);
      return result;
    } catch (err) {
      lastErr = err;
      const elapsed = Math.round(performance.now() - start);
      const status = err && (err.status || err.code || 'unknown');

      // If not transient or last attempt, break and rethrow below
      if (!isTransientError(err) || attempt === maxAttempts - 1) {
        console.warn(`Gemini call failed final (attempt ${attempt + 1}/${maxAttempts}) status=${status} elapsed=${elapsed}ms message=${(err.message||'').split('\n')[0]}`);
        break;
      }

      // compute backoff + jitter
      const backoff = baseDelay * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * GEMINI_MAX_JITTER_MS);
      const delay = backoff + jitter;

      console.warn(`Gemini transient error, attempt ${attempt + 1}/${maxAttempts} status=${status} elapsed=${elapsed}ms — retrying in ${delay}ms message=${(err.message||'').split('\n')[0]}`);
      await sleep(delay);
      attempt++;
    }
  }

  // attach retry metadata to the error
  if (lastErr) {
    lastErr.retryAttempts = attempt + 1;
    lastErr.elapsedMs = Math.round(performance.now() - start);
  }
  throw lastErr;
};

const REPORT_SYSTEM_PROMPT = `You are Cuure Health AI.

Analyze the uploaded medical report or medical image.

Your task is to explain the report in simple language that a non-medical person can understand.

Return ONLY a markdown formatted response in this exact structure:

## Overall Summary

Provide a brief, clear summary in simple language.

## Important Findings

List the key findings as bullet points.

## Abnormal Values (if any)

Mention only values that are outside the normal range. If everything is normal, state that.

## What This Could Mean

Explain what the findings might indicate, carefully and without making a diagnosis.

## Questions to Ask Your Doctor

Provide 3-5 specific, helpful questions the patient can ask their doctor.

## Recommended Next Step

Suggest consulting a healthcare professional.

---

**Disclaimer:** This AI-generated summary is for informational purposes only and should not replace a consultation with a qualified healthcare professional.

IMPORTANT RULES:
- Never diagnose diseases.
- Never prescribe medication.
- Always recommend consulting a doctor.
- If the image is not a medical document, report, or scan, respond with: "UNREADABLE"`;

const summarizeReport = async (filePath, mimeType, originalName) => {
  let uploadedFile = null;
  try {
    // Upload file to Gemini File API
    uploadedFile = await ai.files.upload({
      file: filePath,
      config: { mimeType, displayName: originalName }
    });

    // Wait for file to be processed
    let file = await ai.files.get({ name: uploadedFile.name });
    let retries = 0;
    while (file.state === 'PROCESSING' && retries < 10) {
      await new Promise(r => setTimeout(r, 2000));
      file = await ai.files.get({ name: uploadedFile.name });
      retries++;
    }

    if (file.state === 'FAILED') {
      throw new Error('File processing failed in Gemini API');
    }

    const payload = {
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: REPORT_SYSTEM_PROMPT },
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } }
          ]
        }
      ]
    };

    // Helper to call Gemini with a specific model
    const generateWithModel = async (modelToUse) => {
      const payloadClone = Object.assign({}, payload, { model: modelToUse });
      return await callWithRetries((p) => ai.models.generateContent(p), [payloadClone]);
    };

    let response;
    try {
      response = await generateWithModel(primaryModel);
    } catch (err) {
      // If transient and fallback model configured and different, try fallback once
      if (isTransientError(err) && fallbackModel && fallbackModel !== primaryModel) {
        console.warn(`Primary model ${primaryModel} failed with transient error; attempting fallback model ${fallbackModel}`);
        response = await generateWithModel(fallbackModel);
      } else {
        throw err;
      }
    }

    const summary = response.text.trim();

    // Clean up uploaded file from Gemini
    try { await ai.files.delete({ name: uploadedFile.name }); } catch (e) { /* ignore cleanup errors */ }

    if (summary === 'UNREADABLE' || summary.includes('UNREADABLE')) {
      return null;
    }
    return summary;
  } catch (error) {
    // Attempt cleanup even on error
    if (uploadedFile) {
      try { await ai.files.delete({ name: uploadedFile.name }); } catch (e) { /* ignore */ }
    }
    // If transient/unavailable, throw a clear error with status for the controller to map to 429/503
    if (isTransientError(error)) {
      const out = new Error('Gemini is temporarily unavailable. Please try again later.');
      out.status = error.status || (error.code === 'UND_ERR_CONNECT_TIMEOUT' ? 504 : 503);
      out.original = (error && error.message) || error;
      throw out;
    }
    // Non-transient: rethrow to let caller handle it
    throw error;
  }
};

const getSystemPrompt = (conversationState) => `You are Cuure AI, a helpful healthcare assistant from Cuure Health. 
Your primary goal is to gather symptom information, ask follow-up questions, and determine if the user should book an appointment.

RULES:
1. Ask ONLY ONE question at a time.
2. Prefer multiple-choice questions whenever possible to make answering easy.
3. AVOID repeating previous questions.
4. Gather only the minimum information required.
5. NEVER diagnose diseases or prescribe medication.
6. Flag any life-threatening emergencies immediately and advise calling emergency services.
7. Once enough information is collected (usually 2-3 exchanges), state that a consultation is recommended and naturally transition into booking.

CONVERSATION STATE (MEMORY):
${JSON.stringify(conversationState, null, 2)}
Do not ask for information already present in the conversation state.

OUTPUT FORMAT:
You must ALWAYS respond with a valid JSON object matching this schema:
{
  "text": "The message to display to the user",
  "questionType": "text" | "single-choice" | "multi-select",
  "options": ["Option 1", "Option 2"],
  "showBookingWizard": boolean
}`;

const extractJsonObject = (text) => {
  const trimmed = text.trim();
  const cleanText = trimmed.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return null;
  }
};

const generateResponse = async (messages, conversationState = {}) => {
  try {
    const history = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      parts: [{ text: msg.content }]
    }));

    const payload = {
      model: modelName,
      contents: [
        { role: 'system', parts: [{ text: getSystemPrompt(conversationState) }] },
        { role: 'assistant', parts: [{ text: '{"text": "Understood. I will always respond in the requested JSON format.", "questionType": "text", "showBookingWizard": false}' }] },
        ...history
      ],
      config: {
        responseMimeType: "application/json",
      }
    };

    // Helper to call Gemini with a specific model
    const generateWithModel = async (modelToUse) => {
      const payloadClone = Object.assign({}, payload, { model: modelToUse });
      return await callWithRetries((p) => ai.models.generateContent(p), [payloadClone]);
    };

    let response;
    try {
      response = await generateWithModel(primaryModel);
    } catch (err) {
      if (isTransientError(err) && fallbackModel && fallbackModel !== primaryModel) {
        console.warn(`Primary model ${primaryModel} failed; trying fallback model ${fallbackModel}`);
        response = await generateWithModel(fallbackModel);
      } else {
        throw err;
      }
    }

    let jsonResponse = extractJsonObject(response.text || '');
    if (!jsonResponse) {
      console.warn("Failed to parse Gemini JSON output (non-JSON response)");
      jsonResponse = {
        text: response.text || 'Unable to interpret assistant response.',
        questionType: "text",
        options: [],
        showBookingWizard: false
      };
    }

    return {
      text: jsonResponse.text,
      questionType: jsonResponse.questionType || 'text',
      options: Array.isArray(jsonResponse.options) ? jsonResponse.options : [],
      showBookingButton: Boolean(jsonResponse.showBookingWizard)
    };
  } catch (error) {
    const status = error && (error.status || error.code || 'unknown');
    const msg = (error && (error.message || '')).toString();
    const retryAttempts = error && error.retryAttempts;
    const elapsedMs = error && error.elapsedMs;
    console.warn(`Gemini API Error: status=${status} message=${msg.split('\n')[0]} attempts=${retryAttempts||0} elapsed=${elapsedMs||'unknown'}ms`);

    // If the model is overloaded or quota exceeded, provide helpful fallback with booking option
    if (status === 429 || status === 503 || (msg && msg.includes('429')) || (msg && msg.includes('UNAVAILABLE'))) {
      return {
        text: "I am currently receiving too many requests or the model is temporarily unavailable. Please try again in a few moments, or proceed to book an appointment.",
        questionType: "text",
        options: [],
        showBookingButton: true
      };
    }

    // Generic fallback for other errors to avoid crashing the chat flow
    return {
      text: "Sorry, I am having trouble connecting. Please try again.",
      questionType: "text",
      options: [],
      showBookingButton: false
    };
  }
};

module.exports = { generateResponse, summarizeReport };
