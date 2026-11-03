export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  if (!text) throw new Error(`${fallbackMessage} (HTTP ${response.status}: empty response)`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${fallbackMessage} (HTTP ${response.status}: non-JSON response)`);
  }
}
