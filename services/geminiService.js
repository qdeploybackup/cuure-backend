const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

    const response = await ai.models.generateContent({
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
    });

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
    throw error;
  }
};

const getSystemPrompt = (conversationState) => `You are Cuure AI, a healthcare assistant.

Rules:
- Ask only one question at a time.
- Prefer multiple-choice questions.
- Never diagnose diseases.
- Never prescribe medicines.
- Recommend booking an appointment once enough information is collected.

Conversation State:
${JSON.stringify(conversationState)}

Return ONLY a valid JSON object.

Do NOT use markdown.
Do NOT use code fences.
Do NOT add explanations.

Example:

{
  "text": "Hello! How can I help you today?",
  "questionType": "single-choice",
  "options": [
    "Fever or Cold symptoms",
    "Pain",
    "General Checkup"
  ],
  "showBookingWizard": false
}`;

const generateResponse = async (messages, conversationState = {}) => {
  try {
    const history = messages.map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "System Prompt:\n" +
                getSystemPrompt(conversationState),
            },
          ],
        },
        {
          role: "model",
          parts: [
            {
              text: JSON.stringify({
                text: "Understood. I will always respond with valid JSON only.",
                questionType: "text",
                options: [],
                showBookingWizard: false,
              }),
            },
          ],
        },
        ...history,
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 2048,
      },
    });

    console.log("===== GEMINI RESPONSE =====");
    console.dir(response, { depth: null });
    console.log("===========================");

    let text =
      response?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || "";

    console.log("RAW JSON:");
    console.log(text);

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    let jsonResponse;

    try {
      jsonResponse = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini JSON output:", text, e);

      jsonResponse = {
        text: "Sorry, I couldn't process your request. Please try again.",
        questionType: "text",
        options: [],
        showBookingWizard: false,
      };
    }

    return {
      text: jsonResponse.text,
      questionType: jsonResponse.questionType || "text",
      options: jsonResponse.options || [],
      showBookingButton: jsonResponse.showBookingWizard || false,
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
module.exports = { generateResponse, summarizeReport };
