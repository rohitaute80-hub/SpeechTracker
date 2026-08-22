export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        // =====================================================
        // CHECK API KEY
        // =====================================================

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel"
            });
        }


        // =====================================================
        // GET TRANSCRIPT
        // =====================================================

        const { transcript } = req.body || {};

        if (
            typeof transcript !== "string" ||
            !transcript.trim()
        ) {
            return res.status(400).json({
                error: "No transcript was provided"
            });
        }


        // =====================================================
        // CALL OPENAI
        // =====================================================

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

                    response_format: {
                        type: "json_object"
                    },

                    messages: [

                        {
                            role: "system",

                            content: `
You are an expert public speaking coach.

Analyze the user's speech transcript extremely carefully.

Your feedback MUST be based on the actual transcript.

Do NOT give generic public-speaking advice.

Your job is to give the speaker a detailed, useful review of their speech.

Analyze:

1. OVERALL SPEECH
Give a detailed overview of how the speech went.

2. SPEECH SECTIONS
Break the speech into meaningful sections based on changes in topic, argument, story, example, or idea.

For EACH section:
- identify what the speaker was talking about
- explain what worked
- identify unclear or weak parts
- identify unnecessary repetition or rambling
- explain how the section could be improved
- comment on transitions into or out of the section when relevant

3. FILLER WORDS
Look carefully for:
- um
- uh
- umm
- uhh
- like
- you know
- basically
- literally
- actually

Only discuss filler words that actually appear.

If possible, mention examples from the transcript.

4. CLARITY
Identify specific sentences, phrases, or ideas that were difficult to understand.

Explain exactly how the speaker could make them clearer.

5. ORGANIZATION
Analyze whether the speech has a clear beginning, middle, and ending.

Look for:
- weak introductions
- abrupt topic changes
- missing transitions
- repeated points
- ideas that appear out of order
- weak conclusions

6. CONCISENESS
Identify places where the speaker could say the same thing more efficiently.

7. STRENGTHS
Identify specific things the speaker did well.

8. MOST IMPORTANT IMPROVEMENT
Give the single most important change this speaker should make.

9. PRACTICAL TIP
Give one specific exercise or technique tailored to this speech.

IMPORTANT:

The feedback should be specific.

Do not say things like:
"Work on your confidence."
"Practice more."
"Use better transitions."

Instead explain exactly WHAT the speaker should change and WHY.

Return ONLY valid JSON.

The JSON must have exactly these fields:

{
    "overall": "Detailed overall assessment.",
    "sections": [
        {
            "title": "Section name",
            "summary": "What this section was about.",
            "whatWorked": "What worked well.",
            "whatToImprove": "Specific problems and improvements.",
            "transition": "Feedback on the transition involving this section."
        }
    ],
    "fillerWords": "Specific feedback about filler words actually found.",
    "clarity": "Specific feedback about clarity and wording.",
    "organization": "Specific feedback about organization and flow.",
    "conciseness": "Specific feedback about unnecessary words, repetition, or rambling.",
    "strengths": "Specific strengths demonstrated in this transcript.",
    "improvement": "The single most important improvement the speaker should make.",
    "tip": "One practical exercise or speaking technique tailored to this transcript."
}

Do not use Markdown.

Do not wrap the JSON in backticks.

Do not add any text before or after the JSON.
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


        // =====================================================
        // READ OPENAI RESPONSE
        // =====================================================

        const responseText = await response.text();

        console.log(
            "OpenAI analysis status:",
            response.status
        );

        console.log(
            "OpenAI raw response:",
            responseText
        );


        // =====================================================
        // OPENAI ERROR
        // =====================================================

        if (!response.ok) {

            return res.status(response.status).json({
                error: "OpenAI analysis failed",
                details: responseText
            });

        }


        // =====================================================
        // PARSE OPENAI API RESPONSE
        // =====================================================

        let data;

        try {

            data = JSON.parse(responseText);

        } catch (error) {

            console.error(
                "Could not parse OpenAI API response:",
                error
            );

            return res.status(500).json({
                error: "OpenAI returned invalid API JSON",
                details: responseText
            });

        }


        // =====================================================
        // GET MODEL CONTENT
        // =====================================================

        const content =
            data?.choices?.[0]?.message?.content;


        if (!content) {

            console.error(
                "No model content:",
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
            "Model analysis content:",
            content
        );


        // =====================================================
        // SAFELY PARSE MODEL JSON
        // =====================================================

        let analysis;

        try {

            analysis = JSON.parse(content);

        } catch (firstError) {

            console.error(
                "First JSON parse failed:",
                firstError
            );

            // -----------------------------------------------
            // FALLBACK: remove accidental Markdown fences
            // -----------------------------------------------

            let cleaned = content.trim();

            cleaned = cleaned
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();


            try {

                analysis = JSON.parse(cleaned);

            } catch (secondError) {

                console.error(
                    "Second JSON parse failed:",
                    secondError
                );

                console.error(
                    "Invalid model content:",
                    content
                );

                return res.status(500).json({
                    error:
                        "The AI analysis JSON was invalid",
                    details:
                        content
                });

            }
        }


        // =====================================================
        // VERIFY OBJECT
        // =====================================================

        if (
            !analysis ||
            typeof analysis !== "object" ||
            Array.isArray(analysis)
        ) {

            return res.status(500).json({
                error:
                    "OpenAI returned an invalid analysis object"
            });

        }


        // =====================================================
        // SAFE FIELDS
        // =====================================================

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


        const organization =
            typeof analysis.organization === "string"
                ? analysis.organization
                : "";


        const conciseness =
            typeof analysis.conciseness === "string"
                ? analysis.conciseness
                : "";


        const strengths =
            typeof analysis.strengths === "string"
                ? analysis.strengths
                : "";


        const improvement =
            typeof analysis.improvement === "string"
                ? analysis.improvement
                : "";


        const tip =
            typeof analysis.tip === "string"
                ? analysis.tip
                : "";


        // =====================================================
        // SECTIONS
        // =====================================================

        const sections =
            Array.isArray(analysis.sections)
                ? analysis.sections
                    .filter(
                        section =>
                            section &&
                            typeof section === "object"
                    )
                    .map(section => ({
                        title:
                            typeof section.title === "string"
                                ? section.title
                                : "Speech Section",

                        summary:
                            typeof section.summary === "string"
                                ? section.summary
                                : "",

                        whatWorked:
                            typeof section.whatWorked === "string"
                                ? section.whatWorked
                                : "",

                        whatToImprove:
                            typeof section.whatToImprove === "string"
                                ? section.whatToImprove
                                : "",

                        transition:
                            typeof section.transition === "string"
                                ? section.transition
                                : ""
                    }))
                : [];


        // =====================================================
        // MAKE SURE SOMETHING CAME BACK
        // =====================================================

        const hasAnalysis =
            overall ||
            fillerWords ||
            clarity ||
            organization ||
            conciseness ||
            strengths ||
            improvement ||
            tip ||
            sections.length > 0;


        if (!hasAnalysis) {

            return res.status(500).json({
                error:
                    "OpenAI returned an empty analysis",
                details:
                    JSON.stringify(analysis)
            });

        }


        // =====================================================
        // FORMAT TEXT FOR EXISTING FRONTEND
        // =====================================================

        const formattedSections =
            sections
                .map(section => {

                    return [

                        section.title
                            ? `${section.title}\n${section.summary}`
                            : "",

                        section.whatWorked
                            ? `What worked:\n${section.whatWorked}`
                            : "",

                        section.whatToImprove
                            ? `What to improve:\n${section.whatToImprove}`
                            : "",

                        section.transition
                            ? `Transition:\n${section.transition}`
                            : ""

                    ]
                        .filter(Boolean)
                        .join("\n\n");

                })
                .filter(Boolean)
                .join("\n\n---\n\n");


        const formattedAnalysis = [

            overall
                ? `Overall:\n${overall}`
                : "",

            formattedSections
                ? `Speech Sections:\n\n${formattedSections}`
                : "",

            fillerWords
                ? `Filler Words:\n${fillerWords}`
                : "",

            clarity
                ? `Clarity:\n${clarity}`
                : "",

            organization
                ? `Organization:\n${organization}`
                : "",

            conciseness
                ? `Conciseness:\n${conciseness}`
                : "",

            strengths
                ? `Strengths:\n${strengths}`
                : "",

            improvement
                ? `Most Important Improvement:\n${improvement}`
                : "",

            tip
                ? `Speaking Tip:\n${tip}`
                : ""

        ]
            .filter(Boolean)
            .join("\n\n");


        // =====================================================
        // RETURN RESULT
        // =====================================================

        return res.status(200).json({

            analysis: formattedAnalysis,

            analysisData: {

                overall,

                sections,

                fillerWords,

                clarity,

                organization,

                conciseness,

                strengths,

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