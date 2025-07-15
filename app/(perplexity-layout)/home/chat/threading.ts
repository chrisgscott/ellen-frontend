import type { Message, ChatThread } from './types';

/**
 * Convert a flat array of chat `messages` into logical threads.
 * A thread groups one user message together with the subsequent assistant reply (if any).
 *
 * Rules:
 * 1. Messages maintain original chronological order.
 * 2. When a user message is encountered, we gather **all** assistant messages
 *    that appear *until* the next user message (streams or multi-part chunks)
 *    and merge their content.  This is important because the assistant may
 *    respond in several chunks when streaming.
 * 3. If no assistant reply exists yet (e.g. history still streaming), the
 *    `assistantMessage` field is `null` so the UI can show a loader.
 */
export function createThreads(messages: Message[]): ChatThread[] {
  const threads: ChatThread[] = [];

  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role !== 'user') {
      // Skip stray assistant/system messages that precede the first user msg
      i++;
      continue;
    }

    const userMessage = msg;
    i++;

    // Aggregate subsequent assistant parts until next user or end
    let assistantMessage: Message | null = null;
    while (i < messages.length && messages[i].role === 'assistant') {
      if (!assistantMessage) {
        assistantMessage = { ...messages[i] };
      } else {
        // concatenate streaming chunks for robustness
        assistantMessage.content += messages[i].content;
        // merge arrays if present
        assistantMessage.related_materials = [
          ...(assistantMessage.related_materials || []),
          ...(messages[i].related_materials || []),
        ];
        assistantMessage.suggested_questions = [
          ...(assistantMessage.suggested_questions || []),
          ...(messages[i].suggested_questions || []),
        ];
        assistantMessage.sources = [
          ...(assistantMessage.sources || []),
          ...(messages[i].sources || []),
        ];
      }
      i++;
    }

    threads.push({
      userMessage,
      assistantMessage,
      sources: assistantMessage?.sources || [],
      materials: assistantMessage?.related_materials || [],
      suggestions: assistantMessage?.suggested_questions || [],
    });
  }

  return threads;
}
