import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?");
}
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface QuestionContext {
  jobRole: string;
  jobDescription: string | null;
  resumeText: string | null;
  previousQA: Array<{ question: string; answer: string | null }>;
  interviewerPersonality: string;
  interviewerName: string;
  questionCount: number;
}

export async function generateNextQuestion(ctx: QuestionContext, isFollowUp: boolean): Promise<string> {
  const resumeSection = ctx.resumeText
    ? `
Candidate's resume:
${ctx.resumeText}

IMPORTANT resume rules:
- You MAY reference the candidate's past experience but ONLY if it is directly relevant or transferable to the ${ctx.jobRole} role
- Do NOT ask about experiences, roles, or skills on the resume that are unrelated to this position
- When a candidate is transitioning from another field, focus on transferable skills and motivations for the switch rather than irrelevant prior work`
    : "";

  const jdSection = ctx.jobDescription
    ? `
Job description:
${ctx.jobDescription}

Use the job description to ask targeted questions about the specific skills, tools, responsibilities, or competencies listed. Weave these requirements naturally into your questions.`
    : "";

  const systemPrompt = `You are ${ctx.interviewerName}, a professional interviewer. Your personality: ${ctx.interviewerPersonality}

You are interviewing a candidate for the role of: ${ctx.jobRole}
${jdSection}${resumeSection}

Rules:
- Ask one clear, focused interview question
- Keep the question to 1-2 sentences maximum
- Do not repeat previously asked questions
- Be conversational and professional
- Do not include preamble like "Great answer!" or "Thank you for sharing"
- Just ask the question directly`;

  const qaHistory = ctx.previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer ?? "[No answer provided]"}`)
    .join("\n\n");

  const userPrompt = isFollowUp
    ? `Based on the candidate's last answer, ask a relevant follow-up question that probes deeper into their response.

Previous Q&A:
${qaHistory}

Ask a follow-up question:`
    : `${qaHistory ? `Previous Q&A:\n${qaHistory}\n\n` : ""}Ask the next interview question for question #${ctx.questionCount + 1}. ${ctx.questionCount === 0 ? "Start with a warm opening question like asking them to introduce themselves or walk through their background." : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 256,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "Could you tell me about your experience?";
}

export interface AnswerEvaluation {
  score: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export async function evaluateAnswer(
  question: string,
  answer: string,
  jobRole: string,
  jobDescription: string | null
): Promise<AnswerEvaluation> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are an expert interview evaluator for the role: ${jobRole}${jobDescription ? `\nJob description: ${jobDescription}` : ""}

Evaluate the candidate's answer and return a JSON object with:
- score (integer 0-100, holistic answer quality)
- technicalScore (integer 0-100, domain knowledge and role-relevant terminology)
- communicationScore (integer 0-100, clarity, structure, and coherence)
- confidenceScore (integer 0-100, assertive phrasing, directness, absence of hedging)
- feedback (string, 2-3 sentences of overall feedback)
- strengths (array of 1-3 short strength bullet points)
- improvements (array of 1-3 short improvement suggestions)

OVERALL SCORE RUBRIC — apply strictly:
- 0–10: Nonsense, gibberish, filler words, completely off-topic, or blank/empty answer.
- 11–30: Extremely vague or only tangentially related; no domain knowledge demonstrated.
- 31–50: Partial relevance but missing key concepts; weak or generic response.
- 51–70: On-topic and mostly correct; shows basic understanding but lacks depth or examples.
- 71–89: Solid answer with role-relevant terminology, clear structure, and at least one concrete example.
- 90–100: Exceptional — specific, detailed, well-structured; directly addresses the question with strong domain knowledge.
A score above 50 REQUIRES role-relevant vocabulary. A score above 80 REQUIRES at least one concrete example.

TECHNICAL SCORE — domain knowledge and role-specific terminology:
- 0–30: No domain knowledge; generic or irrelevant content.
- 31–50: Some relevant terms but missing key concepts for the role.
- 51–70: Correct use of role-relevant terminology; basic understanding shown.
- 71–100: Strong domain knowledge; correct use of technical concepts specific to ${jobRole}.

COMMUNICATION SCORE — clarity, structure, and coherence:
- 0–30: Incoherent, rambling, or single-word answers.
- 31–50: Partially addresses the question but lacks structure.
- 51–70: Logically structured and mostly on-topic.
- 71–100: Clear, well-organised, articulate; directly addresses the question.

CONFIDENCE SCORE — assertive phrasing and decisiveness (not posture):
- 0–30: Entirely passive or evasive language.
- 31–50: Heavy hedging ("I think maybe", "I'm not sure but").
- 51–70: Generally direct with minor hedging.
- 71–100: Consistently assertive and decisive phrasing.

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Question: ${question}\n\nCandidate's answer: ${answer}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as AnswerEvaluation;
    const clamp = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));
    return {
      score: clamp(parsed.score),
      technicalScore: clamp(parsed.technicalScore),
      communicationScore: clamp(parsed.communicationScore),
      confidenceScore: clamp(parsed.confidenceScore),
      feedback: parsed.feedback ?? "Good attempt.",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };
  } catch {
    return { score: 0, technicalScore: 0, communicationScore: 0, confidenceScore: 0, feedback: "Unable to evaluate at this time.", strengths: [], improvements: [] };
  }
}

