export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({
                error: "No audio provided"
            });
        }

        const audioBuffer = Buffer.from(
            audio,
            "base64"
        );

        const formData = new FormData();

        const audioBlob = new Blob(
            [audioBuffer],
            { type: "audio/webm" }
        );

        formData.append(
            "file",
            audioBlob,
            "speech.webm"
        );

        formData.append(
            "model",
            "gpt-4o-mini-transcribe"
        );

        formData.append(
            "prompt",
            `Transcribe the speech exactly as spoken.

IMPORTANT:
- Preserve filler words.
- Preserve disfluencies.
- Do NOT remove "um", "uh", "umm", "uhh".
- Preserve repeated words.
- Preserve false starts when possible.
- Do not clean up or summarize the speech.
- Return only the transcript.`
        );

        const response = await fetch(
            "https://api.openai.com/v1/audio/transcriptions",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${process.env.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}`
                },

                body: formData
            }
        );

        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "OpenAI error:",
                errorText
            );

            return res.status(
                response.status
            ).json({
                error:
                    "Transcription failed"
            });
        }

        const result =
            await response.json();

        return res.status(200).json({
            transcript:
                result.text || ""
        });

    } catch (error) {

        console.error(
            "Transcription error:",
            error
        );

        return res.status(500).json({
            error:
                "Server transcription error"
        });
    }
}