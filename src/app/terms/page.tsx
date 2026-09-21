import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { OPERATOR, PRODUCT, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: `Terms of Use · ${PRODUCT}` };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`These terms are the agreement between you and ${OPERATOR} ("we", "us") for using ${PRODUCT} ("SEA"), the service schools use to prepare, approve and publish student results and families use to view them. By creating an account or using SEA you agree to these terms and to our Privacy Policy. If you sign up on behalf of a school, you confirm you are allowed to accept these terms for that school.`}
    >
      <LegalSection heading="1. Accounts">
        <p>SEA has different kinds of accounts: school administrators, teachers, parents or guardians, and platform administrators. What each can see and do depends on its role.</p>
        <ul>
          <li>Give accurate details and keep your password private. Don&apos;t share your login.</li>
          <li>You are responsible for what happens under your account. Tell us at once if you think someone else has used it.</li>
          <li>Teachers and other staff should only be given accounts by their school&apos;s administrator.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. What schools are responsible for">
        <p>A school decides what information goes into SEA and is responsible for it. In particular, a school:</p>
        <ul>
          <li>must have the right to hold and use the student and guardian information it enters, and must tell parents and guardians how it is used;</li>
          <li>is responsible for the accuracy of the scores, grades and remarks it publishes, and for correcting mistakes;</li>
          <li>must make sure only its own staff use its staff accounts.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Subscriptions and payments">
        <ul>
          <li>Schools pay for SEA in Naira, by the term or for a full session. The price and the dates covered are shown before you pay.</li>
          <li>A session runs from 1 September to 31 August. Paying for a term covers your school to the end of that term: 1st Term to 31 December, 2nd Term to 30 April, and 3rd Term to 31 August. A term costs the same whichever part of it you pay in.</li>
          <li>The full session covers every term still to come in that session at a lower price than paying for the terms one by one. It is not offered during 3rd Term (May to July).</li>
          <li>A new school&apos;s first payment may carry a welcome discount. It is shown at checkout and applies to that first payment only.</li>
          <li>We may change our prices. A change applies to payments made after it; it never changes a payment already made or the period it covers.</li>
          <li>Payments are handled by Paystack. We never see or store your card or bank details.</li>
          <li>Subscriptions do not renew automatically. Your school chooses when to pay for the next term.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. When a subscription ends">
        <p>When the period a school has paid for ends, there is a grace period of 7 days. After that, the school&apos;s staff (administrators and teachers) cannot use SEA until the school pays again; administrators can still open the Billing page to renew. Parents and guardians can still see results that were already published, and result verification keeps working. We do not delete a school&apos;s information just because a subscription has ended.</p>
      </LegalSection>

      <LegalSection heading="5. Refunds">
        <p>Payments are not refunded once a term or session has started. If you were charged in error, or charged twice for the same thing, tell us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will refund the wrong or duplicate amount.</p>
      </LegalSection>

      <LegalSection heading="6. Acceptable use">
        <p>Don&apos;t use SEA to break the law, to enter information you have no right to hold, or to publish results you know to be false. Don&apos;t try to see another school&apos;s information, to guess result or verification codes, to overload or interfere with the service, or to copy it in bulk.</p>
      </LegalSection>

      <LegalSection heading="7. Suspension">
        <p>We may suspend a school&apos;s access if it breaks these terms, misuses the service or puts other users at risk. While a school is suspended its staff cannot sign in; parents and guardians can still see results already published. We will tell the school why, and lift the suspension once the problem is fixed.</p>
      </LegalSection>

      <LegalSection heading="8. Your information">
        <p>The information a school enters belongs to the school. We use it only to provide SEA, as set out in our <Link href="/privacy">Privacy Policy</Link>. When a published result is corrected, we keep a record of the change so the history of a result stays trustworthy.</p>
      </LegalSection>

      <LegalSection heading="9. Availability and changes">
        <p>We work to keep SEA available and accurate, but we can&apos;t promise it will never be interrupted or free of errors. We may improve or change features from time to time. If we make a change that materially affects how you use SEA, we will tell you.</p>
      </LegalSection>

      <LegalSection heading="10. Our responsibility">
        <p>To the extent the law allows, we are not responsible for indirect or consequential losses, or for mistakes in the information a school enters or publishes. Our total responsibility to a school for any claim about the service is limited to the amount that school paid us in the 12 months before the claim. Nothing in these terms limits any right you have that the law does not allow to be limited.</p>
      </LegalSection>

      <LegalSection heading="11. Governing law">
        <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </LegalSection>

      <LegalSection heading="12. Changes to these terms, and contact">
        <p>We may update these terms. When we do, we will change the date at the top and, for changes that matter, ask you to agree again. Questions? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
