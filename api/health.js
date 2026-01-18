export default function handler(req, res) {
  res.json({ 
    status: 'online',
    apiKey: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString()
  });
}
