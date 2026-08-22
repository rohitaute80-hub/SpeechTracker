```javascript
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
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },

                body: JSON.stringify({
                    model: "gpt-4o-mini",

                    temperature: 0.65,

                    response_format: {
                        type: "json_object"
                    },

                    messages: [
                        {
                            role: "system",

                            content: `
You are an expert public speaking coach and speech analyst.

Your job is to analyze the user's ACTUAL speech transcript in depth.

Your feedback must be highly specific to what the speaker actually said.

DO NOT give generic public-speaking advice.

DO NOT simply say things like:
- "Be more confident."
- "Practice more."
- "Speak clearly."
- "Use better transitions."

Instead, explain EXACTLY what happened in the speech and what the speaker should change.

==================================================
1. OVERALL SPEECH ANALYSIS
==================================================

Give a detailed overview of the entire speech.

Explain:
- What the speaker was trying to communicate
- The main ideas
- How the speech developed from beginning to end
- Whether the speech had a clear direction
- Whether the ideas built logically
- The strongest overall aspect
- The biggest weakness
- How effective the speech was overall

Reference specific ideas or wording from the transcript whenever possible.

==================================================
2. IDENTIFY THE SPEECH SECTIONS
==================================================

Break the speech into meaningful sections based on the ACTUAL CONTENT.

Do NOT force the speech into predefined sections if they do not exist.

For example, a speech might naturally contain:
- Opening / introduction
- First argument
- Explanation
- Example
- Second argument
- Counterargument
- Conclusion

But another speech may have completely different sections.

For EACH section:

- Give it a short descriptive title
- Explain what the speaker was doing in that section
- Explain what worked
- Explain what could be improved
- Mention specific wording or ideas from the transcript
- Explain whether the section connected well to the next section

Be detailed.

==================================================
3. FILLER WORDS
==================================================

Look carefully for filler words and hesitation phrases, including:

"um"
"uh"
"umm"
"uhh"
"like"
"you know"
"basically"
"actually"
"so"
"I mean"
"kind of"
"sort of"

Only discuss words that actually appear in the transcript.

If possible:
- Identify which fillers appeared most frequently
- Explain where they occurred
- Explain whether they seemed to happen during transitions, explanations, uncertainty, etc.
- Point out particularly noticeable clusters
- Suggest a specific replacement behavior

Do NOT criticize a word simply because it is technically a filler.

==================================================
4. CLARITY AND WORDING
==================================================

Analyze:
- Unclear sentences
- Vague wording
- Long sentences
- Repeated ideas
- Awkward phrasing
- Unnecessary words
- Ideas that were difficult to follow
- Places where a simpler sentence would work better

Give specific examples from the transcript.

==================================================
5. ORGANIZATION AND TRANSITIONS
==================================================

Analyze how ideas connect.

Look for:
- Strong transitions
- Abrupt topic changes
- Missing transitions
- Repeated points
- Sections that could be reordered
- Ideas that appear before they are properly introduced
- Conclusions that do or do not tie back to the main message

Give concrete suggestions.

==================================================
6. DELIVERY INDICATORS FROM THE TRANSCRIPT
==================================================

Since you only have the transcript, do not pretend you can hear tone, volume, facial expressions, or body language.

However, you MAY analyze transcript-based indicators such as:
- Hesitation
- Self-correction
- Repeated phrases
- Sentence fragments
- Long verbal constructions
- Excessive qualifiers
- Verbal uncertainty
- Conversational habits

Clearly distinguish these from things that cannot be determined from text.

==================================================
7. SPECIFIC STRENGTH
==================================================

Identify the most meaningful thing the speaker did well.

It must be based on the actual transcript.

Explain WHY it worked.

==================================================
8. MOST IMPORTANT IMPROVEMENT
==================================================

Identify the single highest-impact improvement.

Be extremely specific.

Instead of:
"Use fewer filler words."

Say something like:
"During the explanation of X, you repeatedly used 'um' before introducing each new idea. Instead of filling that gap, finish the previous sentence, pause silently for a moment, and then start the next idea."

==================================================
9. PRACTICAL NEXT STEP
==================================================

Give one concrete exercise the speaker can use in their next practice session.

The exercise should directly address something found in THIS transcript.

==================================================
10. PRIORITY RANKING
==================================================

Give the speaker their top 3 improvements in order of importance.

Each improvement should explain:
- What to change
- Why it matters
- What to do differently

==================================================

IMPORTANT:

The analysis should feel like a real coach watched the entire speech and took detailed notes.

Do NOT repeat the same advice in every section.

Do NOT make up information that is not present in the transcript.

Do NOT claim to know things that cannot be determined from a transcript.

Be constructive but honest.

Return ONLY valid JSON.

The JSON must contain exactly these fields:

{
    "overall": "...",
    "sections": [
        {
            "title": "...",
            "overview": "...",
            "strength": "...",
            "improvement": "...",
            "transition": "..."
        }
    ],
    "fillerWords": "...",
    "clarity": "...",
    "organization": "...",
    "delivery": "...",
    "strength": "...",
    "improvement": "...",
    "tip": "...",
    "priorities": [
        {
            "priority": 1,
            "change": "...",
            "why": "...",
            "how": "..."
        },
        {
            "priority": 2,
            "change": "...",
            "why": "...",
            "how": "..."
        },
        {
            "priority": 3,
            "change": "...",
            "why": "...",
            "how": "..."
        }
    ]
}

