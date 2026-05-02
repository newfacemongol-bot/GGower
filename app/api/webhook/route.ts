import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature } from '@/lib/facebook';
import { handleIncoming, handlePostback } from '@/lib/bot';
import { isSpamComment } from '@/lib/comment-filter';
import { extractPhone, extractProductCode } from '@/lib/product-code';
import { reactToComment, hideComment } from '@/lib/facebook';
import { isNegativeComment } from '@/lib/negative-comment';
import { ensureDefaultSettings } from '@/lib/settings';

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
  await ensureDefaultSettings();
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
      const qrPayload = event.message?.quick_reply?.payload;
      if (qrPayload && (qrPayload === 'CHECK_ORDER' || qrPayload === 'NEW_ORDER' || qrPayload === 'OPERATOR_HANDOFF')) {
        await handlePostback(pageId, psid, qrPayload).catch(console.error);
      } else if (event.message?.text) {
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
        const negative = isNegativeComment(text);

        let status: string;
        let hidden = false;
        let scheduledFor: Date | null = null;

        if (phone) {
          status = 'phone_collected';
          hideComment(page.accessToken, v.comment_id, true).catch(() => false);
          reactToComment(page.accessToken, v.comment_id, 'LIKE').catch(() => false);
          hidden = true;
        } else if (negative) {
          status = 'negative_hidden';
          hideComment(page.accessToken, v.comment_id, true).catch(() => false);
          hidden = true;
        } else {
          status = 'queued';
          reactToComment(page.accessToken, v.comment_id, 'LIKE').catch(() => false);
          const mnHour = (new Date().getUTCHours() + 8) % 24;
          const isNight = mnHour >= 22 || mnHour < 9;
          if (isNight) {
            // Defer text reply to next morning 09:00 Mongolia time.
            const nowMs = Date.now();
            const mnNow = new Date(nowMs + 8 * 60 * 60 * 1000);
            const next = new Date(Date.UTC(
              mnNow.getUTCFullYear(),
              mnNow.getUTCMonth(),
              mnNow.getUTCDate(),
              9, 0, 0,
            ));
            // if already past 09:00 MN "today" (i.e. it's 22:00-23:59), push to next day
            if (mnHour >= 9) next.setUTCDate(next.getUTCDate() + 1);
            // convert MN 09:00 -> UTC (subtract 8h)
            scheduledFor = new Date(next.getTime() - 8 * 60 * 60 * 1000);
          } else {
            scheduledFor = new Date(Date.now() + 15000 + Math.floor(Math.random() * 45000));
          }
        }

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
            status,
            scheduledFor,
            replied: hidden,
            repliedAt: hidden ? new Date() : null,
          },
        });
      } catch (e: any) {
        if (e.code !== 'P2002') console.error('Comment queue error:', e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
