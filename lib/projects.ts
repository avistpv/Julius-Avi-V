// Projects shown on the home page. Images are Unsplash placeholders (see public/work/CREDITS.md)
// until real screenshots arrive. Copy comes from the current julius-agency.co.il portfolio.
export type Project = {
  slug: string;
  name: string;
  tag: string; // lime pill on the image
  kind: string; // right side of the caption
  blurb: string;
  image: string;
  // Placement on the 12-column grid (1-based start column, span) and media aspect ratio (w / h).
  col: number;
  span: number;
  aspect: number;
};

export const PROJECTS: Project[] = [
  // row 1 — one wide piece on the right (like the reference's lead project)
  { slug: 'solya', name: 'Solya V2', tag: 'Energy', kind: 'SaaS', blurb: 'Real-time monitoring and AI performance insight for solar-system owners.', image: '/work/solya.jpg', col: 5, span: 8, aspect: 16 / 9 },
  // row 2 — two halves, offset
  { slug: 'biz4sale', name: 'BIZ4SALE', tag: 'Marketplace', kind: 'B2B', blurb: 'A marketplace connecting business sellers and buyers with smart search and compare.', image: '/work/biz4sale.jpg', col: 1, span: 5, aspect: 16 / 9 },
  { slug: 'job-target', name: 'Job Target', tag: 'Recruiting', kind: 'Web', blurb: 'An agent portal where freelance recruiters find roles, submit candidates and track commissions.', image: '/work/jobtarget.jpg', col: 7, span: 5, aspect: 16 / 9 },
  // row 3 — two small, pushed right
  { slug: 'buybypower', name: 'BuyByPower', tag: 'Marketplace', kind: 'SaaS', blurb: 'Two-sided group-buying: a deal auto-closes when a tender hits its buyer target.', image: '/work/buybypower.jpg', col: 6, span: 3, aspect: 332 / 213 },
  { slug: 'or-menachem', name: 'Or Menachem CRM', tag: 'Fundraising', kind: 'CRM', blurb: 'A call-centre CRM for donation drives — donor lists, live calls, payments and receipts.', image: '/work/ormenachem.jpg', col: 10, span: 3, aspect: 332 / 213 },
  // row 4 — three tall
  { slug: 'techory', name: 'Techory', tag: 'Field service', kind: 'SaaS', blurb: 'One operating workspace for field-service jobs, customers, scheduling, estimates and inventory.', image: '/work/techory.jpg', col: 1, span: 3, aspect: 332 / 452 },
  { slug: 'mifrat', name: 'Mifrat', tag: 'Product planning', kind: 'SaaS', blurb: 'A workspace connecting product specifications, effort estimates, tasks and quality review.', image: '/work/mifrat.jpg', col: 5, span: 3, aspect: 332 / 452 },
  { slug: 'master-fit', name: 'Master Fit', tag: 'Fitness', kind: 'App', blurb: 'A management system and app for fitness coaches, trainees, workout plans and nutrition.', image: '/work/masterfit.jpg', col: 9, span: 3, aspect: 332 / 452 },
  // row 5 — two square, pushed right
  { slug: 'findme', name: 'FindMe', tag: 'Social', kind: 'Web', blurb: "One digital home that unifies a person's links, channels and identity into a searchable card.", image: '/work/findme.jpg', col: 6, span: 3, aspect: 1 },
  { slug: 'lavision', name: 'LaVision', tag: 'AI', kind: 'Growth', blurb: 'An AI vision board that turns who you want to become into a concrete plan.', image: '/work/lavision.jpg', col: 10, span: 3, aspect: 1 },
  // row 6 — two halves to close
  { slug: 'metch', name: 'Metch', tag: 'AI', kind: 'Recruiting', blurb: 'A job platform where an AI agent scores every applicant against what the role requires.', image: '/work/metch.jpg', col: 1, span: 5, aspect: 16 / 9 },
  { slug: 'gymnote', name: 'Gymnote', tag: 'Fitness', kind: 'Mobile', blurb: 'A workout selection interface organized by type, equipment, duration and difficulty.', image: '/work/gymnote.jpg', col: 7, span: 5, aspect: 16 / 9 },
];

export const TOTAL_PROJECTS = 17;

// Rows group the cards that sit side by side (indices into PROJECTS).
export const ROWS: number[][] = [[0], [1, 2], [3, 4], [5, 6, 7], [8, 9], [10, 11]];
