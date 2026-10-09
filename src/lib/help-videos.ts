// The tutorial videos shown on each role's Help page. The files live in
// public/help/ (voiced and captioned, recorded on a made-up demo school, so
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

// The school admin guide is five short chapters, each a voiced, captioned video with
// the same steps written out. A campus admin sees the first four (the fifth is mostly
// school-wide: billing, domain, closing the account).
export const ADMIN_CHAPTERS: HelpVideo[] = [
  {
    id: "admin-1-getting-started",
    title: "1. Getting started",
    summary: "Sign in, read your dashboard and find your way around the menu.",
    file: "/help/admin-1-getting-started.mp4",
    seconds: 104,
    steps: [
      "Sign in with the email and password you chose, or the ones from your invitation email.",
      "Forgot your password? Select Forgot password under the Sign in button and we email you a link. If you can't open that inbox, write to the support address below.",
      "The dashboard shows your students, results waiting for approval, active campuses and your subscription status.",
      "Under the cards, Results awaiting approval lists every class a teacher has submitted. Select Review to open one.",
      "The menu on the left holds everything: Students, Classes, School profile, Result templates, Results, Published results, Audit log, Billing, Teachers, Team, Notifications, Custom domain and Help.",
    ],
  },
  {
    id: "admin-2-set-up-your-school",
    title: "2. Set up your school",
    summary: "School profile, campuses, classes and students, including importing many students at once.",
    file: "/help/admin-2-set-up-your-school.mp4",
    seconds: 246,
    steps: [
      "School profile: upload your logo, then type your address, phone and support email. These appear at the top of every result. The preview shows how.",
      "Scroll to the sign-off: the principal's name, signature, school stamp and when next term begins. Select Save. Results already published keep the details they were printed with.",
      "Campuses: on the Students page select New campus, type its name and select Add campus. A school with one campus can skip this.",
      "Classes: select Add classes, type the level (for example S S 3), add arms such as A, B for streams, choose the campus and session, then Add class.",
      "Students: filter by campus, class or status. The student code is how parents find results.",
      "Add one student with Add student: name, a unique code, class and the parent's name, phone and email. Profile details such as date of birth and photo are optional.",
      "Import many students: Import students, Download template, fill one row per student (code, first name and last name are required), save as C S V and choose it. Sophie checks every row and shows how many are ready.",
      "If any row has a problem nothing is added. Fix the file and choose it again.",
      "Edit a student to correct details or move them to another class. The student code stays the same.",
    ],
  },
  {
    id: "admin-3-teachers-and-team",
    title: "3. Your teachers and team",
    summary: "Invite teachers and campus admins, change their classes and help someone who lost their email.",
    file: "/help/admin-3-teachers-and-team.mp4",
    seconds: 108,
    steps: [
      "Teachers: see each teacher's email, the classes they manage and whether they are active.",
      "Invite teacher: type the name and email, tick the classes they will manage and Send invite. They get an email to set their own password.",
      "Edit changes the classes a teacher manages. Select Save assignments.",
      "A teacher lost their email? Select Change email, make sure it really is them, and enter the new address. They get a link at the new address and a notice goes to the old one.",
      "Deactivate when a teacher leaves. They can no longer sign in, and their submitted results stay.",
      "Team: invite campus admins, who run day to day work for the campuses you choose but never see school-wide settings.",
    ],
  },
  {
    id: "admin-4-results",
    title: "4. Results: from submitted to published",
    summary: "Review a class, approve it or send it back, publish to parents and correct mistakes.",
    file: "/help/admin-4-results.mp4",
    seconds: 187,
    steps: [
      "Every class needs a result template (the report card layout). The separate template guide shows how to build one.",
      "Results lists the classes teachers have submitted. Select Review.",
      "Check the banner and the class details, then pick each student to see their ratings, attendance and remarks. You can correct a small mistake right there.",
      "Scroll to the scores: totals, grades, positions and remarks are worked out for you.",
      "Preview as parent shows exactly what a parent will see.",
      "Something wrong? Write a clear note in Admin notes and select Send back for corrections.",
      "All right? Select Approve results and confirm. This locks the scores but parents see nothing yet.",
      "Publish makes the results visible to parents and sends each parent a message.",
      "Published results lists everything published. To fix a mistake open the class, select Correct on the student and give a reason. The old version is kept.",
      "Notifications shows every message sent to parents and whether it was delivered.",
    ],
  },
  {
    id: "admin-5-records-and-billing",
    title: "5. Records, billing and settings",
    summary: "The audit log, paying for coverage, a custom web address and where to get help.",
    file: "/help/admin-5-records-and-billing.mp4",
    seconds: 108,
    steps: [
      "Audit log: every submission, send-back, approval, publication and correction, with who, when and why. Filter it, or select Export C S V.",
      "Billing shows how long your school is covered. Terms end in December, April and August. If coverage runs out, staff can only reach Billing until you renew; parents can still see published results.",
      "Add coverage: choose the session and a term, or the full session, then Pay with Paystack. New coverage starts when the current one ends, so paying early loses nothing.",
      "Payment history lists every payment with a receipt you can download.",
      "Custom domain: add a web address that carries your school's name for checking results.",
      "Deletion request is for closing your school's account. It needs approval and can't be undone.",
      "Help has these guides and the support email.",
    ],
  },
];

export const HELP_VIDEOS: Record<string, HelpVideo> = {
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
