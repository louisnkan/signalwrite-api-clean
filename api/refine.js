export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  try {
    const { text, mode } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const prompts = {
      professional: `Rewrite this text in a professional business tone:\n\n${text}\n\nProfessional version:`,
      'anxiety-neutralizer': `Rewrite this text with confident, assertive language:\n\n${text}\n\nConfident version:`,
      legal: `Rewrite this text in formal legal language:\n\n${text}\n\nFormal version:`
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompts[mode] || prompts.professional }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq error:', error);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const refined = data.choices?.[0]?.message?.content?.trim() || text;

    return res.json({ refined, model: 'mixtral-8x7b', mode });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
