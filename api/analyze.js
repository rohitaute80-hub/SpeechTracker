import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel"
            });
        }

        const body = req.body || {};

        console.log(
            "REQUEST BODY:",
            body
        );

        const transcript =
            typeof body.transcript === "string"
                ? body.transcript.trim()
                : "";

        const trackedWords =
            Array.isArray(body.trackedWords)
                ? body.trackedWords
                : [];

        if (!transcript) {
            return res.status(400).json({
                error: "Transcript is empty"
            });
        }

        const wordList =
            trackedWords.length > 0
                ? trackedWords.join(", ")
                : "None";

        const prompt = `
You are an expert public speaking coach.

Analyze this speech transcript.

TRACKED WORDS:
${wordList}

TRANSCRIPT:
${transcript}

Give useful, encouraging feedback.

Use exactly these sections:

OVERALL SCORE
Give a score from 1 to 10.

WHAT YOU DID WELL
Give two specific strengths.

FILLER WORDS
Explain which tracked words appeared and how often if possible.

CLARITY
Explain how clear and easy to follow the speech was.

HOW TO IMPROVE
Give three specific suggestions.

NEXT CHALLENGE
Give one short speaking exercise.

Do not invent information that is not supported by the transcript.
`;

        console.log(
            "Sending request to OpenAI..."
        );

        const response =
            await client.responses.create({
                model: "gpt-5.6-luna",
                input: prompt
            });

        console.log(
            "OpenAI response received."
        );

        const analysis =
            typeof response.output_text === "string"
                ? response.output_text.trim()
                : "";

        console.log(
            "ANALYSIS:",
            analysis
        );

        if (!analysis) {

            return res.status(502).json({
                error:
                    "OpenAI returned an empty analysis."
            });
        }

        return res.status(200).json({
            analysis: analysis
        });

    } catch (error) {

        console.error(
            "OPENAI ANALYSIS ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "AI analysis failed."
        });
    }
}