export async function generateReport(
  jobRole: string,
  jobDescription: string | null,
  qaItems: Array<{ question: string; answer: string | null }>,
  postureScores: number[]
): Promise<{
  summary: string;
  suggestions: string[];
}> {
  const qaText = qaItems
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer ?? "[No answer]"}`)
    .join("\n\n");

  const avgPosture =
    postureScores.length > 0
      ? Math.round(postureScores.reduce((a, b) => a + b, 0) / postureScores.length)
      : null;

  const postureContext = avgPosture !== null
    ? `\nPosture/presence score (1-100 scale, from webcam analysis): ${avgPosture}${avgPosture < 60 ? " — poor eye contact, slouching, or low energy observed" : avgPosture < 80 ? " — adequate but room for improvement" : " — strong, confident presence"}`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 768,
    messages: [
      {
        role: "system",
        content: `You are an expert interview coach evaluating a candidate's performance for the role: ${jobRole}${jobDescription ? `\nJob description: ${jobDescription}` : ""}${postureContext}

Based on the Q&A below, return a JSON object with:
- summary (string, 3-4 sentence overall assessment — if posture score was low, mention it briefly)
- suggestions (array of exactly 3 actionable improvement suggestions — include posture/body language if posture score was below 70)

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Interview Q&A:\n\n${qaText}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { summary: string; suggestions: string[] };
    return {
      summary: parsed.summary ?? "Overall performance was satisfactory.",
      suggestions: ensureThreeSuggestions(
        Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : []
      ),
    };
  } catch {
    return {
      summary: "Overall performance was satisfactory.",
      suggestions: ensureThreeSuggestions([]),
    };
  }
}

function ensureThreeSuggestions(suggestions: string[]): string[] {
  const defaults = [
    "Practice structuring answers using the STAR method (Situation, Task, Action, Result).",
    "Provide more specific examples and quantifiable outcomes in your responses.",
    "Work on concise delivery by keeping answers to 1-2 minutes and eliminating filler words.",
  ];
  const result = [...suggestions];
  while (result.length < 3) {
    result.push(defaults[result.length]);
  }
  return result;
}

const FEMALE_VOICES = ["nova", "shimmer"] as const;
const MALE_VOICES = ["onyx", "echo", "fable"] as const;