Do not use markdown.

Do not put JSON inside a code block.

Do not add any text outside the JSON.
`
                        },

                        {
                            role: "user",

                            content: `
Here is the speech transcript:

${transcript}
`
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

        const organization =
            typeof analysis.organization === "string"
                ? analysis.organization
                : "";

        const delivery =
            typeof analysis.delivery === "string"
                ? analysis.delivery
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
        // SAFELY GET SECTIONS
        // --------------------------------------------------------

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
                                : "Section",

                        overview:
                            typeof section.overview === "string"
                                ? section.overview
                                : "",

                        strength:
                            typeof section.strength === "string"
                                ? section.strength
                                : "",

                        improvement:
                            typeof section.improvement === "string"
                                ? section.improvement
                                : "",

                        transition:
                            typeof section.transition === "string"
                                ? section.transition
                                : ""
                    }))
                : [];

        // --------------------------------------------------------
        // SAFELY GET PRIORITIES
        // --------------------------------------------------------

        const priorities =
            Array.isArray(analysis.priorities)
                ? analysis.priorities
                    .filter(
                        priority =>
                            priority &&
                            typeof priority === "object"
                    )
                    .map((priority, index) => ({
                        priority:
                            Number.isFinite(
                                Number(priority.priority)
                            )
                                ? Number(priority.priority)
                                : index + 1,

                        change:
                            typeof priority.change === "string"
                                ? priority.change
                                : "",

                        why:
                            typeof priority.why === "string"
                                ? priority.why
                                : "",

                        how:
                            typeof priority.how === "string"
                                ? priority.how
                                : ""
                    }))
                : [];

        // --------------------------------------------------------
        // MAKE SURE SOMETHING ACTUALLY CAME BACK
        // --------------------------------------------------------

        const basicSections = [
            overall,
            fillerWords,
            clarity,
            organization,
            delivery,
            strength,
            improvement,
            tip
        ].filter(Boolean);

        if (
            basicSections.length === 0 &&
            sections.length === 0
        ) {
            return res.status(500).json({
                error:
                    "OpenAI returned an empty analysis",

                details:
                    JSON.stringify(analysis)
            });
        }

        // --------------------------------------------------------
        // FORMAT FOR EXISTING SCRIPT.JS
        // --------------------------------------------------------

        const formattedParts = [];

        if (overall) {
            formattedParts.push(
                `Overall:\n${overall}`
            );
        }

        // --------------------------------------------------------
        // SECTION-BY-SECTION ANALYSIS
        // --------------------------------------------------------

        if (sections.length > 0) {
            const sectionText = sections
                .map((section, index) => {
                    const parts = [];

                    parts.push(
                        `${index + 1}. ${section.title}`
                    );

                    if (section.overview) {
                        parts.push(
                            `What happened:\n${section.overview}`
                        );
                    }

                    if (section.strength) {
                        parts.push(
                            `What worked:\n${section.strength}`
                        );
                    }

                    if (section.improvement) {
                        parts.push(
                            `What to improve:\n${section.improvement}`
                        );
                    }

                    if (section.transition) {
                        parts.push(
                            `Transition:\n${section.transition}`
                        );
                    }

                    return parts.join("\n\n");
                })
                .join("\n\n");

            formattedParts.push(
                `Speech Sections:\n${sectionText}`
            );
        }

        if (fillerWords) {
            formattedParts.push(
                `Filler Words:\n${fillerWords}`
            );
        }

        if (clarity) {
            formattedParts.push(
                `Clarity:\n${clarity}`
            );
        }

        if (organization) {
            formattedParts.push(
                `Organization:\n${organization}`
            );
        }

        if (delivery) {
            formattedParts.push(
                `Delivery:\n${delivery}`
            );
        }

        if (strength) {
            formattedParts.push(
                `Strength:\n${strength}`
            );
        }

        if (improvement) {
            formattedParts.push(
                `Most Important Improvement:\n${improvement}`
            );
        }

        if (tip) {
            formattedParts.push(
                `Practice Tip:\n${tip}`
            );
        }

        // --------------------------------------------------------
        // PRIORITY IMPROVEMENTS
        // --------------------------------------------------------

        if (priorities.length > 0) {
            const priorityText = priorities
                .map(priority => {
                    return [
                        `${priority.priority}. ${priority.change}`,
                        priority.why
                            ? `Why it matters:\n${priority.why}`
                            : "",
                        priority.how
                            ? `How to improve:\n${priority.how}`
                            : ""
                    ]
                        .filter(Boolean)
                        .join("\n\n");
                })
                .join("\n\n");

            formattedParts.push(
                `Top 3 Priorities:\n${priorityText}`
            );
        }

        const formattedAnalysis =
            formattedParts.join("\n\n");

        // --------------------------------------------------------
        // RETURN TO FRONTEND
        // --------------------------------------------------------

        return res.status(200).json({
            analysis: formattedAnalysis,

            analysisData: {
                overall,
                sections,
                fillerWords,
                clarity,
                organization,
                delivery,
                strength,
                improvement,
                tip,
                priorities
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
```
