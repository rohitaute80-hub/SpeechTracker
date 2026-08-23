export default async function handler(req, res) {
    // ============================================================
    // METHOD CHECK
    // ============================================================

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        // ========================================================
        // CHECK API KEY
        // ========================================================

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel"
            });
        }

        // ========================================================
        // GET TRANSCRIPT
        // ========================================================

        const { transcript } = req.body || {};

        if (
            typeof transcript !== "string" ||
            !transcript.trim()
        ) {
            return res.status(400).json({
                error: "No transcript was provided"
            });
        }

        const cleanTranscript = transcript.trim();

        // ========================================================
        // OPENAI REQUEST
        // ========================================================

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

                    temperature: 0.4,

                    max_completion_tokens: 1800,

                    response_format: {
                        type: "json_schema",

                        json_schema: {
                            name: "speech_analysis",

                            strict: true,

                            schema: {
                                type: "object",

                                additionalProperties: false,

                                properties: {
                                    overall: {
                                        type: "string"
                                    },

                                    sections: {
                                        type: "array",

                                        items: {
                                            type: "object",

                                            additionalProperties: false,

                                            properties: {
                                                sectionName: {
                                                    type: "string"
                                                },

                                                summary: {
                                                    type: "string"
                                                },

                                                whatWorked: {
                                                    type: "string"
                                                },

                                                whatToImprove: {
                                                    type: "string"
                                                },

                                                specificExample: {
                                                    type: "string"
                                                }
                                            },

                                            required: [
                                                "sectionName",
                                                "summary",
                                                "whatWorked",
                                                "whatToImprove",
                                                "specificExample"
                                            ]
                                        }
                                    },

                                    fillerWords: {
                                        type: "object",

                                        additionalProperties: false,

                                        properties: {
                                            summary: {
                                                type: "string"
                                            },

                                            wordsFound: {
                                                type: "array",

                                                items: {
                                                    type: "string"
                                                }
                                            },

                                            advice: {
                                                type: "string"
                                            }
                                        },

                                        required: [
                                            "summary",
                                            "wordsFound",
                                            "advice"
                                        ]
                                    },

                                    clarity: {
                                        type: "string"
                                    },

                                    structure: {
                                        type: "string"
                                    },

                                    delivery: {
                                        type: "string"
                                    },

                                    strengths: {
                                        type: "array",

                                        items: {
                                            type: "string"
                                        }
                                    },

                                    improvements: {
                                        type: "array",

                                        items: {
                                            type: "string"
                                        }
                                    },

                                    tips: {
                                        type: "array",

                                        items: {
                                            type: "string"
                                        }
                                    }
                                },

                                required: [
                                    "overall",
                                    "sections",
                                    "fillerWords",
                                    "clarity",
                                    "structure",
                                    "delivery",
                                    "strengths",
                                    "improvements",
                                    "tips"
                                ]
                            }
                        }
                    },

                    messages: [
                        {
                            role: "system",

                            content: `
You are an expert public speaking coach analyzing a real speech transcript.

Your job is to give highly specific, useful feedback based ONLY on the actual transcript.

Do NOT give generic public-speaking advice.

Analyze the speech as a whole AND break it into meaningful sections.

For example, sections could include:
- Opening
- Introduction of the topic
- Main point 1
- Main point 2
- Main point 3
- Explanation
- Evidence/examples
- Transitions
- Conclusion

Only create sections that actually exist in the transcript.

For every section:
1. Explain what the speaker was doing.
2. Identify what worked.
3. Identify exactly what could be improved.
4. Give a specific example from the transcript.

Be especially attentive to:

- "um"
- "uh"
- "umm"
- "uhh"
- "like"
- "you know"
- "basically"
- "literally"
- "actually"
- repeated words
- repeated ideas
- unnecessary phrases
- rambling
- unclear wording
- vague statements
- overly long sentences
- weak transitions
- abrupt transitions
- unnecessary pauses represented by filler words
- places where the speaker could be more concise
- places where the speaker sounds confident
- strong explanations
- strong examples
- strong organization

IMPORTANT:

If filler words appear, explicitly identify the actual filler words found.

Do not claim that a filler word was used if it does not appear in the transcript.

For filler-word feedback:
- Identify the words actually found.
- Explain where they appear when possible.
- Explain whether they seem to interrupt the flow.
- Give a practical replacement behavior.

The feedback should be pointed.

Instead of:

"Try to use fewer filler words."

Say something like:

"You repeatedly use 'um' immediately before introducing your next idea. Instead of filling that gap with 'um,' pause silently for about a second and then start the next sentence."

For the section analysis, be detailed enough that the speaker can understand exactly what happened in different parts of their speech.

The overall assessment should summarize the most important patterns.

The clarity section should focus on whether ideas are easy to understand.

The structure section should evaluate organization, progression of ideas, transitions, opening, and conclusion.

The delivery section should infer speech-flow characteristics ONLY from the transcript. Do not claim to know tone, volume, facial expressions, or body language because those cannot reliably be determined from text alone.

Strengths should contain several specific strengths when possible.

Improvements should contain several specific, actionable improvements.

Tips should contain practical exercises the speaker can use in their next speech.

Never invent quotes or examples that do not appear in the transcript.

Do not mention that you are an AI.

Return only the structured response matching the supplied JSON schema.
`
                        },

                        {
                            role: "user",

                            content:
                                `Analyze this speech transcript:

${cleanTranscript}`
                        }
                    ]
                })
            }
        );

        // ========================================================
        // READ OPENAI RESPONSE
        // ========================================================

        const responseText = await response.text();

        console.log(
            "OpenAI analysis status:",
            response.status
        );

        console.log(
            "OpenAI raw response:",
            responseText
        );

        // ========================================================
        // CHECK HTTP ERROR
        // ========================================================

        if (!response.ok) {
            let errorDetails = responseText;

            try {
                errorDetails = JSON.parse(responseText);
            } catch {
                // Keep original text
            }

            return res.status(response.status).json({
                error: "OpenAI analysis failed",
                details: errorDetails
            });
        }

        // ========================================================
        // PARSE OPENAI RESPONSE
        // ========================================================

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error(
                "Could not parse OpenAI HTTP response:",
                error
            );

            return res.status(500).json({
                error: "OpenAI returned invalid response data",
                details: responseText
            });
        }

        // ========================================================
        // CHECK FOR REFUSAL
        // ========================================================

        const message = data?.choices?.[0]?.message;

        if (!message) {
            console.error(
                "No message returned:",
                JSON.stringify(data, null, 2)
            );

            return res.status(500).json({
                error: "OpenAI returned no analysis message"
            });
        }

        if (message.refusal) {
            console.error(
                "OpenAI refused analysis:",
                message.refusal
            );

            return res.status(500).json({
                error: "The AI could not analyze this speech",
                details: message.refusal
            });
        }

        // ========================================================
        // GET STRUCTURED CONTENT
        // ========================================================

        const content = message.content;

        if (!content) {
            console.error(
                "OpenAI returned empty content:",
                JSON.stringify(data, null, 2)
            );

            return res.status(500).json({
                error: "OpenAI returned empty analysis"
            });
        }

        // ========================================================
        // PARSE STRUCTURED JSON
        // ========================================================

        let analysis;

        try {
            analysis = JSON.parse(content);
        } catch (error) {
            console.error(
                "Structured analysis could not be parsed:",
                content
            );

            return res.status(500).json({
                error: "The AI analysis could not be parsed",
                details: content
            });
        }

        // ========================================================
        // BASIC VALIDATION
        // ========================================================

        if (
            !analysis ||
            typeof analysis !== "object"
        ) {
            return res.status(500).json({
                error: "OpenAI returned an invalid analysis object"
            });
        }

        // ========================================================
        // SAFE HELPERS
        // ========================================================

        const safeString = (value) => {
            return typeof value === "string"
                ? value.trim()
                : "";
        };

        const safeArray = (value) => {
            return Array.isArray(value)
                ? value.filter(
                    item =>
                        typeof item === "string" &&
                        item.trim()
                )
                : [];
        };

        // ========================================================
        // CLEAN ANALYSIS
        // ========================================================

        const overall =
            safeString(analysis.overall);

        const clarity =
            safeString(analysis.clarity);

        const structure =
            safeString(analysis.structure);

        const delivery =
            safeString(analysis.delivery);

        const strengths =
            safeArray(analysis.strengths);

        const improvements =
            safeArray(analysis.improvements);

        const tips =
            safeArray(analysis.tips);

        const fillerWords =
            analysis.fillerWords &&
            typeof analysis.fillerWords === "object"
                ? {
                    summary:
                        safeString(
                            analysis.fillerWords.summary
                        ),

                    wordsFound:
                        safeArray(
                            analysis.fillerWords.wordsFound
                        ),

                    advice:
                        safeString(
                            analysis.fillerWords.advice
                        )
                }
                : {
                    summary: "",
                    wordsFound: [],
                    advice: ""
                };

        // ========================================================
        // CLEAN SECTIONS
        // ========================================================

        const sections =
            Array.isArray(analysis.sections)
                ? analysis.sections.map(section => ({
                    sectionName:
                        safeString(
                            section?.sectionName
                        ),

                    summary:
                        safeString(
                            section?.summary
                        ),

                    whatWorked:
                        safeString(
                            section?.whatWorked
                        ),

                    whatToImprove:
                        safeString(
                            section?.whatToImprove
                        ),

                    specificExample:
                        safeString(
                            section?.specificExample
                        )
                }))
                : [];

        // ========================================================
        // BUILD FRONTEND-FRIENDLY ANALYSIS
        // ========================================================

        const formattedParts = [];

        if (overall) {
            formattedParts.push(
                `Overall:\n${overall}`
            );
        }

        if (sections.length > 0) {
            const sectionText = sections
                .map((section, index) => {

                    const parts = [];

                    parts.push(
                        `${index + 1}. ${section.sectionName}`
                    );

                    if (section.summary) {
                        parts.push(
                            `Summary:\n${section.summary}`
                        );
                    }

                    if (section.whatWorked) {
                        parts.push(
                            `What Worked:\n${section.whatWorked}`
                        );
                    }

                    if (section.whatToImprove) {
                        parts.push(
                            `What To Improve:\n${section.whatToImprove}`
                        );
                    }

                    if (section.specificExample) {
                        parts.push(
                            `Specific Example:\n${section.specificExample}`
                        );
                    }

                    return parts.join("\n");
                })
                .join("\n\n");

            formattedParts.push(
                `Speech Sections:\n${sectionText}`
            );
        }

        if (
            fillerWords.summary ||
            fillerWords.wordsFound.length > 0 ||
            fillerWords.advice
        ) {
            const fillerParts = [];

            if (fillerWords.summary) {
                fillerParts.push(
                    fillerWords.summary
                );
            }

            if (fillerWords.wordsFound.length > 0) {
                fillerParts.push(
                    `Words found: ${fillerWords.wordsFound.join(", ")}`
                );
            }

            if (fillerWords.advice) {
                fillerParts.push(
                    `Advice:\n${fillerWords.advice}`
                );
            }

            formattedParts.push(
                `Filler Words:\n${fillerParts.join("\n")}`
            );
        }

        if (clarity) {
            formattedParts.push(
                `Clarity:\n${clarity}`
            );
        }

        if (structure) {
            formattedParts.push(
                `Structure:\n${structure}`
            );
        }

        if (delivery) {
            formattedParts.push(
                `Delivery:\n${delivery}`
            );
        }

        if (strengths.length > 0) {
            formattedParts.push(
                `Strengths:\n${strengths
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item}`
                    )
                    .join("\n")}`
            );
        }

        if (improvements.length > 0) {
            formattedParts.push(
                `Improvements:\n${improvements
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item}`
                    )
                    .join("\n")}`
            );
        }

        if (tips.length > 0) {
            formattedParts.push(
                `AI Tips:\n${tips
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item}`
                    )
                    .join("\n")}`
            );
        }

        const formattedAnalysis =
            formattedParts.join("\n\n");

        // ========================================================
        // MAKE SURE ANALYSIS IS NOT EMPTY
        // ========================================================

        if (!formattedAnalysis.trim()) {
            return res.status(500).json({
                error: "OpenAI returned an empty analysis",
                details: analysis
            });
        }

        // ========================================================
        // RETURN RESULT
        // ========================================================

        return res.status(200).json({

            // Existing frontend can continue using this.
            analysis: formattedAnalysis,

            // New structured data for a nicer UI later.
            analysisData: {
                overall,
                sections,
                fillerWords,
                clarity,
                structure,
                delivery,
                strengths,
                improvements,
                tips
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