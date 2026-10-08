// The tutorial videos shown on each role's Help page. The files live in
// public/help/ (captioned, no voice-over, recorded on a made-up demo school, so
// nothing in them is a real student or school). Keep `steps` in step with what
// the video shows: it is the same walk-through as text, for anyone who can't
// play video or wants to skim.

export type HelpVideo = {
  id: string;
  title: string;
  /** One line on who it is for and what they will be able to do after. */
  summary: string;
  file: string;
  /** Length in seconds, shown as "2 min". */
  seconds: number;
  steps: string[];
};

export const HELP_VIDEOS: Record<string, HelpVideo> = {
  schoolAdmin: {
    id: "school-admin",
    title: "School admin tour",
    summary: "Set up your school and take a class's results from submitted to published.",
    file: "/help/school-admin-guide.mp4",
    seconds: 111,
    steps: [
      "Sign in with the email and password from your invitation.",
      "Dashboard: students, results waiting for approval, campuses and your subscription.",
      "School profile: logo, address and contacts, printed on every result.",
      "Classes, then Students: add each student to a class with a parent contact.",
      "Teachers: invite them and choose their classes. Team: invite campus admins.",
      "Result templates: the report card for each class.",
      "Results: review a submitted class, then approve it or send it back with a note.",
      "Published results are frozen; fix a mistake with a correction and a reason.",
      "Audit log and Billing: who did what, and your coverage and payments.",
    ],
  },
  resultTemplate: {
    id: "result-template",
    title: "Setting up a result template",
    summary: "Build the report card for a class: subjects, marks, grades, attendance and remarks.",
    file: "/help/result-template-guide.mp4",
    seconds: 128,
    steps: [
      "Result templates: every class needs one.",
      "New template, then name it, pick the term and who it applies to.",
      "Add subjects and their score components. Each subject's weights must add up to 100%.",
      "Watch the live preview as you build.",
      "Save draft, then Validate, and fix anything shown in red.",
      "Choose a grading scale, and tick attendance and remarks if you want them.",
      "Add rating categories such as Behaviour.",
      "Activate when you are happy. To change it later, duplicate it into a new draft.",
    ],
  },
  teacher: {
    id: "teacher",
    title: "Teacher tour",
    summary: "Enter your class's scores and submit them for approval.",
    file: "/help/teacher-guide.mp4",
    seconds: 91,
    steps: [
      "Sign in with the email and password you set from your invitation.",
      "My classes: every class assigned to you, with its status.",
      "Open a class to enter results. The progress bar shows who is complete.",
      "Prefer a spreadsheet? Download the score sheet, fill it in and import it back.",
      "Pick a student, then fill in scores, ratings, attendance and remarks. Totals and grades are worked out for you.",
      "Save draft any time; it is saved to your account.",
      "When every student is complete, Submit for approval. The class is locked while it is reviewed.",
      "If it is sent back, the note says what to fix. Change it and submit again.",
    ],
  },
  parent: {
    id: "parent",
    title: "Parent guide",
    summary: "Create your account, link your child and read, print and check their results.",
    file: "/help/parent-guide.mp4",
    seconds: 95,
    steps: [
      "Create your account from your school's parent sign-up link.",
      "Link your child with their student code and full name. Your school gives you the code.",
      "Your dashboard shows the latest published result. Pick between children at the top.",
      "Scores, positions, attendance and remarks are all on the result. Past terms are under Results history.",
      "Print or save as PDF for your records.",
      "Check a result is genuine on the Verify page with its verification code.",
      "No account? Your school's result lookup page works with the student code and full name.",
    ],
  },
};

export function formatLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
