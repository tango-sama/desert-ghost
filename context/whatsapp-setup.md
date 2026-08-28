# WhatsApp Cloud API — setup runbook

Everything needed to take the واتساب inbox from "code is deployed" to
"a real customer message shows up with a draft". Work top to bottom;
each step says how to tell it worked.

Design and boundaries live in `context/architecture-context.md`
("WhatsApp Cloud API" and "AI reply drafting"). This file is the how-to.

---

## 0. Decide the phone number first

A number on the Cloud API **cannot** also be used in the WhatsApp Business
mobile app. This decision is hard to undo mid-setup, so make it now.

| | Which number | What happens |
|---|---|---|
| **Trial (recommended)** | A **new** number | `213662705830` keeps working on the phone exactly as today. Nothing breaks. Only the new number gets AI drafts. |
| **Full switch** | `213662705830` | It disappears from the phone app; all chat moves to `/amelhadj` → واتساب. Existing chat history stays on the phone and does **not** transfer. |

For a first trial, use a new number. Point the site's WhatsApp button at it
later (`waNumber` in site settings) once you trust it.

---

## 1. Meta app + WhatsApp product

1. <https://developers.facebook.com/apps> → your existing app (the one
   running the Pixel/CAPI) or a new **Business**-type app.
2. Add the **WhatsApp** product.
3. Under WhatsApp → **API Setup**, add and verify the phone number from
   step 0.

**Worked when:** the number is listed with a **Phone number ID** next to it.
Copy that ID.

---

## 2. Permanent access token

The token API Setup shows you by default expires in 24 hours — do not use it
for anything but a smoke test.

1. Business Settings → **System Users** → add a system user (Admin).
2. **Add Assets** → your app → full control.
3. **Generate New Token** → select the app → tick
   `whatsapp_business_messaging` **and** `whatsapp_business_management`
   → set expiry to **Never**.

**Worked when:** you have a token that does not say it expires tomorrow.
Copy it once — Meta will not show it again.

---

## 2b. PUBLISH THE APP — the step that silently costs you an evening

**A Meta app in Development mode receives NOTHING but test webhooks.** Meta's
own wording, on the Production setup screen:

> Apps will only be able to receive test webhooks sent from the app dashboard
> while the app is unpublished. No production data, **including from app
> admins, developers or testers**, will be delivered unless the app has been
> published.

This is the cruellest failure mode in the whole setup, because everything
*looks* right: the webhook verifies, the `messages` field shows Subscribed,
and the dashboard's **Test** button delivers a payload end to end. Only real
messages — including ones you send yourself from your own phone, as the app's
own admin — are dropped, with no error anywhere. There is nothing to find in
the logs, because Meta never calls.

Flip **App Mode** from **Development** to **Live** using the toggle at the top
of the app dashboard. If it refuses, it will name what it wants first —
usually a privacy-policy URL under App settings → Basic, and sometimes
business verification.

**Confirm it:** message the number from a phone, then re-check `/api/health` —
`wa-threads` must climb past the count Meta's test left behind. If the test
payload got through but a real message does not, this step is why.

## 3. Firestore rules

The panel reads `wa_threads` with your own admin login, so the rules must
allow it. These rules live with the Cloud Functions project, **not** this
repo. Add this block alongside the existing `orders` / `messages` rules:

```
match /wa_threads/{document=**} { allow read, write: if isAdmin(); }
```

Paste it beside the existing `match /expenses/...` line, inside
`match /databases/{database}/documents`. The recursive `{document=**}` matches
this repo's existing style and covers the `messages` subcollection in the same
line — rules do not cascade, so a plain `match /wa_threads/{waId}` alone would
leave the individual messages unreadable and the threads would render with
empty chat bubbles.

`wa_threads` holds customer phone numbers and message bodies, so it belongs
in the same admin-only class as `orders` and `messages` — anonymous clients
get nothing. The webhook writes with the Admin SDK, which bypasses rules
entirely, so `write` here is only for the panel's own dismiss/mark-read.

Deploy with `firebase deploy --only firestore:rules`.

**Worked when:** an anonymous REST read of `wa_threads` is denied, and the
واتساب tab in the panel stops logging a permissions error.

> Skipping this step is the most likely reason the inbox looks permanently
> empty. It will not announce itself beyond a console error.

---

## 4. Environment variables

Set in Vercel (Project → Settings → Environment Variables), then redeploy —
Vercel only picks up new vars on a fresh build.

| Variable | Where it comes from |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Step 1 |
| `WHATSAPP_ACCESS_TOKEN` | Step 2 |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic → **App Secret** |
| `WHATSAPP_VERIFY_TOKEN` | You invent it. Any random string; step 5 must match. |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> → API Keys |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Already set (Meta CAPI uses it too) |
| `WHATSAPP_GRAPH_VERSION` | Optional; defaults to `v23.0` |

None of these may ever appear in browser code. To confirm after a build:

```
grep -rl "WHATSAPP_ACCESS_TOKEN\|ANTHROPIC_API_KEY\|graph.facebook.com" .next/static | wc -l   # must print 0
```

---

## 5. Webhook

WhatsApp → **Configuration** → Webhook → Edit:

- **Callback URL:** `https://<your-domain>/api/whatsapp`
- **Verify token:** exactly the `WHATSAPP_VERIFY_TOKEN` from step 4
- Then **Manage** → subscribe to the **`messages`** field

Meta calls the URL immediately and expects the challenge echoed back. If it
fails, the token does not match or the deploy predates the env var.

**Worked when:** Meta saves without an error and `messages` shows as
subscribed.

---

## 6. Try it

1. From a personal phone, message the business number.
2. `/amelhadj` → **واتساب** — the conversation appears within a second or two.
3. A 🤖 draft appears shortly after (the model call runs after the webhook
   returns, so it lags the message slightly).
4. Edit if you want, tap **إرسال**, confirm it arrives on the phone.

Ask things the AI should handle well — a product price, delivery cost to a
named wilaya, how to order. Then deliberately ask something out of scope,
like "وين وصل طلبي؟" — it should draft a handoff and badge it
**يحتاج ردّاً منكِ** rather than invent an answer.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Inbox always empty | Step 3 rules not deployed — check the browser console for a permissions error |
| Meta rejects the webhook URL | Verify token mismatch, or the deploy predates the env var |
| Messages arrive, no draft ever | `ANTHROPIC_API_KEY` unset, or the model call failed — check server logs for `[DS] wa draftReply` |
| "انتهت مهلة 24 سا", cannot type | Correct behaviour: WhatsApp only allows free-form replies within 24h of the customer's last message. Needs an approved template to reopen. |
| Customer says they sent a photo, nothing in the panel | **Known gap** — the webhook currently handles text only; non-text messages are skipped silently. See below. |
| Meta's **Test** button arrives, but real messages never do | The app is still in **Development** mode — see §2b. This is the single most misleading failure in the setup: every visible setting is correct and nothing is logged, because Meta never calls. |

---

## Known gaps

- **Non-text messages are dropped.** Images, voice notes and documents are
  skipped by `parseInbound` and never appear in the panel, so there is no
  sign the customer sent anything. This matters more once the panel is the
  only place you read WhatsApp. Fix: store a placeholder (📷 صورة) with
  Meta's media link and skip drafting for those.
- **No template messages.** Once the 24-hour window closes there is no way
  to reopen a conversation from the panel.
- **Draft quality has not been observed against the live model** — it was
  never run with a real API key before deploy. Read the first day's drafts
  before trusting them.
