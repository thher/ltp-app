import * as FileSystem from 'expo-file-system';

const API_KEY_PATH = `${FileSystem.documentDirectory}drinkmix_apikey.txt`;

// Obfuscated built-in key — assembled and decoded at runtime
const _a = 'NyYfVRY5RBkxGUB4aD9FFwkeGwYkXBM8cRsFGAJ1DxcdcQA7';
const _b = 'fjAuFBMdDygpbC0tFkUUKV4GHykAACQCAGMqP2UCIQUMQTkK';
const _c = 'NHo2CVslCx4OXCoNMht1NgVZHmxNEikKcDQcRBIFHh4SMhhg';
const _p = 'DM24xMixAppKEY!NorwegianDrink99';

function _resolveBuiltIn(): string {
  const raw = atob(_a + _b + _c);
  return Array.from(raw)
    .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ _p.charCodeAt(i % _p.length)))
    .join('');
}

export async function getApiKey(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(API_KEY_PATH);
    if (info.exists) {
      const key = await FileSystem.readAsStringAsync(API_KEY_PATH);
      if (key.trim()) return key.trim();
    }
  } catch {
    // fall through to built-in
  }
  return _resolveBuiltIn();
}

export async function saveApiKey(key: string): Promise<void> {
  await FileSystem.writeAsStringAsync(API_KEY_PATH, key.trim());
}

export async function deleteApiKey(): Promise<void> {
  try {
    await FileSystem.deleteAsync(API_KEY_PATH, { idempotent: true });
  } catch {
    // ignore
  }
}

export async function scanIngredientsFromImage(imageUri: string): Promise<string[]> {
  const apiKey = await getApiKey();

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Look at this image and identify all alcoholic beverages, spirits, liqueurs, wines, beers, and drink mixers/ingredients you can see.

Return ONLY a JSON array of ingredient names in Norwegian (or English if no Norwegian name exists). Use simple, common ingredient names.

Examples: ["vodka", "rom", "gin", "tequila", "whisky", "limejuice", "triple sec", "campari", "aperol", "vermouth", "sitronsaft", "sukker", "grenadine"]

If you see no recognizable drink ingredients, return an empty array: []

Respond with ONLY the JSON array, nothing else.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('INVALID_API_KEY');
    const err = await response.text();
    throw new Error(`API error: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '[]';

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
    }
  } catch {
    const match = text.match(/\[.*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    }
  }

  return [];
}
