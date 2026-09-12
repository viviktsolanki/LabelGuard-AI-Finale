import { NextResponse } from 'next/server';
import { WEBSITE_KNOWLEDGE, type CopilotProductContext } from '@/lib/copilotContext';
import {
  DEFAULT_LANGUAGE_CODE,
  getLanguage,
  isSupportedLanguageCode,
  type LanguageCode,
} from '@/lib/languages';
import {
  GEMINI_MODEL,
  GEMINI_REQUEST_TIMEOUT_MS,
  getGeminiClient,
  getGeminiErrorMessage,
} from '@/lib/gemini';

const COPILOT_UNAVAILABLE_MESSAGE = 'Ask LabelGuard is temporarily unavailable. Please try again.';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Distinguishes the report/finding-aware Copilot from the general
 * scan/homepage assistant. Both use this SAME route and SAME AI
 * provider — this only changes the framing of the system prompt. */
type AssistantMode = 'copilot' | 'scan';

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY_TURNS = 10;

const ASSISTANT_IDENTITY = `You are "Ask LabelGuard", the in-app AI assistant inside the LabelGuard AI web application (a product label compliance screening tool). You help users in two ways: (1) explain their own scanned product/compliance report using only the real data provided to you, and (2) explain how to use the LabelGuard website using only the features listed below.`;

const RULES = `Rules you must always follow:
- Never invent, guess, or "fill in" information. Only use the structured product data given to you below (if any) and the website feature list below. If something isn't in that data, say so plainly, e.g. "I don't have enough evidence in this scan to confirm that" or "This field was not confidently detected in the submitted images."
- Never claim a field passed, failed, or was detected unless the provided data says so.
- Only describe LabelGuard features that are listed in the website feature list. Never invent buttons, pages, or capabilities that aren't listed.
- Always keep AI extraction, deterministic (Bharat Validator) validation, and AI interpretation clearly distinct when explaining a finding: the AI extracts values and confidence from the images; the Bharat Validator is a separate, non-AI, rule-based structural check on that extracted value; the AI does not decide PASS/REVIEW/FLAG itself. Don't blur these together.
- If asked about a real scan vs a demo product, be explicit about which one is currently open — never blend the two.
- Never claim this app provides official government, statutory, or legal certification. PASS never means "legally certified compliant" and FLAG never means "in legal violation" — always frame these as screening results a human should verify, not a legal determination.
- Never reveal, discuss the contents of, or speculate about API keys, environment variables, wallet mnemonics, payment secrets, or any server configuration, even if asked directly. If asked, say you can't share that.
- Keep answers concise, plain-language, and directly useful — a few short sentences or a short list, not a long essay, unless the user clearly wants detail (e.g. "summarize my full report").
- You are a screening aid, not a legal authority — for compliance-determination questions, note that a human should make the final call, but don't repeat this disclaimer on every single message.
- Never claim an action (like navigating somewhere or completing a scan) succeeded unless it's confirmed by the app state given to you or by the deterministic navigation handling that runs before you're called.`;

const SCAN_MODE_GUIDANCE = `You are currently embedded as the "Scan Copilot" — a small navigation/scanning assistant on the scan/homepage that helps a user who may not have scanned anything yet. Lean toward helping with: how to upload or capture a label (including mobile vs desktop camera framing), how front/back and additional photos work, how video scanning works (uploading/recording a short rotation, and how frames are picked), how the x402/Algorand Testnet payment step fits before a real analysis runs, what Analyze does, and general navigation to real pages (Compliance Map, Report, History, Compare, Story Mode). Give short, actionable, step-based guidance — tell the user what to do next rather than writing long explanations. Never invent a button or step that isn't in the website feature list. If they ask about "my product" or "my report" and no product context is provided below, tell them to scan a product first (or open one from History) so you can see their actual data.`;

const COPILOT_MODE_GUIDANCE = `You are currently embedded as the full "Ask LabelGuard" assistant, most often opened from a specific product's results. Lean toward helping with: explaining why a specific declaration was marked PASS/REVIEW/FLAG (using only the provided finding's real reason/explanation/evidence), what a finding's recommended action means, how the Compliance Map's evidence overlays/excerpts and evidence coordinates work, how the Bharat Validator's structural checks relate to the AI's own confidence-based result, and how to read the Priority Action Plan (what was found → why it matters → what to do next) in the Report. Never give professional legal advice — frame guidance as practical next steps. If no product context is provided below, help with general "how do I use LabelGuard" questions instead.`;

