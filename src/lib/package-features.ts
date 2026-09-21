// What a subscription includes, as shown to a school before it pays (sign-up
// and Billing). Only things the platform does today — no limits are claimed,
// because none are enforced. Edit the wording here; nothing else needs to change.

export const PACKAGE_FEATURES: { title: string; text: string }[] = [
  { title: "Result cards for every class", text: "Design each class's result card once — subjects, score columns, grading and remarks. Changes are versioned, so published results never shift under you." },
  { title: "Fast score entry", text: "Teachers enter scores for their own classes or import them from a spreadsheet (CSV). Totals, grades and class positions are worked out for you." },
  { title: "Publish with a verification code", text: "Published results carry a code anyone can check on your school's verification page, so a result card can't be faked." },
  { title: "Parent portal", text: "Parents sign up with your school's link, see their children's published results and print them." },
  { title: "Result notifications", text: "Parents and staff are notified by email and SMS when results are published." },
  { title: "Annual summary", text: "Combine the three terms into a yearly result, with your own weighting and positions." },
  { title: "Corrections and audit trail", text: "Amend a published result when needed; every change is recorded and can be reviewed in the audit log." },
  { title: "Campuses and your team", text: "Run several campuses, and give campus administrators access to their own campus only." },
];

/** Shown under the list, so nobody is surprised by how coverage works. */
export const COVERAGE_NOTE = "Each term is covered to the end of the school term — 1st Term to 31 December, 2nd Term to 30 April, 3rd Term to 31 August. Parents can always see results that have already been published.";
