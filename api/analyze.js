export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel"
            });
        }

        // Get data from the frontend
        const {
            transcript,
            trackedWords
        } = req.body || {};

        // Make sure we have a transcript
        if (!transcript || !transcript.trim()) {
            return res.status(400).json({
                error: "No transcript was provided."
            });
        }

        // Make a safe list of tracked words
        const words =
            Array.isArray(trackedWords)
                ? trackedWords.join(", ")
                : "";

        // Create the AI prompt
        const prompt = `
You are an expert public-speaking coach.

Analyze the following speech transcript and give the speaker
helpful, specific feedback.

TRACKED WORDS:
${words || "None"}

TRANSCRIPT:
${transcript}

Please organize your response into these sections:

1. Filler Word Usage
Explain how often the tracked words were used and whether
they affected the speech.

2. Clarity
Evaluate how clear and understandable the speech was.

3. Repetition
Point out unnecessary repetition or repeated ideas.

4. Conciseness
Explain whether the speaker could make any parts shorter
or more direct.

5. What You Did Well
Give 1-3 specific positive observations.

6. How To Improve
Give exactly 3 practical suggestions the speaker can use
during their next speaking practice.

Keep the feedback concise and easy for a student to understand.

Do not rewrite the entire speech.
Do not make comments about the speaker's appearance.
Focus only on speaking quality and delivery.
`;

        // Send request to OpenAI
        const openAIResponse = await fetch(
            "https://api.openai.com/v1/responses",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",

                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`
                },

                body: JSON.stringify({
                    model: "gpt-5.6-mini",
                    input: prompt
                })
            }
        );

        // Read OpenAI response
        const responseText =
            await openAIResponse.text();

        console.log(
            "OpenAI analysis status:",
            openAIResponse.status
        );

        // Handle OpenAI errors
        if (!openAIResponse.ok) {
            console.error(
                "OpenAI analysis error:",
                responseText
            );

            return res.status(
                openAIResponse.status
            ).json({
                error: "OpenAI analysis failed",
                details: responseText
            });
        }

        // Parse response
        const result =
            JSON.parse(responseText);

        // Get generated text
        const analysis =
            result.output_text || "";

        // Make sure we actually got something
        if (!analysis.trim()) {
            return res.status(500).json({
                error:
                    "OpenAI returned an empty analysis."
            });
        }

        // Send analysis back to browser
        return res.status(200).json({
            analysis: analysis
        });

    } catch (error) {
        console.error(
            "ANALYSIS SERVER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Unknown server error"
        });
    }
}