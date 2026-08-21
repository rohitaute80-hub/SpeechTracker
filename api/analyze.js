export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        if (!process.env.OPENAI_API_KEY) {

            return res.status(500).json({
                error:
                    "OPENAI_API_KEY is missing from Vercel"
            });

        }


        const {
            transcript,
            trackedWords
        } = req.body;


        if (!transcript) {

            return res.status(400).json({
                error:
                    "No transcript was provided"
            });

        }


        const words =
            Array.isArray(trackedWords)
                ? trackedWords.join(", ")
                : "um, uh, like";


        const prompt = `
You are a speech coach.

Analyze this speech transcript for a student practicing public speaking.

Tracked words:
${words}

Transcript:
${transcript}

Give useful, encouraging feedback.

Include:

1. Overall speaking quality
2. Filler-word usage
3. Clarity
4. Conciseness
5. Specific things to improve
6. One short practice goal

Do not be harsh or insulting.

Use short sections and bullet points.
`;


        const openAIResponse =
            await fetch(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${process.env.OPENAI_API_KEY}`
                    },

                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        input: prompt
                    })
                }
            );


        const responseText =
            await openAIResponse.text();


        console.log(
            "OpenAI analysis status:",
            openAIResponse.status
        );


        if (!openAIResponse.ok) {

            console.error(
                "OpenAI analysis error:",
                responseText
            );


            return res.status(
                openAIResponse.status
            ).json({

                error:
                    "OpenAI analysis failed",

                details:
                    responseText

            });

        }


        const result =
            JSON.parse(
                responseText
            );


        return res.status(200).json({

            analysis:
                result.output_text || ""

        });

    }
    catch (error) {

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