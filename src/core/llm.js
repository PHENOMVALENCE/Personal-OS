export async function maybeGenerateAiSummary(config, payload) {
  if (!config.ai?.enabled || !process.env.OPENAI_API_KEY) {
    return null;
  }

  const timeoutMs = config.ai.timeoutMs || 12000;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.ai.model || "gpt-5.6",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are a concise chief of staff. Summarize the monitoring payload into an executive update with priorities, risks, and next actions. Keep measured facts separate from inferences. Keep it under 180 words."
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
    return extractOutputText(json);
  } catch {
    return null;
  }
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}
