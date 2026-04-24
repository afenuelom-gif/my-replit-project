import { db, interviewersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

// Well-known HeyGen public streaming avatar IDs
export const HEYGEN_FEMALE_AVATARS = [
  "Abigail_expressive_20250108",
  "Kristin_public_2_20240108",
  "Ann_Therapist_public",
  "AnnKathy_public_20240108",
  "Angela_public_expressive_20250108",
];
export const HEYGEN_MALE_AVATARS = [
  "Eric_public_inshirt_20240828",
  "Ethan_public_2_20240108",
  "Bryan_public_4_20240108",
  "Tyler_public_2_20240108",
  "Josh_IT_public_4_20240108",
];

// Legacy set kept for backward-compat with any code that imports it
export const FEMALE_VOICES = new Set(["nova", "shimmer"]);

// ─── Voice ID reference ────────────────────────────────────────────────────
// Avatar 1 & 15  East Asian female          heoaHqgqA3CQLtMDLa4c
// Avatar 2       Black male                 rJLvfJVPEOEikEb43sqN  (African American v3)
// Avatar 3 & 11  Latina female              P39EFrcpltm1lGu3bBj6
// Avatar 4 & 12  East Asian male            q1CITMmkG1EzRQDARDDn
// Avatar 5 & 17  South Asian female         XT11Ld3OsUg6QlWCZMiw
// Avatar 6       White/Western male 50s     onwK4e9ZLuTAKqWW03F9  (Daniel – British)
// Avatar 7       White/Western female 30s   XrExE9yKIg1WjnnlVkGX  (Matilda – warm US)
// Avatar 8       White/Western male 30-40s  GBv7mTt0atIp3Br8iCZE  (Thomas – calm US)
// Avatar 9       Black female               SAUJnuf0vCDgTQDWx4wI
// Avatar 10      Latino male                XHYj423YTmrtKuAeDM4z
// Avatar 13      Middle Eastern female      1a8j57sZVYjnK5uCty7R
// Avatar 14      South Asian male           MShyCq4HjuznDScfP2mr
// Avatar 16      Middle Eastern male        S7PLrsTwYww90uerouYn
// Avatar 18      White/Western male 60s     TX3LPaxmHKxFdv7VOQHJ  (Liam – neutral US)
// ──────────────────────────────────────────────────────────────────────────

const INTERVIEWERS: Array<{
  name: string;
  title: string;
  company: string;
  personality: string;
  voiceId: string;
  avatarUrl: string;
  heygenAvatarId: string;
}> = [
  // ── Avatar 1 · East Asian woman, 30s, navy blazer ─────────────────────
  {
    name: "Sarah Chen",
    title: "Senior Engineering Manager",
    company: "TechCorp",
    personality: "Direct and methodical. Focuses on problem-solving depth, technical decisions, and architecture trade-offs.",
    voiceId: "heoaHqgqA3CQLtMDLa4c",
    avatarUrl: "/avatars/interviewer-1.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },
  {
    name: "Mei Lin",
    title: "Head of Product Design",
    company: "TechVision",
    personality: "Precise and composed. Focuses on structured thinking, design systems, and how candidates communicate complex ideas clearly.",
    voiceId: "heoaHqgqA3CQLtMDLa4c",
    avatarUrl: "/avatars/interviewer-1.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },

  // ── Avatar 2 · Black man, 40s, grey suit ─────────────────────────────
  {
    name: "Marcus Williams",
    title: "Head of Product",
    company: "InnovateCo",
    personality: "Warm and collaborative. Focuses on product thinking, user empathy, and business impact. Asks about stakeholder management.",
    voiceId: "rJLvfJVPEOEikEb43sqN",
    avatarUrl: "/avatars/interviewer-2.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },
  {
    name: "Darius Cole",
    title: "VP of Sales",
    company: "GrowthPath",
    personality: "Confident and direct. Tests leadership presence, business acumen, and the ability to drive results under pressure.",
    voiceId: "rJLvfJVPEOEikEb43sqN",
    avatarUrl: "/avatars/interviewer-2.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },
  {
    name: "Kofi Asante",
    title: "Director of Strategy",
    company: "GlobalMind",
    personality: "Thoughtful and strategic. Explores cross-cultural communication, global business awareness, and executive presence.",
    voiceId: "rJLvfJVPEOEikEb43sqN",
    avatarUrl: "/avatars/interviewer-2.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },

  // ── Avatar 3 · Latina/Mediterranean woman, 40s, black blazer ─────────
  {
    name: "Elena Rodriguez",
    title: "VP of Engineering",
    company: "ScaleUp",
    personality: "Analytical and experienced. Probes leadership capabilities, team dynamics, and scaling challenges.",
    voiceId: "P39EFrcpltm1lGu3bBj6",
    avatarUrl: "/avatars/interviewer-3.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },
  {
    name: "Maya Lopez",
    title: "Product Lead",
    company: "Launchpad",
    personality: "Energetic and perceptive. Zeros in on communication style, adaptability, and how candidates build relationships across teams.",
    voiceId: "P39EFrcpltm1lGu3bBj6",
    avatarUrl: "/avatars/interviewer-3.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },

  // ── Avatar 4 · East Asian man, 30s, blue shirt ────────────────────────
  {
    name: "David Kim",
    title: "Technical Lead",
    company: "BuildFast",
    personality: "Detail-oriented and curious. Digs deep into code quality, testing practices, and system design.",
    voiceId: "q1CITMmkG1EzRQDARDDn",
    avatarUrl: "/avatars/interviewer-4.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },
  {
    name: "Daniel Chen",
    title: "Principal Engineer",
    company: "CoreSys",
    personality: "Methodical and exacting. Tests depth of technical knowledge, code quality, and systematic approach to problem-solving.",
    voiceId: "q1CITMmkG1EzRQDARDDn",
    avatarUrl: "/avatars/interviewer-4.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },

  // ── Avatar 5 · South Asian woman, 30s, black blazer ──────────────────
  {
    name: "Priya Sharma",
    title: "HR Director",
    company: "TalentFirst",
    personality: "Empathetic and people-focused. Explores cultural fit, conflict resolution, and career motivations.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-5.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Anika Kapoor",
    title: "People Operations Lead",
    company: "HumanCo",
    personality: "Curious and supportive. Explores growth mindset, mentorship experience, and how candidates approach continuous learning.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-5.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Sana Malik",
    title: "Talent Acquisition Manager",
    company: "HireRight",
    personality: "Observant and probing. Focuses on critical thinking, decision-making under uncertainty, and professional resilience.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-5.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },

  // ── Avatar 6 · White/Western man, 50s, silver-grey hair ──────────────
  {
    name: "Ethan Brooks",
    title: "Chief Technology Officer",
    company: "FutureStack",
    personality: "Seasoned and measured. Assesses strategic vision, organizational influence, and experience navigating complex stakeholder landscapes.",
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    avatarUrl: "/avatars/interviewer-6.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },
  {
    name: "James O'Brien",
    title: "Managing Director",
    company: "StratGroup",
    personality: "Strategic and visionary. Asks about big-picture thinking, innovation, board-level communication, and industry trends.",
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    avatarUrl: "/avatars/interviewer-6.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },

  // ── Avatar 7 · White/Western woman, blonde, blue top, 30s ────────────
  {
    name: "Emily Carter",
    title: "Engineering Manager",
    company: "WebCore",
    personality: "Approachable yet sharp. Probes collaboration, communication skills, and how candidates handle ambiguity in cross-functional settings.",
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    avatarUrl: "/avatars/interviewer-7.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[3],
  },
  {
    name: "Sarah Thompson",
    title: "Director of People",
    company: "TeamBuilt",
    personality: "Structured and empathetic. Focuses on team dynamics, conflict resolution, and how candidates build trust across organizations.",
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    avatarUrl: "/avatars/interviewer-7.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[3],
  },
  {
    name: "Megan Blake",
    title: "Senior Product Manager",
    company: "PixelLaunch",
    personality: "Engaging and methodical. Explores creative problem-solving, project ownership, and how candidates demonstrate initiative.",
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    avatarUrl: "/avatars/interviewer-7.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[3],
  },

  // ── Avatar 8 · White/Western man, brown hair, navy shirt, 30s–40s ────
  {
    name: "Michael Reed",
    title: "Head of Engineering",
    company: "CloudBase",
    personality: "Driven and analytical. Focuses on execution speed, technical depth, and how candidates handle competing priorities under pressure.",
    voiceId: "GBv7mTt0atIp3Br8iCZE",
    avatarUrl: "/avatars/interviewer-8.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },
  {
    name: "Jason Miller",
    title: "Senior Engineering Manager",
    company: "DevStack",
    personality: "Pragmatic and results-oriented. Explores operational efficiency, delivery track record, and how candidates communicate upward.",
    voiceId: "GBv7mTt0atIp3Br8iCZE",
    avatarUrl: "/avatars/interviewer-8.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },

  // ── Avatar 9 · Black woman, braided updo, grey blazer ────────────────
  {
    name: "Afua Boateng",
    title: "Director of Operations",
    company: "GlobalReach",
    personality: "Composed and strategic. Probes organizational thinking, cross-functional leadership, and how candidates handle ambiguity at scale.",
    voiceId: "SAUJnuf0vCDgTQDWx4wI",
    avatarUrl: "/avatars/interviewer-9.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[4],
  },
  {
    name: "Nana Ofori",
    title: "Senior People Partner",
    company: "TalentBridge",
    personality: "Warm yet incisive. Focuses on team culture, inclusion, and how candidates navigate difficult interpersonal dynamics.",
    voiceId: "SAUJnuf0vCDgTQDWx4wI",
    avatarUrl: "/avatars/interviewer-9.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[4],
  },
  {
    name: "Jasmine Carter",
    title: "VP of Customer Success",
    company: "ClientFirst",
    personality: "Empathetic and results-driven. Explores client relationship skills, escalation handling, and building long-term partnerships.",
    voiceId: "SAUJnuf0vCDgTQDWx4wI",
    avatarUrl: "/avatars/interviewer-9.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[4],
  },

  // ── Avatar 10 · Hispanic/Latino man, 40s, grey suit ──────────────────
  {
    name: "Carlos Rivera",
    title: "Head of Business Development",
    company: "MarketLeap",
    personality: "Dynamic and perceptive. Tests business development instincts, relationship building, and how candidates approach new market challenges.",
    voiceId: "XHYj423YTmrtKuAeDM4z",
    avatarUrl: "/avatars/interviewer-10.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[4],
  },
  {
    name: "Diego Morales",
    title: "VP of Operations",
    company: "OpsFirst",
    personality: "Grounded and strategic. Explores change management, cross-functional alignment, and how candidates lead through uncertainty.",
    voiceId: "XHYj423YTmrtKuAeDM4z",
    avatarUrl: "/avatars/interviewer-10.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[4],
  },
  {
    name: "Javier Torres",
    title: "Senior Product Manager",
    company: "Launchify",
    personality: "Personable and analytical. Focuses on team performance metrics, stakeholder communication, and career trajectory decisions.",
    voiceId: "XHYj423YTmrtKuAeDM4z",
    avatarUrl: "/avatars/interviewer-10.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[4],
  },

  // ── Avatar 11 · Latina/Hispanic woman, 40s, dark wavy hair, burgundy blazer
  {
    name: "Sofia Ramirez",
    title: "Director of People",
    company: "PeopleFirst",
    personality: "Warm and strategic. Probes organizational leadership, inclusive team-building, and how candidates inspire high-performing teams.",
    voiceId: "P39EFrcpltm1lGu3bBj6",
    avatarUrl: "/avatars/interviewer-11.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },
  {
    name: "Isabella Cruz",
    title: "VP of Marketing",
    company: "BrandCore",
    personality: "Empathetic and driven. Focuses on career development, professional growth, and how candidates navigate organizational change.",
    voiceId: "P39EFrcpltm1lGu3bBj6",
    avatarUrl: "/avatars/interviewer-11.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },
  {
    name: "Camila Torres",
    title: "Head of Customer Success",
    company: "ClientWin",
    personality: "Articulate and insightful. Explores communication effectiveness, executive presence, and how candidates align teams around shared goals.",
    voiceId: "P39EFrcpltm1lGu3bBj6",
    avatarUrl: "/avatars/interviewer-11.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },

  // ── Avatar 12 · East Asian man, 40s, grey suit ────────────────────────
  {
    name: "Kenji Tanaka",
    title: "Data Science Lead",
    company: "Insights AI",
    personality: "Deliberate and exacting. Focuses on analytical rigor, data systems, and how candidates balance technical depth against delivery speed.",
    voiceId: "q1CITMmkG1EzRQDARDDn",
    avatarUrl: "/avatars/interviewer-12.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },
  {
    name: "Hiro Matsuda",
    title: "Chief Architect",
    company: "SysBuild",
    personality: "Quiet and incisive. Probes depth of engineering judgment, team mentorship, and how candidates approach technical trade-offs.",
    voiceId: "q1CITMmkG1EzRQDARDDn",
    avatarUrl: "/avatars/interviewer-12.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },
  {
    name: "Daniel Chen",
    title: "Engineering Director",
    company: "TechPeak",
    personality: "Structured and visionary. Explores engineering culture, team scaling, and how candidates drive technical excellence across large organizations.",
    voiceId: "q1CITMmkG1EzRQDARDDn",
    avatarUrl: "/avatars/interviewer-12.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },

  // ── Avatar 13 · Middle Eastern woman, hijab, blue blazer ─────────────
  {
    name: "Layla Hassan",
    title: "Global Operations Director",
    company: "NexCorp",
    personality: "Composed and insightful. Explores global business acumen, adaptability, and how candidates build inclusive cross-cultural working relationships.",
    voiceId: "1a8j57sZVYjnK5uCty7R",
    avatarUrl: "/avatars/interviewer-13.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Noor Al-Khalid",
    title: "Head of Strategy",
    company: "StrategicEdge",
    personality: "Thoughtful and strategic. Focuses on analytical reasoning, executive communication, and how candidates navigate ambiguity in complex organizations.",
    voiceId: "1a8j57sZVYjnK5uCty7R",
    avatarUrl: "/avatars/interviewer-13.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Sara Mansour",
    title: "People & Culture Director",
    company: "TalentHub",
    personality: "Poised and perceptive. Probes collaborative leadership, professional resilience, and how candidates demonstrate empathy in high-stakes situations.",
    voiceId: "1a8j57sZVYjnK5uCty7R",
    avatarUrl: "/avatars/interviewer-13.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },

  // ── Avatar 14 · South Asian/Indian man, 40s, navy suit, beard ────────
  {
    name: "Arjun Patel",
    title: "Chief Technology Officer",
    company: "BuildScale",
    personality: "Confident and structured. Tests technical leadership, system design decisions, and how candidates influence engineering culture at scale.",
    voiceId: "MShyCq4HjuznDScfP2mr",
    avatarUrl: "/avatars/interviewer-14.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },
  {
    name: "Rohan Singh",
    title: "Head of Product",
    company: "DataDriven",
    personality: "Data-driven and strategic. Focuses on product-engineering alignment, metrics-driven decision-making, and engineering team growth.",
    voiceId: "MShyCq4HjuznDScfP2mr",
    avatarUrl: "/avatars/interviewer-14.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },
  {
    name: "Imran Khan",
    title: "Director of Engineering",
    company: "CodeFirst",
    personality: "Methodical and visionary. Explores architectural thinking, cross-team dependencies, and how candidates scale technical teams effectively.",
    voiceId: "MShyCq4HjuznDScfP2mr",
    avatarUrl: "/avatars/interviewer-14.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },

  // ── Avatar 15 · East Asian woman, 50s, white blazer, straight black hair
  {
    name: "Mei Lin",
    title: "Chief Strategy Officer",
    company: "VisioTech",
    personality: "Experienced and composed. Reflects on long-term career narratives, leadership philosophy, and how candidates leave a lasting organizational impact.",
    voiceId: "heoaHqgqA3CQLtMDLa4c",
    avatarUrl: "/avatars/interviewer-15.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },
  {
    name: "Hana Park",
    title: "Head of Design",
    company: "CreativeOps",
    personality: "Precise and thoughtful. Focuses on quality of work, mentoring others, and how candidates balance technical excellence with team effectiveness.",
    voiceId: "heoaHqgqA3CQLtMDLa4c",
    avatarUrl: "/avatars/interviewer-15.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },
  {
    name: "Aiko Sato",
    title: "VP of Product",
    company: "ProductWave",
    personality: "Calm and strategic. Explores product intuition, user-centered design thinking, and how candidates align technology with business outcomes.",
    voiceId: "heoaHqgqA3CQLtMDLa4c",
    avatarUrl: "/avatars/interviewer-15.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },

  // ── Avatar 16 · Mediterranean/Middle Eastern man, 40s, dark beard, dark suit
  {
    name: "Omar Rahman",
    title: "Chief Executive Officer",
    company: "GlobalBuild",
    personality: "Authoritative and strategic. Tests executive decision-making, organizational influence, and how candidates manage complex international business challenges.",
    voiceId: "S7PLrsTwYww90uerouYn",
    avatarUrl: "/avatars/interviewer-16.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },
  {
    name: "Samir Haddad",
    title: "Head of Corporate Strategy",
    company: "StratCore",
    personality: "Sharp and composed. Focuses on competitive strategy, market analysis, and how candidates approach business growth in dynamic environments.",
    voiceId: "S7PLrsTwYww90uerouYn",
    avatarUrl: "/avatars/interviewer-16.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },
  {
    name: "Karim Al-Farsi",
    title: "VP of Business Development",
    company: "GrowthVentures",
    personality: "Direct and perceptive. Probes leadership effectiveness, negotiation skills, and how candidates build high-trust relationships with senior stakeholders.",
    voiceId: "S7PLrsTwYww90uerouYn",
    avatarUrl: "/avatars/interviewer-16.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },

  // ── Avatar 17 · South Asian/Indian woman, 30s, teal blazer ───────────
  // Same names as avatar 5 by design (similar-looking avatars share names)
  {
    name: "Priya Sharma",
    title: "Head of Talent",
    company: "PeopleScale",
    personality: "Empathetic and strategic. Probes career motivations, team-building philosophy, and how candidates approach people-first leadership.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-17.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Anika Kapoor",
    title: "Senior Recruiter",
    company: "TalentEdge",
    personality: "Warm and perceptive. Focuses on candidate growth stories, cultural alignment, and what motivates people to do their best work.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-17.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Sana Malik",
    title: "Organizational Development Lead",
    company: "InnerWork",
    personality: "Reflective and incisive. Explores how candidates handle feedback, build self-awareness, and grow through professional challenges.",
    voiceId: "XT11Ld3OsUg6QlWCZMiw",
    avatarUrl: "/avatars/interviewer-17.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },

  // ── Avatar 18 · White/Western man, 60s, silver hair, white shirt ──────
  {
    name: "Robert Hayes",
    title: "Chief Executive Officer",
    company: "EnterpriseGlobal",
    personality: "Veteran and measured. Draws on decades of experience to probe strategic thinking, board-level communication, and long-term career vision.",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    avatarUrl: "/avatars/interviewer-18.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },
  {
    name: "Thomas Grant",
    title: "Board Member & Advisor",
    company: "VentureGroup",
    personality: "Seasoned and analytical. Focuses on organizational transformation, crisis leadership, and how candidates navigate high-stakes business decisions.",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    avatarUrl: "/avatars/interviewer-18.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },
  {
    name: "Steven Walker",
    title: "Managing Partner",
    company: "ConsultEdge",
    personality: "Authoritative and consultative. Explores corporate governance, executive presence, and how candidates translate vision into organizational action.",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    avatarUrl: "/avatars/interviewer-18.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },
];

// Patch voices and heygen IDs for existing rows that may have stale data
async function patchExistingInterviewers(
  existing: Array<{ id: number; name: string; avatarUrl: string; voiceId: string; heygenAvatarId: string | null }>
): Promise<void> {
  for (const persona of INTERVIEWERS) {
    const row = existing.find(
      e => e.name === persona.name && e.avatarUrl === persona.avatarUrl
    );
    if (!row) continue;

    const needsVoiceUpdate = row.voiceId !== persona.voiceId;
    const needsHeygenUpdate = !row.heygenAvatarId && persona.heygenAvatarId;

    if (needsVoiceUpdate || needsHeygenUpdate) {
      await db
        .update(interviewersTable)
        .set({
          ...(needsVoiceUpdate ? { voiceId: persona.voiceId } : {}),
          ...(needsHeygenUpdate ? { heygenAvatarId: persona.heygenAvatarId } : {}),
        })
        .where(eq(interviewersTable.id, row.id));
    }
  }
}

export async function seedInterviewersIfNeeded(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(interviewersTable)
      .where(isNull(interviewersTable.sessionId));

    // Insert any missing interviewers — unique by (name + avatarUrl)
    // This allows the same name to appear across different avatar images
    for (const persona of INTERVIEWERS) {
      const exists = existing.find(
        e => e.name === persona.name && e.avatarUrl === persona.avatarUrl
      );
      if (!exists) {
        await db.insert(interviewersTable).values(persona);
      }
    }

    // Patch stale voices / heygen IDs on existing rows
    await patchExistingInterviewers(existing);
  } catch (err) {
    console.error("Failed to seed interviewers:", err);
  }
}

// Keep export for backward-compat — no longer does anything meaningful
// since voices are now set correctly in INTERVIEWERS above
export async function patchFemaleInterviewerVoices(): Promise<void> {}
export async function patchFemaleNamedInterviewers(): Promise<void> {}
