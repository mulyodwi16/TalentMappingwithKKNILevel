// Multi-turn chat helper untuk endpoint OpenAI-compatible. Provider dipilih dari env
// (prioritas: OpenAI → OpenRouter → MiniMax) — semuanya memakai bentuk /chat/completions.
// Dipakai oleh AI Mentor. Melempar LlmError(status=503) bila tak ada provider terkonfigurasi
// agar route bisa balas 503 rapi.

export class LlmError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

// Resolusi provider aktif dari environment. Kembalikan null bila tak ada key sama sekali.
export function resolveProvider() {
  const e = process.env;
  if (e.OPENAI_API_KEY) {
    return { name: "openai", apiKey: e.OPENAI_API_KEY, baseUrl: e.OPENAI_BASE_URL || "https://api.openai.com/v1", model: e.OPENAI_MODEL || "gpt-4o" };
  }
  if (e.OPENROUTER_API_KEY) {
    return { name: "openrouter", apiKey: e.OPENROUTER_API_KEY, baseUrl: "https://openrouter.ai/api/v1", model: e.OPENROUTER_MODEL || "deepseek/deepseek-chat" };
  }
  if (e.MINIMAX_API_KEY) {
    return { name: "minimax", apiKey: e.MINIMAX_API_KEY, baseUrl: e.MINIMAX_BASE_URL || "https://api.minimax.io/v1", model: e.MINIMAX_MODEL || "MiniMax-M2" };
  }
  return null;
}

export function isLlmConfigured() {
  return !!resolveProvider();
}

/**
 * Panggil chat completions provider aktif.
 * @param {{role:"system"|"user"|"assistant", content:string}[]} messages
 * @param {{temperature?:number, maxTokens?:number, timeoutMs?:number}} opts
 * @returns {Promise<{content:string, usage:{promptTokens:number,completionTokens:number,totalTokens:number}, model:string}>}
 */
export async function chatComplete(messages, opts = {}) {
  const provider = resolveProvider();
  if (!provider) throw new LlmError("Belum ada API key LLM di .env (OPENAI_API_KEY / OPENROUTER_API_KEY / MINIMAX_API_KEY)", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  let res;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        // Header ekstra OpenRouter (diabaikan provider lain).
        "HTTP-Referer": "https://kkni-talent-mapping.local",
        "X-Title": "KKNI Talent Mapping - AI Mentor",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 700,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new LlmError(
      e?.name === "AbortError" ? "Permintaan ke AI Mentor timeout." : `Gagal menghubungi LLM: ${e.message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 400);
    try { msg = JSON.parse(text)?.error?.message ?? msg; } catch { /* raw */ }
    throw new LlmError(`LLM HTTP ${res.status}: ${msg}`, res.status);
  }

  let json;
  try { json = JSON.parse(text); } catch { throw new LlmError("Respons LLM bukan JSON.", 502); }

  const content = json?.choices?.[0]?.message?.content ?? "";
  return {
    content,
    usage: {
      promptTokens: json?.usage?.prompt_tokens ?? 0,
      completionTokens: json?.usage?.completion_tokens ?? 0,
      totalTokens: json?.usage?.total_tokens ?? 0,
    },
    model: json?.model ?? provider.model,
  };
}
