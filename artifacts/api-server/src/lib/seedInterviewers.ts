import { db, interviewersTable } from "@workspace/db";
import { eq, inArray, isNull } from "drizzle-orm";

const DISALLOWED_FEMALE_VOICES = new Set(["alloy", "onyx", "echo", "fable"]);

const FEMALE_NAME_CORRECTIONS = new Set(["maya patel"]);

const FEMALE_VOICE_CORRECTIONS: Array<{ id: number; voice: "nova" | "shimmer" }> = [
  { id: 9,  voice: "nova"    },
  { id: 12, voice: "shimmer" },
  { id: 15, voice: "nova"    },
  { id: 18, voice: "shimmer" },
  { id: 21, voice: "nova"    },
  { id: 24, voice: "shimmer" },
  { id: 27, voice: "nova"    },
];

export async function patchFemaleInterviewerVoices(): Promise<void> {
  try {
    const ids = FEMALE_VOICE_CORRECTIONS.map(c => c.id);
    const rows = await db
      .select({ id: interviewersTable.id, voiceId: interviewersTable.voiceId })
      .from(interviewersTable)
      .where(inArray(interviewersTable.id, ids));

    for (const row of rows) {
      const correction = FEMALE_VOICE_CORRECTIONS.find(c => c.id === row.id);
      if (correction && DISALLOWED_FEMALE_VOICES.has(row.voiceId)) {
        await db
          .update(interviewersTable)
          .set({ voiceId: correction.voice })
          .where(eq(interviewersTable.id, row.id));
      }
    }
  } catch (err) {
    console.error("Failed to patch female interviewer voices:", err);
  }
}

export async function patchFemaleNamedInterviewers(): Promise<void> {
  try {
    const rows = await db
      .select({ id: interviewersTable.id, name: interviewersTable.name, voiceId: interviewersTable.voiceId, avatarUrl: interviewersTable.avatarUrl, heygenAvatarId: interviewersTable.heygenAvatarId })
      .from(interviewersTable)
      .where(isNull(interviewersTable.sessionId));

    for (const row of rows) {
      if (!FEMALE_NAME_CORRECTIONS.has(row.name.toLowerCase())) continue;
      if (row.voiceId !== "shimmer") {
        await db
          .update(interviewersTable)
          .set({
            voiceId: "shimmer",
            avatarUrl: "/avatars/interviewer-3.png",
            heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
          })
          .where(eq(interviewersTable.id, row.id));
      }
    }
  } catch (err) {
    console.error("Failed to patch named female interviewers:", err);
  }
}

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

// Female voice IDs used to determine gender-appropriate HeyGen avatar assignment
export const FEMALE_VOICES = new Set(["nova", "shimmer"]);

const INTERVIEWERS = [
  // Original 6
  {
    name: "Sarah Chen",
    title: "Senior Engineering Manager",
    company: "TechCorp",
    personality: "Direct, methodical, and focused on problem-solving depth. Asks follow-up questions about technical decisions and architecture.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-1.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },
  {
    name: "Marcus Williams",
    title: "Head of Product",
    company: "InnovateCo",
    personality: "Warm and collaborative, focuses on product thinking, user empathy, and business impact. Asks about stakeholder management.",
    voiceId: "onyx",
    avatarUrl: "/avatars/interviewer-2.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[0],
  },
  {
    name: "Elena Rodriguez",
    title: "VP of Engineering",
    company: "ScaleUp",
    personality: "Analytical and experienced, probes leadership capabilities, team dynamics, and scaling challenges.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-3.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },
  {
    name: "David Kim",
    title: "Technical Lead",
    company: "BuildFast",
    personality: "Detail-oriented and curious. Digs deep into code quality, testing practices, and system design.",
    voiceId: "fable",
    avatarUrl: "/avatars/interviewer-4.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[1],
  },
  {
    name: "Priya Sharma",
    title: "HR Director",
    company: "TalentFirst",
    personality: "Empathetic and people-focused. Explores cultural fit, conflict resolution, and career motivations.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-5.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[2],
  },
  {
    name: "Maya Patel",
    title: "Product Manager",
    company: "Launchpad",
    personality: "Warm and analytical. Focuses on product sense, collaboration, and decision-making tradeoffs.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-3.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[1],
  },
  {
    name: "James O'Brien",
    title: "CTO",
    company: "FutureStack",
    personality: "Strategic and visionary. Asks about big-picture thinking, innovation, and industry trends.",
    voiceId: "fable",
    avatarUrl: "/avatars/interviewer-6.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[2],
  },
  // Additional 3 for expanded pool
  {
    name: "Jordan Lee",
    title: "Startup Founder",
    company: "Launchpad",
    personality: "Fast-paced and entrepreneurial. Tests resourcefulness, adaptability, and startup mindset. Loves hypotheticals.",
    voiceId: "fable",
    avatarUrl: "/avatars/interviewer-2.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[3],
  },
  {
    name: "Yuki Tanaka",
    title: "Data Science Lead",
    company: "Insights AI",
    personality: "Quantitative and evidence-driven. Probes analytical thinking, data literacy, and hypothesis-driven problem solving.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-3.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[3],
  },
  {
    name: "Robert Martinez",
    title: "Head of Engineering",
    company: "CloudBase",
    personality: "Process-oriented and systems thinker. Focuses on reliability, scalability, and team collaboration in distributed systems.",
    voiceId: "fable",
    avatarUrl: "/avatars/interviewer-4.png",
    heygenAvatarId: HEYGEN_MALE_AVATARS[4],
  },
  // Avatar 9 — Black woman, braided updo, grey blazer
  {
    name: "Afua Boateng",
    title: "Director of Operations",
    company: "GlobalReach",
    personality: "Composed and strategic. Probes organizational thinking, cross-functional leadership, and how candidates handle ambiguity at scale.",
    voiceId: "SAUJnuf0vCDgTQDWx4wI",
    avatarUrl: "/avatars/interviewer-9.png",
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[3],
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
    heygenAvatarId: HEYGEN_FEMALE_AVATARS[0],
  },
];

// Backfill heygen_avatar_id for existing seeded interviewers that don't have one yet
async function patchHeyGenAvatarIds(existing: Array<{ id: number; name: string; heygenAvatarId: string | null }>): Promise<void> {
  for (const persona of INTERVIEWERS) {
    const row = existing.find(e => e.name === persona.name && !e.heygenAvatarId);
    if (row && persona.heygenAvatarId) {
      await db
        .update(interviewersTable)
        .set({ heygenAvatarId: persona.heygenAvatarId })
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

    // Always insert any missing base interviewers by name
    for (const persona of INTERVIEWERS) {
      const existingByName = existing.find(e => e.name === persona.name);
      if (!existingByName) {
        await db.insert(interviewersTable).values(persona);
      }
    }

    // Always backfill heygen_avatar_id for any rows that pre-date this migration
    // (runs unconditionally so both the insert branch and the up-to-date branch are covered)
    const allSeeded = await db
      .select()
      .from(interviewersTable)
      .where(isNull(interviewersTable.sessionId));
    await patchHeyGenAvatarIds(allSeeded);
    await patchFemaleNamedInterviewers();
  } catch (err) {
    console.error("Failed to seed interviewers:", err);
  }
}
