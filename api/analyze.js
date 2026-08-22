export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        // --------------------------------------------------------
        // CHECK API KEY
        // --------------------------------------------------------

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel"
            });
        }

        // --------------------------------------------------------
        // GET TRANSCRIPT
        // --------------------------------------------------------

        const { transcript } = req.body || {};

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({
                error: "No transcript was provided"
            });
        }

        // --------------------------------------------------------
        // CALL OPENAI
        // --------------------------------------------------------

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`
                },

                body: JSON.stringify({
                    model: "gpt-4o-mini",

                    temperature: 0.7,

                    response_format: {
                        type: "json_object"
                    },

                    messages: [
                        {
                            role: "system",

                            content: `
You are an expert public speaking coach.

Analyze the user's speech transcript carefully.

Your feedback MUST be specific to the actual transcript.

Do NOT give generic advice.

Look for:
- filler words
- repeated words
- unnecessary phrases
- unclear sentences
- rambling
- weak transitions
- overly long sentences
- vague wording
- repetition
- unnecessary pauses indicated by words
- places where the speaker could be more concise
- strengths in delivery or wording

If filler words such as "um", "uh", "umm", "uhh", "like", or "you know" appear in the transcript, specifically discuss them.

Give pointed feedback that tells the speaker exactly what they should change.

Return ONLY valid JSON with exactly these fields:

{
  "overall": "A specific overall assessment based on this transcript.",
  "fillerWords": "Specific feedback about the filler words actually found.",
  "clarity": "Specific feedback about clarity and wording.",
  "strength": "One specific thing the speaker did well.",
  "improvement": "One specific change the speaker should make.",
  "tip": "One practical speaking tip tailored to this transcript."
}

Do not use markdown.
Do not put JSON inside a code block.
Do not add any text outside the JSON.
`
                        },

                        {
                            role: "user",

                            content:
                                `Here is the speech transcript:

${transcript}`
                        }
                    ]
                })
            }
        );

        // --------------------------------------------------------
        // READ RESPONSE
        // --------------------------------------------------------

        const responseText = await response.text();

        console.log(
            "OpenAI analysis status:",
            response.status
        );

        console.log(
            "OpenAI raw analysis response:",
            responseText
        );

        // --------------------------------------------------------
        // CHECK OPENAI HTTP ERROR
        // --------------------------------------------------------

        if (!response.ok) {
            return res.status(response.status).json({
                error: "OpenAI analysis failed",
                details: responseText
            });
        }

        // --------------------------------------------------------
        // PARSE OPENAI RESPONSE
        // --------------------------------------------------------

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error(
                "Could not parse OpenAI response:",
                error
            );

            return res.status(500).json({
                error: "OpenAI returned invalid JSON",
                details: responseText
            });
        }

        // --------------------------------------------------------
        // EXTRACT MODEL CONTENT
        // --------------------------------------------------------

        const content =
            data?.choices?.[0]?.message?.content;

        if (!content) {
            console.error(
                "OpenAI response contained no message content:",
                JSON.stringify(data, null, 2)
            );

            return res.status(500).json({
                error:
                    "OpenAI returned no analysis content",
                details:
                    JSON.stringify(data)
            });
        }

        console.log(
            "OpenAI analysis content:",
            content
        );

        // --------------------------------------------------------
        // PARSE AI JSON
        // --------------------------------------------------------

        let analysis;

        try {
            analysis = JSON.parse(content);
        } catch (error) {
            console.error(
                "Analysis JSON was invalid:",
                content
            );

            return res.status(500).json({
                error:
                    "The AI analysis JSON was invalid",
                details:
                    content
            });
        }

        // --------------------------------------------------------
        // VERIFY ANALYSIS
        // --------------------------------------------------------

        if (
            !analysis ||
            typeof analysis !== "object"
        ) {
            return res.status(500).json({
                error:
                    "OpenAI returned an invalid analysis object"
            });
        }

        // --------------------------------------------------------
        // SAFELY GET FIELDS
        // --------------------------------------------------------

        const overall =
            typeof analysis.overall === "string"
                ? analysis.overall
                : "";

        const fillerWords =
            typeof analysis.fillerWords === "string"
                ? analysis.fillerWords
                : "";

        const clarity =
            typeof analysis.clarity === "string"
                ? analysis.clarity
                : "";

        const strength =
            typeof analysis.strength === "string"
                ? analysis.strength
                : "";

        const improvement =
            typeof analysis.improvement === "string"
                ? analysis.improvement
                : "";

        const tip =
            typeof analysis.tip === "string"
                ? analysis.tip
                : "";

        // --------------------------------------------------------
        // MAKE SURE SOMETHING ACTUALLY CAME BACK
        // --------------------------------------------------------

        const sections = [
            overall,
            fillerWords,
            clarity,
            strength,
            improvement,
            tip
        ].filter(Boolean);

        if (sections.length === 0) {
            return res.status(500).json({
                error:
                    "OpenAI returned an empty analysis",
                details:
                    JSON.stringify(analysis)
            });
        }

        // --------------------------------------------------------
        // FORMAT FOR YOUR EXISTING SCRIPT.JS
        // --------------------------------------------------------

        const formattedAnalysis = [

            overall
                ? `Overall:\n${overall}`
                : "",

            fillerWords
                ? `Filler Words:\n${fillerWords}`
                : "",

            clarity
                ? `Clarity:\n${clarity}`
                : "",

            strength
                ? `Strength:\n${strength}`
                : "",

            improvement
                ? `Improvement:\n${improvement}`
                : "",

            tip
                ? `Tip:\n${tip}`
                : ""

        ]
            .filter(Boolean)
            .join("\n\n");

        // --------------------------------------------------------
        // RETURN TO FRONTEND
        // --------------------------------------------------------

        return res.status(200).json({
            analysis: formattedAnalysis,

            // Also return the structured version
            // in case you want to use it later.
            analysisData: {
                overall,
                fillerWords,
                clarity,
                strength,
                improvement,
                tip
            }
        });

    } catch (error) {

        console.error(
            "ANALYSIS SERVER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "Unknown analysis error"
        });
    }
}