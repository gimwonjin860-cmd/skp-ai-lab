export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, input } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'No API key' });

  try {
    const startResp = await fetch('https://api.replicate.com/v1/models/google/nano-banana/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Prefer': 'wait=55'
      },
      body: JSON.stringify({ input })
    });

    const pred = await startResp.json();
    if (pred.error) return res.status(400).json({ error: pred.error });
    if (pred.output) return res.status(200).json({ output: pred.output });

    let status = pred.status;
    let pollData = pred;
    let attempts = 0;
    while (status !== 'succeeded' && status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(pred.urls.get, {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });
      pollData = await pollResp.json();
      status = pollData.status;
      attempts++;
    }

    if (status === 'failed') return res.status(500).json({ error: pollData.error || '생성 실패' });
    if (!pollData.output) return res.status(500).json({ error: '결과 없음' });

    res.status(200).json({ output: pollData.output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
