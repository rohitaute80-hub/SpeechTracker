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


        const { transcript } = req.body;


        if (!transcript || !transcript.trim()) {

            return res.status(400).json({
                error:
                    "No transcript was provided"
            });

        }


        const response =
            await fetch(
                "https://api.openai.com/v1/chat/completions",
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

                        response_format: {
                            type: "json_object"
                        },

                        messages: [

                            {
                                role: "system",

                                content:
                                    `You are an expert public speaking coach.

Analyze the user's speech transcript.

Return ONLY valid JSON.

The JSON must contain exactly these fields:

{
  "overall": "short overall assessment",
  "fillerWords": "feedback about filler word usage",
  "clarity": "feedback about clarity",
  "strength": "one thing the speaker did well",
  "improvement": "one specific thing to improve",
  "tip": "one practical speaking tip"
}

Do not use markdown.
Do not put JSON inside a code block.
Do not add any text outside the JSON.`
                            },

                            {
                                role: "user",

                                content:
                                    `Analyze this speech:

${transcript}`
                            }

                        ]

                    })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "OpenAI analysis status:",
            response.status
        );


        console.log(
            "OpenAI analysis response:",
            responseText
        );


        if (!response.ok) {

            return res.status(
                response.status
            ).json({

                error:
                    "OpenAI analysis failed",

                details:
                    responseText

            });

        }


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (parseError) {

            console.error(
                "Could not parse OpenAI response:",
                parseError
            );

            return res.status(500).json({
                error:
                    "OpenAI returned invalid JSON",
                details:
                    responseText
            });

        }


        const content =
            data?.choices?.[0]?.message?.content;


        if (!content) {

            return res.status(500).json({
                error:
                    "OpenAI returned an empty analysis"
            });

        }


        let analysis;


        try {

            analysis =
                JSON.parse(content);

        } catch (parseError) {

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


        return res.status(200).json({
            analysis
        });


    } catch (error) {

        console.error(
            "ANALYSIS SERVER ERROR:",
            error
        );


        return res.status(500).json({

            error:
                error.message ||
                "Unknown analysis error"

        });

    }

}