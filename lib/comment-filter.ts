const BOT_TEXTS = new Set(['test', '👍', '😍', '❤️', '🔥', 'ok', '+1']);

export function isSpamComment(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;
  if (BOT_TEXTS.has(t.toLowerCase())) return true;
  const emojiOnly = /^[\p{Emoji}\s]+$/u.test(t);
  if (emojiOnly) return true;
  return false;
}

export function pickRandomReply(replies: string[], name?: string): string {
  if (!replies.length) return 'Сайн байна уу! Мессеж илгээнэ үү.';
  const reply = replies[Math.floor(Math.random() * replies.length)];
  return reply.replace('{name}', name || '').replace(/\s+/g, ' ').trim();
}

export function randomDelayMs(): number {
  return 15000 + Math.floor(Math.random() * 45000);
}
