export type ProblemLanguage = "en" | "km";

export type CompetitionRecord = {
  id: string;
  slug?: string;
  short_code: string;
  name_en: string;
  name_km: string | null;
  description_en: string;
  description_km: string | null;
  level?: "beginner" | "intermediate" | "advanced";
  count?: number;
  display_order?: number;
  is_pinned?: boolean;
};

type QcmAnswer = {
  type: "qcm" | "multiple_choice";
  language?: ProblemLanguage;
  choices_en: string[];
  choices_km?: string[];
  correct_index?: number;
  solution_image_url?: string;
  solution_image_alt?: string;
};

type OpenAnswer = {
  type: "open_ended";
  language?: ProblemLanguage;
  accepted_answers?: string[];
  accepted_answers_km?: string[];
  display_answer?: string;
  display_answer_km?: string;
  solution_image_url?: string;
  solution_image_alt?: string;
};

type StudyAnswer = {
  type: "study";
  language?: ProblemLanguage;
  difficulty_scale: number;
  time_limit_seconds: number;
  category: string;
  contest_day?: 1 | 2;
  solution_image_url?: string;
  solution_image_alt?: string;
};

export type ProblemRecord = {
  id: string;
  competition_id: string | null;
  title_en: string;
  title_km: string | null;
  statement_en: string;
  statement_km: string | null;
  solution_en: string | null;
  solution_km: string | null;
  hint_en: string | null;
  hint_km: string | null;
  diagram_url: string | null;
  diagram_alt: string | null;
  solution_image_url: string | null;
  solution_image_alt: string | null;
  topic: string;
  tags: string[];
  difficulty: string;
  difficulty_scale: number;
  time_limit_seconds: number;
  problem_type: "qcm" | "open_ended" | "study";
  year: number | null;
  contest_day: 1 | 2 | null;
  problem_number: number | null;
  points: number;
  status: "draft" | "review" | "published";
  answer: QcmAnswer | OpenAnswer | StudyAnswer | null;
  content_language: ProblemLanguage;
  creator?: { display_name: string } | null;
};

export const normalizeProblem = (row: any): ProblemRecord => {
  const declaredLanguage = row.content_language ?? row.answer?.language;
  const primaryTextContainsKhmer = /[\u1780-\u17ff]/.test(row.statement_en ?? "");
  const contentLanguage: ProblemLanguage =
    declaredLanguage === "km" ||
    (!declaredLanguage &&
      ((!row.statement_en?.trim() && row.statement_km?.trim()) ||
        primaryTextContainsKhmer))
      ? "km"
      : "en";
  return {
    ...row,
    content_language: contentLanguage,
    diagram_url: row.diagram_url ?? row.answer?.diagram_url ?? null,
    diagram_alt: row.diagram_alt ?? row.answer?.diagram_alt ?? null,
    solution_image_url: row.answer?.solution_image_url ?? null,
    solution_image_alt: row.answer?.solution_image_alt ?? null,
    contest_day:
      row.contest_day ??
      (row.answer?.contest_day === 1 || row.answer?.contest_day === 2
        ? row.answer.contest_day
        : null),
    difficulty_scale: Number(row.difficulty_scale ?? row.answer?.difficulty_scale ?? 3),
    time_limit_seconds: Number(row.time_limit_seconds ?? row.answer?.time_limit_seconds ?? 600),
    problem_type: (row.answer?.type === "study"
      ? "study"
      : (row.problem_type ??
        (row.answer?.type === "open_ended" ? "open_ended" : "qcm"))) as
      | "qcm"
      | "open_ended"
      | "study",
  };
};

export const problemText = (
  problem: ProblemRecord,
  field: "statement" | "solution" | "hint",
) => {
  const en = problem[`${field}_en` as keyof ProblemRecord] as string | null;
  const km = problem[`${field}_km` as keyof ProblemRecord] as string | null;
  return problem.content_language === "km" ? (km || en || "") : (en || km || "");
};

export const PORTALS: CompetitionRecord[] = [
  {
    id: "NMO9",
    display_order: 0,
    is_pinned: false,
    short_code: "NMO9",
    name_en: "National Olympiad (KHM–9)",
    name_km: "អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ទី៩",
    description_en: "Problems selected for Cambodia’s Grade 9 National Mathematical Olympiad.",
    description_km: "វិញ្ញាសាសម្រាប់អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ជាតិថ្នាក់ទី៩ នៃប្រទេសកម្ពុជា។",
  },
  {
    id: "NMO12",
    display_order: 1,
    is_pinned: false,
    short_code: "NMO12",
    name_en: "National Olympiad (KHM–12)",
    name_km: "អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ទី១២",
    description_en: "Problems selected for Cambodia’s Grade 12 National Mathematical Olympiad.",
    description_km: "វិញ្ញាសាសម្រាប់អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ជាតិថ្នាក់ទី១២ នៃប្រទេសកម្ពុជា។",
  },
  {
    id: "MO",
    display_order: 2,
    is_pinned: false,
    short_code: "MO",
    name_en: "Math Olympiad",
    name_km: "អូឡាំព្យាដគណិតវិទ្យា",
    description_en: "International competition practice from Kangaroo, AMC, and similar olympiads.",
    description_km: "លំហាត់អនុវត្តពីការប្រកួតអន្តរជាតិ ដូចជា Kangaroo, AMC និងអូឡាំព្យាដផ្សេងៗ។",
  },
];