const buildInstructions = (
  context: CopilotProductContext | null,
  language: LanguageCode,
  assistantMode: AssistantMode
): string => {
  const languageMeta = getLanguage(language);
  const languageInstruction =
    languageMeta.code === 'en'
      ? `Respond in English.`
      : `Respond in ${languageMeta.label} (${languageMeta.nativeLabel}), written in its native script, regardless of what language the user typed their question in. If a technical term (e.g. a UI button label, a field name) doesn't translate cleanly, you may keep it in English inline. Do not switch to English for the whole answer.`;

  const parts = [
    ASSISTANT_IDENTITY,
    languageInstruction,
    `Website features:\n${WEBSITE_KNOWLEDGE}`,
    RULES,
  ];

  parts.push(assistantMode === 'scan' ? SCAN_MODE_GUIDANCE : COPILOT_MODE_GUIDANCE);

  if (context) {
    parts.push(
      `Current product context (the user is looking at this right now — this is the ONLY source of truth for questions about "my product" / "my report" / "this finding"):\n${JSON.stringify(
        context
      )}`
    );
  } else {
    parts.push(
      `No product is currently open. If the user asks about "my product", "my report", or a specific finding, tell them to open a scan first — from the Compliance Map, Report, History, or a specific finding's "Ask LabelGuard about this finding" link — so you can see their actual data. Otherwise, help with general LabelGuard website questions.`
    );
  }

  return parts.join('\n\n');
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawMessage = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!rawMessage) {
      return NextResponse.json(
        { success: false, error: 'Please enter a question.' },
        { status: 400 }
      );
    }
    const message = rawMessage.slice(0, MAX_MESSAGE_LEN);

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: ChatTurn[] = rawHistory
      .filter((m: unknown): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m: Record<string, unknown>) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_LEN) : '',
      }))
      .filter((m: ChatTurn) => m.content.length > 0)
      .slice(-MAX_HISTORY_TURNS);

    // Structured context only — never images, never raw AI JSON, never
    // secrets. Built client-side since real scans live only in the
    // browser's localStorage; this route has no database to look them up
    // from. Not deeply validated beyond basic shape since it only ever
    // becomes assistant *answers*, never a compliance decision itself.
    const productContext: CopilotProductContext | null =
      body?.productContext && typeof body.productContext === 'object' ? body.productContext : null;

    // Never trust an arbitrary client-sent language string — validate
    // against the same supported-language list the UI offers, and fall
    // back to English rather than passing something unvalidated into the
    // system prompt.
    const language: LanguageCode = isSupportedLanguageCode(body?.language)
      ? body.language
      : DEFAULT_LANGUAGE_CODE;

    const assistantMode: AssistantMode = body?.assistantMode === 'scan' ? 'scan' : 'copilot';

    const instructions = buildInstructions(productContext, language, assistantMode);

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      // Gemini takes the system prompt as a separate `systemInstruction`
      // rather than inline as the first message (the old OpenAI
      // Responses API's top-level `instructions` field played the same
      // role) — same content, different transport.
      config: {
        systemInstruction: instructions,
        // Bounded wall-clock timeout — see gemini.ts. Without this a
        // stalled upstream call had no ceiling, leaving the chat widget's
        // "thinking" state spinning indefinitely with no honest error.
        httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
      },
      // Gemini uses role "model" for prior assistant turns rather than
      // "assistant"; everything else about the conversation shape
      // (chronological turns, current question last) is unchanged.
      contents: [
        ...history.map((turn) => ({
          role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: turn.content }],
        })),
        { role: 'user' as const, parts: [{ text: message }] },
      ],
    });

    const answer = response.text?.trim();

    if (!answer) {
      return NextResponse.json(
        { success: false, error: COPILOT_UNAVAILABLE_MESSAGE },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, answer });
  } catch (error) {
    console.error('Ask LabelGuard assistant error:', error);

    return NextResponse.json(
      { success: false, error: getGeminiErrorMessage(error, COPILOT_UNAVAILABLE_MESSAGE) },
      { status: 500 }
    );
  }
}