const KNOWN_FEMALE_FIRST_NAMES = new Set([
  // Western
  "aaliyah","abigail","ada","addison","adriana","agatha","agnes","aimee","alexa","alexandra","alexia","alexis","alice","alicia","alison","allison","alysa","alyson","alyssa","allyson","amanda","amber","amelia","amy","ana","andrea","angela","angelica","annette","annie","antonia","april","aria","ariana","ashley","astrid","athena","aubrey","audrey","aurora","autumn","ava","avery","barbara","beatrice","bella","beth","betty","bianca","bonnie","brenda","brianna","bridget","brittany","brittney","brooke","brooklyn","callie","camila","carol","caroline","carrie","cassandra","cassidy","cassie","celeste","charlene","charlotte","cheryl","chloe","christine","cindy","claire","clara","clarissa","claudia","colleen","constance","cora","courtney","crystal","cynthia","daisy","dana","daniela","dawn","deanna","deborah","destiny","diana","donna","dorothy","eleanor","elena","elise","eliza","elizabeth","ella","ellie","elsa","emily","emma","erica","erin","eva","evelyn","faith","faye","felicia","florence","fiona","frances","gabby","gabriela","gabrielle","gemma","genevieve","georgia","gianna","gina","grace","hailey","hannah","harriet","hazel","heather","helen","hilary","hillary","holly","hope","iris","isabelle","isabella","ivy","jacqueline","jade","jasmine","jenna","jennifer","jessica","jill","joan","joanna","josephine","joy","judith","julia","juliana","june","justine","karen","kate","katherine","katie","katelyn","kaitlyn","kayla","keira","kelly","kelsey","kendra","kennedy","kim","kimberly","kristen","kristina","lacey","lauren","layla","leah","leila","lena","lillian","lily","linda","lindsey","lisa","lola","lorraine","louisa","lucy","luna","lydia","mackenzie","madeline","madelyn","maggie","mallory","mara","margaret","marina","marissa","marla","marlena","maria","mariana","marie","marlene","marjorie","mary","maya","megan","melanie","melissa","mia","michelle","millie","miranda","molly","monica","naomi","natalia","natalie","natasha","nathalie","nichole","nicola","nicole","nina","nora","norma","nadia","noelle","olivia","paige","pamela","patricia","paula","penelope","peyton","phoebe","priscilla","quinn","rachel","rebecca","renee","riley","rose","roxanne","ruby","ruth","sabrina","sadie","samantha","sandra","sara","sarah","savannah","scarlett","selena","serena","shannon","sharon","shelby","sierra","simone","skylar","sloane","sofia","sophia","stacey","stacy","stephanie","stella","summer","susan","sydney","tamara","tara","taylor","tessa","theresa","tiffany","tina","tori","valentina","valeria","valerie","vanessa","vera","veronica","victoria","violet","virginia","vivian","wendy","willow","yasmine","yvonne","zoe","zoey",
  // South Asian
  "aaditi","aarti","abha","aditi","akanksha","alka","amita","amrita","ananya","anita","anjali","ankita","anupama","anuradha","archana","arushi","asha","avni","bhavna","deepa","deepika","devyani","divya","durga","gauri","geeta","gita","gitanjali","hema","ila","indira","jaya","jyoti","kajal","kalpana","kamla","kavita","kavya","kiran","komal","kritika","lakshmi","lata","lavanya","laxmi","madhuri","manisha","manju","meena","meera","mohini","nalini","namrata","neha","nidhi","nisha","nita","parvati","pooja","prachi","pragya","pratibha","pratima","preeti","prerna","priya","puja","purnima","pushpa","radha","rakhi","rashmi","ratna","renu","ritu","riya","roopa","rupali","sadhna","sangeeta","sanjana","sangita","sarita","savita","seema","shailaja","shikha","shilpa","shreya","shubha","shweta","sita","smita","smriti","sonal","sonali","sudha","sujata","sunita","sushma","tanvi","tripti","usha","uma","vandana","veena","vidya","vimla","vinita","vrinda","yashaswini",
  // Middle Eastern / Islamic
  "aisha","amina","amira","asma","basma","bushra","dalia","dana","dina","fadwa","farah","farida","fatima","ghada","hana","haneen","hibah","huda","iman","jameela","khadija","laila","lara","leila","lina","lubna","manal","mariam","maryam","mina","miriam","mona","najwa","noor","noura","nuha","rania","reem","rina","safia","salma","sama","samah","samira","sana","sara","sarah","shaheen","shirin","sondos","suha","tahira","yasmin","zahra","zainab","zara",
  // East Asian
  "akemi","akiko","ami","ayako","ayumi","fumiko","hanako","haruka","hikaru","hiromi","hana","hua","jing","kaori","keiko","kumiko","kyoko","li","maho","mai","makiko","mei","mika","mikako","miki","ming","miwa","miyuki","momoko","natsuki","noriko","reiko","reina","rie","rika","riko","risa","sachiko","sakura","sayaka","sayuri","seiko","setsuko","shizuka","suki","sumiko","takako","tomoko","tomomi","wakako","wei","xin","xue","yoko","yoshiko","yuki","yuko","yumi","yumiko","yuri","yuriko",
  // African / African-American
  "abena","abimbola","adaeze","adaora","adwoa","afriyie","akosua","amara","ambi","aminata","amira","amma","bimpe","chidinma","chioma","chisom","ebunola","efua","eniola","fatou","folake","funmi","imani","isatou","kadiatou","kiara","kiri","maïmouna","mariama","nadia","nana","ngozi","nkechi","nneka","nse","oge","ogechi","omowunmi","oumou","ronke","rokhaya","safiatou","sayo","taiwo","temitayo","titi","titilayo","tokunbo","zuri",
  // Hispanic / Latina
  "adriana","alejandra","alicia","alma","ana","andrea","anita","aurora","beatriz","camila","carmen","carolina","catalina","cecilia","claudia","consuelo","cristina","diana","dolores","elena","elisa","elvia","esperanza","fernanda","flor","gabriela","gloria","graciela","guadalupe","ingrid","irene","isabel","isabela","josefina","juanita","leticia","liliana","lourdes","lucia","luisa","luz","magdalena","mariana","marisol","marlene","marta","mercedes","monica","natalia","norma","ofelia","paola","patricia","paula","pilar","raquel","renata","rosa","rosario","sandra","silvia","sonia","susana","teresa","valeria","veronica","xiomara","yolanda",
]);

