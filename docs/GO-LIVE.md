# Going live with Sophie Educational Assistant

This is the list of things to finish before real schools pay and real parents get messages. Work through it in order. When you are done, the **Go-live** page in the owner area (`/owner/readiness`) should show everything **Ready**. Anything it says **Can't check** is on the "confirm yourself" list at the bottom of that page.

Steps marked **You** need your accounts or your bank. Steps marked **Ask Claude** are things I can do for you once you tell me it's time.

---

## 1. Take real payments (Paystack)

1. **You** — Activate your Paystack business: in the Paystack dashboard, follow the "Go live" steps (business details, documents, and the bank account your money is paid into). Paystack reviews it; this can take a few days.
2. **You** — Switch the dashboard to **Live mode**. Under *Settings → API Keys & Webhooks*, copy the **live secret key** (it starts `sk_live_`) and the live public key.
3. **You** — In SEA open *Global settings → Paystack → Update key* and paste them in. The Go-live page's first Paystack line turns green.
4. **You** — In the same Paystack page, set the **Webhook URL** (live mode) to the address shown at the bottom of the Go-live page. It looks like `https://<your site>/api/webhooks/paystack`. This is how SEA finds out a payment went through even if the school closes the browser tab. The Go-live page shows it as working after the first payment notification arrives.

You do not set a callback address in Paystack; SEA sends it with every payment.

## 2. Your own domain and email

Until this is done, emails come from Resend's test address, which only delivers to your own Resend account. Password resets and result alerts will not reach real people.

1. **You** — Register the domain (for example `sophie-ea.app`) at a registrar.
2. **You** — In Resend open *Domains → Add domain*, then add the DNS records it shows (at your registrar) and press **Verify**. This can take from a few minutes to a day.
3. **You** — In SEA open *Global settings → Email (Resend)* and set the sender to something like `Sophie Educational Assistant <noreply@your-domain>`.
   - Tip: the Go-live page can only confirm your domain is verified if the Resend key is a **full-access** key. A send-only key sends email fine, and the page will then say "Can't check" — in that case just check *Domains* in Resend shows **Verified**.
4. **You** — Set up the mailbox `support@your-domain` (your registrar or an email host can forward it to you). The Terms and Privacy Policy tell people to write there.

## 3. Put the site on your domain

1. **You** — In Vercel: *Project → Settings → Domains → Add* your domain (and `www`), then add the DNS records Vercel shows.
2. **Ask Claude** — I will change `NEXTAUTH_URL` in Vercel to the new address and redeploy, so links in emails and the payment return page use it.
3. **You** — Change the Paystack webhook URL (step 1.4) to the new address.

## 3b. Text messages (SMS)

1. **You** — In Termii open *Sender IDs*, request the name you want guardians to see (for example `SEA`), and wait for approval (usually 1–3 business days).
2. **You** — Make sure the same name is set under *Global settings → SMS (Termii)*. The Go-live page shows when it is approved.

## 4. Paid plans for the services SEA runs on

- **Vercel** — the free *Hobby* plan is for non-commercial projects. Move to **Pro**.
- **Supabase** — the free plan pauses after a week of inactivity and has no daily backups. Move to a **paid plan** before real school data goes in, then check backups are on.

## 5. Practise a real payment (cheaply)

Do this **before any real school exists**, or at a quiet time, because prices apply to everyone while you test.

1. In *Global settings → Subscription pricing* set **Term price** to **₦1,000** and **New-school discount** to **₦0**. Save.
2. Sign up a practice school at `/signup` with an email you control, and pay the ₦1,000 with a real card.
3. Check: the payment succeeds, the school's Billing page shows the new term with the right dates, and on the Go-live page **Paystack payment notifications reach us** is now green.
4. In the Paystack dashboard, **refund** the ₦1,000.
5. **Immediately set the prices back** to your real ones (₦50,000 term, ₦10,000 new-school discount, 20% full-session discount) and Save. Confirm the preview shows ₦50,000 / ₦40,000 / ₦120,000.
6. Suspend the practice school from *Schools* so it does not linger.

## 6. Clean out test data

Open the **Schools in the database** table on the Go-live page. Anything that is not a real school (test or demo schools, "QA" schools): suspend it from its page under *Schools*. If you want one removed from the database completely, tell me and I will do it.

## 7. Security housekeeping

- Change the **Supabase database password** (it has been typed into chat during development). Tell me when you have, and I will update Vercel and redeploy straight away so the site is only down for a moment.
- Turn on **two-step sign-in** for Vercel, Supabase, GitHub, Paystack, Resend and Termii.
- Only the people who must have access should be members of the Vercel project and the Supabase project.

## 8. The legal pages

- **You** — Have a Nigerian lawyer read the **Terms of Use** (`/terms`) and **Privacy Policy** (`/privacy`). They were drafted from how SEA really works, but they are not legal advice.
- **You** — Ask the lawyer whether Unisoft Technologies needs to **register with the Nigeria Data Protection Commission** under the Nigeria Data Protection Act 2023, and whether the company's registration details or address should appear on the pages.
- If the pages change in a way people should agree to again, change `LEGAL_VERSION` in `src/lib/legal.ts` (each person's acceptance is stored with the version they agreed to).

## 9. Launch

1. Open the Go-live page. Everything should be **Ready** (or on the "confirm yourself" list, done).
2. Invite your first schools with the sign-up link. Tell them: pay for a term, add campuses and classes, invite teachers, then publish.
3. Watch the Go-live page and the schools' Notifications pages for the first week for anything failing.
