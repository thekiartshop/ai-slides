// api/generate.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, slides = 8 } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const prompt = `
You are a presentation architect. Create a minimal, modern slide deck as JSON.

STRICTLY return ONLY valid JSON with this schema:
{
  "title": string,
  "subtitle": string,
  "slides": [
    { "heading": string, "bullets": [string, ...], "notes": string }
  ]
}

Rules:
- ${slides} content slides (after the title slide).
- Max 5 bullets per slide, each <= 16 words.
- Use concise, high-signal writing.
- No extra text. JSON only.

Topic: "${topic}"
`;

  try {
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) return res.status(500).json({ error: 'HF token not configured' });

    const model = 'Qwen/Qwen2.5-3B-Instruct';
    const hfURL = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;

    const hfRes = await fetch(hfURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 800, temperature: 0.7, return_full_text: false }
      })
    });

    if (!hfRes.ok) {
      const t = await hfRes.text();
      return res.status(502).json({ error: 'HF error', detail: t });
    }

    const out = await hfRes.json();
    const text = Array.isArray(out) && out[0]?.generated_text ? out[0].generated_text : (out?.generated_text || JSON.stringify(out));
    const match = text.match(/\{[\s\S]*\}$/);
    try {
      const json = JSON.parse(match ? match[0] : text);
      return res.status(200).json(json);
    } catch {
      return res.status(200).json(text);
    }
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e) });
  }
};