function resolveGender(name: string, gptGender: string): "female" | "male" {
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (KNOWN_FEMALE_FIRST_NAMES.has(firstName)) return "female";
  return gptGender.toLowerCase() === "female" ? "female" : "male";
}

function pickVoice(gender: string, usedFemale: number, usedMale: number): string {
  if (gender === "female") {
    return FEMALE_VOICES[usedFemale % FEMALE_VOICES.length];
  }
  return MALE_VOICES[usedMale % MALE_VOICES.length];
}

export async function generateDynamicInterviewers(
  jobRole: string,
  jobDescription: string | null,
  resumeText: string | null,
  count: number
): Promise<Array<{
  name: string;
  title: string;
  company: string;
  personality: string;
  voiceId: string;
}> | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are generating realistic professional interviewer personas for a job interview simulation.
Given a job role, produce exactly ${count} interviewer personas who would realistically interview someone for that position.
The personas should have industry-appropriate titles (NOT generic tech titles like "VP of Engineering" unless the role is actually in tech).

Return a JSON array of exactly ${count} objects, each with:
- name (string, realistic full name)
- title (string, realistic job title fitting the industry of the role)
- company (string, realistic company or organisation name fitting the industry)
- personality (string, one sentence describing their interviewing style and focus areas)
- gender (string, either "female" or "male" — must match the name you chose)

