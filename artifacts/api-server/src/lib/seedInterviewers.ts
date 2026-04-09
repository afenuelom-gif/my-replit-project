import { db, interviewersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const DISALLOWED_FEMALE_VOICES = new Set(["alloy", "onyx", "echo", "fable"]);

const FEMALE_VOICE_CORRECTIONS: Record<string, string> = {
  "Alicia K. Patel":   "nova",
  "Aisha N. Thompson": "shimmer",
  "Marisol Vega":      "nova",
  "Priya S. Desai":    "shimmer",
  "Meera K. Patel":    "nova",
  "Elena Márquez":     "shimmer",
  "Priya Natarajan":   "nova",
  "Alexandra Ruiz":    "nova",
};

export async function patchFemaleInterviewerVoices(): Promise<void> {
  try {
    const names = Object.keys(FEMALE_VOICE_CORRECTIONS);
    const rows = await db
      .select({ id: interviewersTable.id, name: interviewersTable.name, voiceId: interviewersTable.voiceId })
      .from(interviewersTable)
      .where(inArray(interviewersTable.name, names));

    for (const row of rows) {
      const targetVoice = FEMALE_VOICE_CORRECTIONS[row.name];
      if (targetVoice && DISALLOWED_FEMALE_VOICES.has(row.voiceId)) {
        await db
          .update(interviewersTable)
          .set({ voiceId: targetVoice })
          .where(eq(interviewersTable.id, row.id));
      }
    }
  } catch (err) {
    console.error("Failed to patch female interviewer voices:", err);
  }
}

const INTERVIEWERS = [
  {
    name: "Sarah Chen",
    title: "Senior Engineering Manager",
    company: "TechCorp",
    personality: "Direct, methodical, and focused on problem-solving depth. Asks follow-up questions about technical decisions and architecture.",
    voiceId: "nova",
    avatarUrl: "/avatars/interviewer-1.png",
  },
  {
    name: "Marcus Williams",
    title: "Head of Product",
    company: "InnovateCo",
    personality: "Warm and collaborative, focuses on product thinking, user empathy, and business impact. Asks about stakeholder management.",
    voiceId: "onyx",
    avatarUrl: "/avatars/interviewer-2.png",
  },
  {
    name: "Elena Rodriguez",
    title: "VP of Engineering",
    company: "ScaleUp",
    personality: "Analytical and experienced, probes leadership capabilities, team dynamics, and scaling challenges.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-3.png",
  },
  {
    name: "David Kim",
    title: "Technical Lead",
    company: "BuildFast",
    personality: "Detail-oriented and curious. Digs deep into code quality, testing practices, and system design.",
    voiceId: "echo",
    avatarUrl: "/avatars/interviewer-4.png",
  },
  {
    name: "Priya Sharma",
    title: "HR Director",
    company: "TalentFirst",
    personality: "Empathetic and people-focused. Explores cultural fit, conflict resolution, and career motivations.",
    voiceId: "shimmer",
    avatarUrl: "/avatars/interviewer-5.png",
  },
  {
    name: "James O'Brien",
    title: "CTO",
    company: "FutureStack",
    personality: "Strategic and visionary. Asks about big-picture thinking, innovation, and industry trends.",
    voiceId: "fable",
    avatarUrl: "/avatars/interviewer-6.png",
  },
];

export async function seedInterviewersIfNeeded(): Promise<void> {
  try {
    const existing = await db.select().from(interviewersTable);
    if (existing.length >= 6) {
      return;
    }

    for (const persona of INTERVIEWERS) {
      const existingByName = existing.find(e => e.name === persona.name);
      if (!existingByName) {
        await db.insert(interviewersTable).values(persona);
      }
    }
  } catch (err) {
    console.error("Failed to seed interviewers:", err);
  }
}
