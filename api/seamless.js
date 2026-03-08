export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { image, mask, apiKey } = req.body;
  if (!image || !apiKey) return res.status(400).json({ error: 'image, apiKey 필요' });

  try {
    const cr = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=55'
      },
      body: JSON.stringify({
        input: {
          image,
          mask,
          prompt: "seamless tileable texture, natural material surface, continuous pattern, no seams",
          steps: 20,
          guidance: 30,
          output_format: "png"
        }
      })
    });

    if (!cr.ok) return res.status(cr.status).json({ error: await cr.text() });

    const pred = await cr.json();
    let outputUrl = null;

    if (pred.status === 'succeeded' && pred.output) {
      outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    } else if (pred.status === 'failed') {
      return res.status(500).json({ error: pred.error || 'failed' });
    } else {
      // 폴링
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const pd = await pr.json();
        if (pd.status === 'succeeded') {
          outputUrl = Array.isArray(pd.output) ? pd.output[0] : pd.output;
          break;
        }
        if (pd.status === 'failed') return res.status(500).json({ error: pd.error || 'failed' });
      }
    }

    if (!outputUrl) return res.status(504).json({ error: '타임아웃' });

    // 이미지를 서버에서 base64로 변환 후 전달 (브라우저 CORS 우회)
    const imgRes = await fetch(outputUrl);
    const buf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const dataURL = `data:image/png;base64,${base64}`;

    return res.status(200).json({ dataURL });

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
