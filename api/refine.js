export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { text, mode } = req.body;
    
    console.log('=== REFINE REQUEST ===');
    console.log('Text length:', text?.length);
    console.log('Mode:', mode);
    console.log('API Key exists:', !!process.env.GROQ_API_KEY);
    
    if (!text || typeof text !== 'string') {
      console.error('Invalid text input');
      return res.status(400).json({ error: 'Valid text required' });
    }

    if (text.length > 3000) {
      console.error('Text too long:', text.length);
      return res.status(400).json({ error: 'Text must be under 3000 characters' });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('No API key found');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Mode-specific prompts
    const prompts = {
      professional: `Rewrite the following text in a professional, business-ready tone. Keep the meaning the same but make it polished and formal.

Text: ${text}

Professional version:`,
      
      'anxiety-neutralizer': `Rewrite the following text with confident, assertive language. Remove any uncertain or anxious phrasing. Make it sound self-assured.

Text: ${text}

Confident version:`,
      
      legal: `Rewrite the following text in formal, precise legal language. Use appropriate legal terminology.

Text: ${text}

Formal legal version:`
    };

    const prompt = prompts[mode] || prompts.professional;
    
    console.log('Calling Groq API...');

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        stream: false
      })
    });

    console.log('Groq response status:', groqResponse.status);

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorText);
      
      // Better error messages
      if (groqResponse.status === 401) {
        return res.status(500).json({ error: 'API authentication failed. Check server configuration.' });
      }
      if (groqResponse.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      }
      if (groqResponse.status === 503) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
      }
      
      return res.status(500).json({ 
        error: 'AI service error',
        details: `Status: ${groqResponse.status}`
      });
    }

    const data = await groqResponse.json();
    console.log('Groq response received, has choices:', !!data.choices);

    // Extract refined text
    let refined = '';
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      refined = data.choices[0].message.content.trim();
    } else {
      console.error('Unexpected response format:', JSON.stringify(data).substring(0, 200));
      refined = text; // Fallback to original
    }

    // Clean up the response - remove any prompt echo
    const cleanMarkers = [
      'Professional version:',
      'Confident version:',
      'Formal legal version:',
      'Here is',
      'Here\'s'
    ];
    
    for (const marker of cleanMarkers) {
      if (refined.toLowerCase().includes(marker.toLowerCase())) {
        const parts = refined.split(new RegExp(marker, 'i'));
        if (parts.length > 1) {
          refined = parts[1].trim();
        }
      }
    }

    console.log('✅ Success! Refined text length:', refined.length);

    return res.status(200).json({
      refined: refined,
      original: text,
      mode: mode,
      model: 'mixtral-8x7b-32768'
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack?.substring(0, 500));
    
    return res.status(500).json({
      error: 'Server error occurred',
      details: error.message
    });
  }
}
