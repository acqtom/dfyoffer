// The Build stage's resources. Each one's default text is in RESOURCE_CONTENT or
// RESOURCE_SECTIONS below, under its key.
window.WEEK1_RESOURCES = [
  { key: 'main-page-code',           title: 'Main page code',           kind: 'code' },
  { key: 'confirmation-page-code',   title: 'Confirmation page code',   kind: 'code' },
  { key: 'vsl-script',               title: 'VSL script',               kind: 'doc' },
  { key: 'ad-scripts',               title: '10x ad scripts',           kind: 'doc' },
  { key: 'confirmation-page-script', title: 'Confirmation page script', kind: 'doc' },
  { key: 'faq-video-script',         title: 'FAQ video script formula', kind: 'doc' },
];

// Onboarding's resources: the offer translation report staff write for each
// client (on the client's page, with Edit → Done).
window.ONBOARDING_RESOURCES = [
  { key: 'offer-translation-report', title: 'Offer translation report', kind: 'doc', label: 'Report', openLabel: 'Read report →' },
];

// Performance & Scale Call resources: the scaling roadmap staff write for each
// client (on the client's page, with Edit → Done).
window.SCALE_RESOURCES = [
  { key: 'scaling-roadmap', title: 'Scaling roadmap', kind: 'doc', label: 'Roadmap', openLabel: 'Read roadmap →' },
];

// Resources every client sees the same version of. Staff edit them on the
// Templates page; on client pages they're read-only.
window.SHARED_RESOURCES = new Set(['faq-video-script']);

// Resources shown as separate boxes, each with its own copy button.
// Users fill them in with Edit; until then the boxes are empty.
window.RESOURCE_SECTIONS = {
  'ad-scripts': {
    note: '5 hooks × 2 bodies = 10 ads. Pair every hook with each body, then end with the CTA.',
    sections: [
      { id: 'hook1', group: 'Hooks', label: 'Hook 1' },
      { id: 'hook2', group: 'Hooks', label: 'Hook 2' },
      { id: 'hook3', group: 'Hooks', label: 'Hook 3' },
      { id: 'hook4', group: 'Hooks', label: 'Hook 4' },
      { id: 'hook5', group: 'Hooks', label: 'Hook 5' },
      { id: 'body1', group: 'Bodies', label: 'Body 1' },
      { id: 'body2', group: 'Bodies', label: 'Body 2' },
      { id: 'cta', group: 'CTA', label: 'CTA' },
    ],
  },
};

// Default text shown when a resource is opened. Placeholder templates for now —
// replace each with the real script or code. Users can edit their own copy,
// which is saved to their account.
window.RESOURCE_CONTENT = {
  'scaling-roadmap': `PLACEHOLDER — your team will fill in your scaling roadmap

1. WHERE YOU ARE NOW
[Ad spend, show rate, close rate, AOV, cash collected and ROAS.]

2. WHAT'S WORKING
[Winning ads, angles and parts of the funnel to double down on.]

3. WHAT TO FIX FIRST
[The biggest bottleneck and how we'll fix it.]

4. YOUR SCALING PLAN
[Budget steps, timeline and the numbers to hit at each step.]

5. NEXT 30 DAYS
[The exact actions for you and for us.]`,

  // Starts empty; staff write each client's report.
  'offer-translation-report': '',

  'main-page-code': `<!-- PLACEHOLDER: replace with the real main page code -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>[Your Offer] — Watch The Free Training</title>
</head>
<body>
  <header>
    <p class="eyebrow">For [who it's for]</p>
    <h1>[Big promise headline]</h1>
  </header>

  <main>
    <div class="vsl">
      <!-- Embed your VSL here -->
    </div>
    <a class="cta" href="#book">Book Your Call</a>
  </main>
</body>
</html>`,

  'confirmation-page-code': `<!-- PLACEHOLDER: replace with the real confirmation page code -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You're Booked — Watch This Before Your Call</title>
</head>
<body>
  <h1>You're booked! Watch this before your call</h1>
  <div class="video">
    <!-- Embed your confirmation video here -->
  </div>
  <ol class="steps">
    <li>Add the call to your calendar</li>
    <li>Watch the video above</li>
    <li>Show up on time, ready to go</li>
  </ol>
</body>
</html>`,

  'vsl-script': `PLACEHOLDER — replace with the real VSL script

1. HOOK
[Call out who this is for and the big result they want.]

2. PROBLEM
[What they've tried, why it hasn't worked.]

3. THE NEW WAY
[Your unique mechanism and why it's different.]

4. PROOF
[Client results, case studies, numbers.]

5. THE OFFER
[What they get when they work with you.]

6. CALL TO ACTION
[Book a call below — what happens on the call.]`,

  'confirmation-page-script': `PLACEHOLDER — replace with the real confirmation page script

1. CONGRATS
[You're booked — here's what to do next.]

2. SET EXPECTATIONS
[What happens on the call and who they'll speak to.]

3. PROOF
[A quick client story to build belief before the call.]

4. SHOW-UP REMINDER
[Add it to your calendar and show up on time.]`,

  'faq-video-script': `PLACEHOLDER — replace with the real FAQ video script formula

FOR EACH QUESTION:

1. THE QUESTION
[State the objection exactly how prospects say it.]

2. THE SHORT ANSWER
[One or two sentences that resolve it.]

3. THE PROOF
[A client example that backs the answer up.]

4. THE NEXT STEP
[Point them back to booking or attending their call.]`,
};
