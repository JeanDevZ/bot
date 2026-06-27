import axios from 'axios';

const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const TIMEOUT = 15000;
const MODELO = 'meta-llama/llama-3.1-8b-instruct';

export async function consultarIA(systemPrompt, userPrompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY no configurada');
    return '{}';
  }

  try {
    const { data } = await axios.post(
      `${OPENROUTER_API}/chat/completions`,
      {
        model: MODELO,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/tu-app',
        },
        timeout: TIMEOUT,
      }
    );

    return data.choices?.[0]?.message?.content || '{}';
  } catch (err) {
    console.error('❌ Error en consultarIA:', err.message);
    return '{}';
  }
}
