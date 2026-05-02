import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature } from '@/lib/facebook';
import { handleIncoming, handlePostback } from '@/lib/bot';
import { isSpamComment } from '@/lib/comment-filter';
import { extractPhone, extractProductCode } from '@/lib/product-code';
import { reactToComment } from '@/lib/facebook';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  if (process.env.FACEBOOK_APP_SECRET && !verifySignature(raw, sig)) {
    return new NextResponse('Invalid signature', { status: 403 });
  }

  const body = JSON.parse(raw);
  if (body.object !== 'page') return NextResponse.json({ ok: true });

  for (const entry of body.entry || []) {
    const pageId = entry.id;

    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      if (!psid) continue;
      if (event.message?.is_echo) continue;
      if (event.message?.text) {
        await handleIncoming(pageId, psid, event.message.text).catch(console.error);
      } else if (event.postback?.payload) {
        await handlePostback(pageId, psid, event.postback.payload).catch(console.error);
      }
    }

    for (const change of entry.changes || []) {
      if (change.field !== 'feed') continue;
      const v = change.value;
      if (v.item !== 'comment' || v.verb !== 'add') continue;
      if (v.from?.id === pageId) continue;

      const text = v.message || '';
      if (isSpamComment(text)) continue;

      const page = await prisma.facebookPage.findUnique({ where: { pageId } });
      if (!page || !page.isActive || !page.autoReplyEnabled) continue;

      try {
        const phone = extractPhone(text);
        reactToComment(page.accessToken, v.comment_id, 'LIKE').catch(() => false);

        await prisma.commentLead.create({
          data: {
            commentId: v.comment_id,
            postId: v.post_id,
            pageId,
            senderName: v.from?.name,
            senderFbId: v.from?.id ?? 'unknown',
            commentText: text,
            extractedPhone: phone,
            productCode: extractProductCode(text),
            status: phone ? 'phone_collected' : 'no_phone',
            replied: true,
            repliedAt: new Date(),
          },
        });
      } catch (e: any) {
        if (e.code !== 'P2002') console.error('Comment queue error:', e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
