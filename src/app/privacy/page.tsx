import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { OPERATOR, PRODUCT, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: `Privacy Policy · ${PRODUCT}` };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what information ${PRODUCT} ("SEA") holds, why, who sees it and what your rights are. SEA is operated by ${OPERATOR}. It is written to follow the Nigeria Data Protection Act 2023.`}
    >
      <LegalSection heading="1. Who is responsible for what">
        <p>Schools use SEA to manage their students&apos; results. For the student and result information a school enters, the school decides why and how it is used, and we process it on the school&apos;s behalf, only to provide SEA. For account, billing and security information, we are responsible for it ourselves.</p>
        <p>If you are a parent or guardian and have a question about how your child&apos;s information is used, please start with your child&apos;s school.</p>
      </LegalSection>

      <LegalSection heading="2. What we hold">
        <ul>
          <li><strong>School administrators and teachers:</strong> name, email address, optional phone number, role, the school and campuses you belong to, and your password (kept only as a one-way scrambled value we can&apos;t read back).</li>
          <li><strong>Parents and guardians:</strong> name, email address, phone number where the school provides it, and which children are linked to your account.</li>
          <li><strong>Students (entered by their school):</strong> name, student code, class and campus, and the scores, grades, positions and remarks the school records for each term.</li>
          <li><strong>Payments:</strong> the payment reference, amount, date and status. You enter card or bank details on Paystack&apos;s page; they never reach us.</li>
          <li><strong>Messages:</strong> a record of the emails and text messages we send for a school (for example that a result was published), so we can show whether they were delivered.</li>
          <li><strong>Activity records:</strong> who published, changed or corrected a result and when, so the history of a result can be trusted.</li>
          <li><strong>Technical data:</strong> a scrambled form of your internet address, used only to slow down people trying to guess passwords or result codes, and basic server logs to keep the service running.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Why we use it">
        <ul>
          <li>To provide SEA to schools and families: showing results, sending notifications, managing accounts. (Performing our agreement with the school and its users.)</li>
          <li>To take payment and keep billing records. (Performing our agreement, and meeting accounting duties.)</li>
          <li>To keep the service secure and prevent misuse. (Our legitimate interest in protecting schools and children&apos;s information.)</li>
          <li>To store your agreement to our Terms and this policy when you sign up. (Your consent.)</li>
        </ul>
        <p>We do not sell personal information, and we do not use it for advertising.</p>
      </LegalSection>

      <LegalSection heading="4. Who receives it">
        <p>We use a small number of companies to run SEA. Each receives only what it needs:</p>
        <ul>
          <li><strong>Paystack</strong> — takes payments.</li>
          <li><strong>Termii</strong> — delivers text messages to guardians (the phone number and message).</li>
          <li><strong>Resend</strong> — delivers emails (the email address and message).</li>
          <li><strong>Vercel</strong> — hosts the website.</li>
          <li><strong>Supabase</strong> — stores the database. It is hosted in Europe (Ireland), so information is transferred outside Nigeria; we rely on the provider&apos;s security commitments and contracts to protect it.</li>
        </ul>
        <p>We may also share information where the law requires it.</p>
      </LegalSection>

      <LegalSection heading="5. Who can see a result">
        <p>A student&apos;s results are visible to the staff of that student&apos;s school (according to their role and, for campus administrators, their campus) and to the parents or guardians linked to that student. Someone who has the verification code from a published result can check that result&apos;s authenticity and sees only what that published result shows. Lookups are rate-limited to stop guessing.</p>
      </LegalSection>

      <LegalSection heading="6. Children">
        <p>Most of the information in SEA is about children, so we treat it with particular care. Schools are responsible for having the authority to hold it and for informing parents and guardians. We use children&apos;s information only to provide the service, never for marketing.</p>
      </LegalSection>

      <LegalSection heading="7. How long we keep it">
        <ul>
          <li>Student and result information is kept for as long as the school uses SEA, because the results are the school&apos;s records.</li>
          <li>A school can ask us to delete its information. When we approve the request, we delete or anonymise it.</li>
          <li>Payment records are kept for as long as accounting and tax law require.</li>
          <li>Records of changes to published results are kept for as long as the results themselves.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. How we protect it">
        <ul>
          <li>Connections to SEA are encrypted (HTTPS).</li>
          <li>Passwords are stored as one-way values, and the keys we hold for email, text and payment services are encrypted.</li>
          <li>Access is limited by role, and by campus where a school chooses; each school can see only its own information.</li>
          <li>The database is locked so it can only be reached through SEA.</li>
          <li>A published result is stored as a fixed record; a correction creates a new version and keeps the old one.</li>
        </ul>
        <p>No system is perfectly secure. If a breach affecting your information occurs, we will tell the school and, where the law requires, the Nigeria Data Protection Commission and the people affected.</p>
      </LegalSection>

      <LegalSection heading="9. Your rights">
        <p>You may ask to see the information held about you, to have it corrected or deleted, to limit or object to how it is used, to receive a copy of it, and to withdraw your consent. To do so, write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If the request is about a student&apos;s results, we may pass it to the school, which decides how its students&apos; information is used. If you are not satisfied with our answer, you may complain to the Nigeria Data Protection Commission.</p>
      </LegalSection>

      <LegalSection heading="10. Cookies">
        <p>SEA uses only the cookie needed to keep you signed in. We do not use advertising or tracking cookies.</p>
      </LegalSection>

      <LegalSection heading="11. Changes and contact">
        <p>If we change this policy in a way that matters we will change the date at the top and, where needed, ask you to agree again. See also our <Link href="/terms">Terms of Use</Link>. Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