Examples for "Nurse": Chief Nursing Officer, Nurse Manager, Clinical HR Lead
Examples for "Data Scientist": Head of Analytics, Senior Data Scientist, Technical Recruiter (AI/ML)
Examples for "Lawyer": Partner (Litigation), General Counsel, Legal Talent Director
Examples for "Teacher": Principal, Department Head, District HR Manager
Examples for "Marketing Manager": CMO, Brand Strategy Director, Talent Partner

Return ONLY valid JSON array, no markdown.`,
        },
        {
          role: "user",
          content: `Job role: ${jobRole}${jobDescription ? `\nJob description: ${jobDescription.slice(0, 500)}` : ""}${resumeText ? `\nResume: ${resumeText.slice(0, 1200)}` : ""}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(raw) as Array<{
      name: string;
      title: string;
      company: string;
      personality: string;
      gender?: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    let femaleCount = 0;
    let maleCount = 0;

    return parsed.slice(0, count).map((p) => {
      const gender = resolveGender(String(p.name ?? ""), p.gender ?? "");
      const voiceId = pickVoice(gender, femaleCount, maleCount);
      if (gender === "female") femaleCount++; else maleCount++;
      return {
        name: String(p.name ?? `Interviewer ${femaleCount + maleCount}`),
        title: String(p.title ?? "Senior Manager"),
        company: String(p.company ?? "Organisation"),
        personality: String(p.personality ?? "Professional and thorough interviewer."),
        voiceId,
      };
    });
  } catch {
    return null;
  }
}

export async function analyzePostureFromImage(imageBase64: string): Promise<{
  score: number;
  feedback: string;
  issues: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing body language and posture for professional video interviews.
        
Analyze the provided image and return a JSON object with:
- score (integer 0-100, posture quality score)
- feedback (string, 1-2 sentences of posture feedback)
- issues (array of specific issues found, e.g. "slouching", "poor eye contact", "bad lighting")

IMPORTANT: If the image is blank, black, shows no visible person, or the camera appears to be off or covered, you MUST return score: 0, feedback: "Enable your camera for posture analysis — no person detected.", issues: ["camera off or no person detected"].
Do NOT assign a non-zero score when no person is clearly visible in the frame.
Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: "Analyze the person's posture and body language for a professional video interview.",
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { score: number; feedback: string; issues: string[] };
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      feedback: parsed.feedback ?? "Posture analysis complete.",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return { score: 0, feedback: "Unable to analyze posture at this time.", issues: [] };
  }
}

const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  nova:    "21m00Tcm4TlvDq8ikWAM",
  shimmer: "EXAVITQu4vr4xnSDxMaL",
  alloy:   "MF3mGyEYCl7XYWbV9V6O",
  onyx:    "pNInz6obpgDQGcFmaJgB",
  echo:    "TxGEqnHWrfWFTfGW9XjX",
  fable:   "ErXwobaYiN019PkySvjV",
};

export async function generateTTS(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  // If voiceId is a direct ElevenLabs ID (not a legacy map key), use it as-is
  const elevenVoiceId = ELEVENLABS_VOICE_MAP[voiceId] ?? voiceId;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.85,
          style: 0,
          use_speaker_boost: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown error");
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Fallback to OpenAI transcription if ElevenLabs key is missing
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
    const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, { type: mimeType });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
      language: "en",
    });
    return transcription.text;
  }

  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
  formData.append("model_id", "scribe_v1");
  formData.append("language_code", "en");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown error");
    throw new Error(`ElevenLabs STT failed (${response.status}): ${errText}`);
  }

  const result = await response.json() as { text?: string; transcription?: string };
  return result.text ?? result.transcription ?? "";
}


export function shouldAskFollowUp(questionCount: number, answerLength: number): boolean {
  if (questionCount < 2) return false;
  if (questionCount > 12) return false;
  const tooShort = answerLength < 80;
  const randomFollowUp = Math.random() < 0.35;
  return tooShort || randomFollowUp;
}

