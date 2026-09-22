export async function maybeGenerateAiSummary(config, payload) {
  if (!config.ai?.enabled || !process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: config.ai.model || "gpt-5.5",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are a concise chief of staff. Summarize the monitoring payload into an executive update with priorities, risks, and next actions. Keep it under 180 words."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(payload)
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.output_text || null;
  } catch (error) {
    return null;
  }
}

