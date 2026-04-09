export interface InterviewerPersona {
  name: string;
  title: string;
  company: string;
  personality: string;
  voiceId: string;
  avatarPrompt: string;
}

export const INTERVIEWER_PERSONAS: InterviewerPersona[] = [
  {
    name: "Sarah Chen",
    title: "Senior Engineering Manager",
    company: "TechCorp",
    personality: "Direct, methodical, and focused on problem-solving depth. Asks follow-up questions about technical decisions and architecture.",
    voiceId: "nova",
    avatarPrompt: "Professional headshot of an Asian woman in her late 30s, wearing a navy blazer, confident smile, blurred office background, studio lighting, photorealistic",
  },
  {
    name: "Marcus Williams",
    title: "Head of Product",
    company: "InnovateCo",
    personality: "Warm and collaborative, focuses on product thinking, user empathy, and business impact. Asks about stakeholder management.",
    voiceId: "onyx",
    avatarPrompt: "Professional headshot of a Black man in his early 40s, wearing a light grey suit, friendly smile, blurred modern office background, studio lighting, photorealistic",
  },
  {
    name: "Elena Rodriguez",
    title: "VP of Engineering",
    company: "ScaleUp",
    personality: "Analytical and experienced, probes leadership capabilities, team dynamics, and scaling challenges.",
    voiceId: "alloy",
    avatarPrompt: "Professional headshot of a Latina woman in her mid 40s, wearing a dark blazer with pearl necklace, authoritative yet approachable, blurred boardroom background, studio lighting, photorealistic",
  },
  {
    name: "David Kim",
    title: "Technical Lead",
    company: "BuildFast",
    personality: "Detail-oriented and curious. Digs deep into code quality, testing practices, and system design.",
    voiceId: "echo",
    avatarPrompt: "Professional headshot of a Korean-American man in his early 30s, wearing a casual button-down shirt, thoughtful expression, blurred tech office background, studio lighting, photorealistic",
  },
  {
    name: "Priya Sharma",
    title: "HR Director",
    company: "TalentFirst",
    personality: "Empathetic and people-focused. Explores cultural fit, conflict resolution, and career motivations.",
    voiceId: "shimmer",
    avatarPrompt: "Professional headshot of an Indian woman in her late 30s, wearing a colorful saree with professional blazer, warm smile, blurred HR office background, studio lighting, photorealistic",
  },
  {
    name: "James O'Brien",
    title: "CTO",
    company: "FutureStack",
    personality: "Strategic and visionary. Asks about big-picture thinking, innovation, and industry trends.",
    voiceId: "fable",
    avatarPrompt: "Professional headshot of a white Irish man in his early 50s, salt and pepper hair, wearing a crisp white shirt, executive presence, blurred executive office background, studio lighting, photorealistic",
  },
];
