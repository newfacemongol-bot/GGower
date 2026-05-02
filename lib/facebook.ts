import crypto from 'crypto';

const GRAPH = 'https://graph.facebook.com/v19.0';

export function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret || !signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function sendMessage(pageAccessToken: string, psid: string, message: any): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message, messaging_type: 'RESPONSE' }),
    });
    if (!res.ok) {
      console.error('FB sendMessage error:', await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('FB sendMessage exception:', e);
    return false;
  }
}

export async function sendSenderAction(pageAccessToken: string, psid: string, action: 'typing_on' | 'typing_off' | 'mark_seen'): Promise<void> {
  try {
    await fetch(`${GRAPH}/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, sender_action: action }),
    });
  } catch {
    /* ignore */
  }
}

export async function sendText(pageAccessToken: string, psid: string, text: string, quickReplies?: string[]): Promise<boolean> {
  const message: any = { text };
  if (quickReplies && quickReplies.length) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: 'text',
      title: q.slice(0, 20),
      payload: q,
    }));
  }
  return sendMessage(pageAccessToken, psid, message);
}

export async function sendCarousel(pageAccessToken: string, psid: string, elements: any[]): Promise<boolean> {
  return sendMessage(pageAccessToken, psid, {
    attachment: {
      type: 'template',
      payload: { template_type: 'generic', elements: elements.slice(0, 10) },
    },
  });
}

export async function sendImage(pageAccessToken: string, psid: string, url: string): Promise<boolean> {
  return sendMessage(pageAccessToken, psid, {
    attachment: { type: 'image', payload: { url, is_reusable: true } },
  });
}

export async function replyToComment(pageAccessToken: string, commentId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${commentId}/comments?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function reactToComment(
  pageAccessToken: string,
  commentId: string,
  type: 'LIKE' | 'LOVE' = 'LIKE',
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${commentId}/reactions?access_token=${pageAccessToken}&type=${type}`, {
      method: 'POST',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchUserProfile(pageAccessToken: string, psid: string): Promise<{ first_name?: string; last_name?: string } | null> {
  try {
    const res = await fetch(`${GRAPH}/${psid}?fields=first_name,last_name&access_token=${pageAccessToken}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
