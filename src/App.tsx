import { Fragment, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  Globe2,
  Heart,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
  Crown,
  Medal,
  MousePointer2,
  Star,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  isSupabaseConfigured,
  signIn,
  signOut,
  signUp,
  supabase,
  type AuthUser,
} from "./lib/supabase";
import {
  normalizeProblem,
  problemText,
  PORTALS,
  type CompetitionRecord,
  type ProblemRecord,
} from "./problem-data";

const AdminContribute = lazy(() =>
  import("./QuestionBank").then((module) => ({ default: module.AdminContribute })),
);
const CompetitionLibrary = lazy(() =>
  import("./QuestionBank").then((module) => ({ default: module.CompetitionLibrary })),
);
const CompetitionProblems = lazy(() =>
  import("./QuestionBank").then((module) => ({ default: module.CompetitionProblems })),
);
const DatabasePractice = lazy(() =>
  import("./QuestionBank").then((module) => ({ default: module.DatabasePractice })),
);
const MathContent = lazy(() =>
  import("./MathContent").then((module) => ({ default: module.MathContent })),
);

type Lang = "en" | "km";
type Page =
  | "home"
  | "about"
  | "competitions"
  | "competition-detail"
  | "problem"
  | "dashboard"
  | "contribute"
  | "auth";

type AppRoute = {
  page: Page;
  competition: CompetitionRecord | null;
  year: number | null;
  day: number | null;
  problemId: string | null;
};

const pagePaths: Record<Exclude<Page, "competition-detail" | "problem">, string> = {
  home: "/",
  about: "/about",
  competitions: "/competitions",
  dashboard: "/profile",
  contribute: "/contribute",
  auth: "/login",
};

const competitionPath = (
  competition: CompetitionRecord,
  year: number | null = null,
  day: number | null = null,
) => {
  let path = `/competitions/${encodeURIComponent(competition.short_code.toLowerCase())}`;
  if (year !== null) path += `/${year}`;
  if (year !== null && day !== null) path += `/day-${day}`;
  return path;
};

const readRoute = (): AppRoute => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 0)
    return { page: "home", competition: null, year: null, day: null, problemId: null };
  if (parts[0] === "competitions") {
    const routeCode = parts[1] ? decodeURIComponent(parts[1]) : "";
    const competition = routeCode
      ? PORTALS.find(
          (item) => item.short_code.toLowerCase() === routeCode.toLowerCase(),
        ) ?? {
          id: "",
          short_code: routeCode.toUpperCase(),
          name_en: routeCode.toUpperCase(),
          name_km: null,
          description_en: "",
          description_km: null,
        }
      : null;
    if (!competition)
      return {
        page: "competitions",
        competition: null,
        year: null,
        day: null,
        problemId: null,
      };
    const parsedYear = Number(parts[2]);
    const dayMatch = parts[3]?.match(/^day-(0|1|2)$/);
    return {
      page: "competition-detail",
      competition,
      year: Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : null,
      day: dayMatch ? Number(dayMatch[1]) : null,
      problemId: null,
    };
  }
  if (parts[0] === "problems" && parts[1])
    return {
      page: "problem",
      competition: null,
      year: null,
      day: null,
      problemId: decodeURIComponent(parts[1]),
    };
  const page = (Object.entries(pagePaths).find(([, path]) => path === window.location.pathname)?.[0] ??
    "home") as Exclude<Page, "competition-detail" | "problem">;
  return { page, competition: null, year: null, day: null, problemId: null };
};

const copy = {
  en: {
    navPractice: "Practice",
    navCompetitions: "Competitions",
    navProgress: "My profile",
    navAbout: "About us",
    login: "Log in",
    start: "Start practicing",
    eyebrow: "Built for curious problem solvers",
    heroA: "Think deeper.",
    heroB: "Solve boldly.",
    heroText:
      "A focused question bank for your math olympiad journey—organized by competition, topic, and difficulty.",
    browse: "Browse competitions",
    free: "Free to learn. Always.",
    trusted: "Practice from contests around the world",
    questionBank: "Your olympiad library",
    questionText:
      "Choose a competition, find your level, and turn hard problems into ideas you understand.",
    viewAll: "Explore all competitions",
    why: "Practice with purpose",
    whyTitle: "Everything you need to grow as a problem solver.",
    step1: "Find your challenge",
    step1d: "Filter by contest, topic, year, and difficulty.",
    step2: "Work at your pace",
    step2d: "Save problems, use hints, and return whenever you need.",
    step3: "Learn the idea",
    step3d: "Read clear, community-reviewed solutions—not just answers.",
    ctaTitle: "Your next breakthrough starts with one problem.",
    ctaText:
      "Join a growing community of students preparing thoughtfully, one solution at a time.",
    footer: "Made with care for Cambodia’s next generation of problem solvers.",
    compTitle: "Find your next challenge",
    compSub:
      "Browse curated olympiad problems from Cambodia and around the world.",
    search: "Search competitions...",
    all: "All levels",
    begin: "Beginner",
    inter: "Intermediate",
    advanced: "Advanced",
    problems: "problems",
    beginPractice: "Begin practice",
    dashboard: "Your olympiad profile",
    continue: "Continue where you left off",
    recent: "Recent activity",
    accuracy: "Accuracy",
    solved: "Problems solved",
    streak: "Day streak",
    adminTitle: "Admin workspace",
    adminSub: "Manage competitions and publish quality problems.",
    newContest: "New competition",
    addProblem: "Add problem",
    published: "Published",
    draft: "Draft",
    authWelcome: "Welcome to Lumhat",
    authSub: "Keep your progress, save problems, and learn in both languages.",
    email: "Email address",
    password: "Password",
    name: "Full name",
    signIn: "Sign in",
    signUp: "Create account",
    noAccount: "New to Lumhat?",
    hasAccount: "Already have an account?",
  },
  km: {
    navPractice: "អនុវត្ត",
    navCompetitions: "ការប្រកួត",
    navProgress: "ប្រវត្តិរូប",
    navAbout: "អំពីពួកយើង",
    login: "ចូល Account",
    start: "ចាប់ផ្តើមធ្វើលំហាត់",
    eyebrow: "បង្កើតភាពងាយស្រួលដល់ការត្រៀមប្រឡងសម្រាប់សិស្សគ្រប់គ្នា",
    heroA: "គិតឱ្យស៊ីជម្រៅ",
    heroB: "ដោះស្រាយដោយទំនុកចិត្ត",
    heroText:
      "មានលំហាត់ច្រើនបែប និងទម្រង់សម្រាប់ការងាយស្រួលដល់សិស្សគ្រប់រូបដែលមានបំណងស្វែងយល់បន្ថែមលើសពីអ្វីដែលមានក្នុងថ្នាក់រៀនធម្មតា និង មិនគិតថ្លៃ។",
    browse: "ស្វែងរកវិញ្ញាសារប្រឡង",
    free: "សម្រាប់គ្រប់គ្នា",
    trusted: "អនុវត្តពីការប្រកួតជុំវិញពិភពលោក ពិសេសការប្រឡងក្នុងស្រុក",
    questionBank: "បណ្ណាល័យអូឡាំព្យាដរបស់អ្នក",
    questionText:
      "ជ្រើសរើសការប្រកួត ស្វែងរកកម្រិតរបស់អ្នក និងប្រែក្លាយបញ្ហាលំបាកទៅជាគំនិតដែលអ្នកយល់។",
    viewAll: "មើលការប្រកួតទាំងអស់",
    why: "អនុវត្តដោយមានគោលដៅ",
    whyTitle: "អ្វីៗគ្រប់យ៉ាងដែលអ្នកត្រូវការដើម្បីរីកចម្រើន។",
    step1: "ស្វែងរកបញ្ហាប្រឈម",
    step1d: "ចម្រាញ់តាមការប្រកួត ប្រធានបទ ឆ្នាំ និងកម្រិត។",
    step2: "រៀនតាមល្បឿនរបស់អ្នក",
    step2d: "រក្សាទុកបញ្ហា ប្រើគន្លឹះ និងត្រឡប់មកវិញពេលណាក៏បាន។",
    step3: "យល់ពីគំនិត",
    step3d: "អានដំណោះស្រាយច្បាស់លាស់ មិនមែនតែចម្លើយទេ។",
    ctaTitle: "ភាពជោគជ័យបន្ទាប់របស់អ្នកចាប់ផ្តើមពីបញ្ហាមួយ។",
    ctaText: "ចូលរួមជាមួយសិស្សដែលកំពុងត្រៀមខ្លួន មួយដំណោះស្រាយម្ដងៗ។",
    footer:
      "បង្កើតឡើងដោយយកចិត្តទុកដាក់សម្រាប់អ្នកដោះស្រាយបញ្ហាជំនាន់ក្រោយរបស់កម្ពុជា។",
    compTitle: "ស្វែងរកបញ្ហាប្រឈមបន្ទាប់",
    compSub: "ស្វែងរកបញ្ហាអូឡាំព្យាដពីកម្ពុជា និងជុំវិញពិភពលោក។",
    search: "ស្វែងរកការប្រកួត...",
    all: "គ្រប់កម្រិត",
    begin: "ដំបូង",
    inter: "មធ្យម",
    advanced: "កម្រិតខ្ពស់",
    problems: "បញ្ហា",
    beginPractice: "ចាប់ផ្តើមអនុវត្ត",
    dashboard: "ប្រវត្តិរូបអូឡាំព្យាដរបស់អ្នក",
    continue: "បន្តពីកន្លែងដែលអ្នកឈប់",
    recent: "សកម្មភាពថ្មីៗ",
    accuracy: "ភាពត្រឹមត្រូវ",
    solved: "បញ្ហាបានដោះស្រាយ",
    streak: "ថ្ងៃបន្តបន្ទាប់",
    adminTitle: "កន្លែងការងារអ្នកគ្រប់គ្រង",
    adminSub: "គ្រប់គ្រងការប្រកួត និងផ្សព្វផ្សាយបញ្ហាដែលមានគុណភាព។",
    newContest: "ការប្រកួតថ្មី",
    addProblem: "បន្ថែមបញ្ហា",
    published: "បានផ្សព្វផ្សាយ",
    draft: "ព្រាង",
    authWelcome: "សូមស្វាគមន៍មកកាន់ Lumhat",
    authSub: "រក្សាវឌ្ឍនភាព បញ្ហា និងរៀនជាពីរភាសា។",
    email: "អ៊ីមែល",
    password: "ពាក្យសម្ងាត់",
    name: "ឈ្មោះពេញ",
    signIn: "ចូលគណនី",
    signUp: "បង្កើតគណនី",
    noAccount: "ថ្មីមកកាន់ Lumhat?",
    hasAccount: "មានគណនីរួចហើយ?",
  },
};

const aboutCopy = {
  en: {
    eyebrow: "ABOUT LUMHAT",
    titleA: "A place for",
    titleB: "brave thinking.",
    intro:
      "Lumhat is a learning home for students who want to go beyond memorizing formulas and discover what they can do with an idea.",
    buildLabel: "WHAT WE BUILD",
    buildTitle: "A clearer path into challenging mathematics.",
    buildText:
      "We bring carefully selected olympiad problems, helpful hints, and understandable solutions into one calm, bilingual space. Students can find the right challenge, practice with focus, and see their thinking grow over time.",
    buildNote: "Discover. Practice. Understand.",
    problemLabel: "PROBLEM",
    problemText: "A challenge worth sitting with",
    hintLabel: "HINT",
    hintText: "A nudge, not a shortcut",
    solutionLabel: "SOLUTION",
    solutionText: "The idea made visible",
    missionLabel: "OUR MISSION",
    missionTitle: "Make serious problem solving feel possible.",
    missionText:
      "We believe mathematical confidence is built—not inherited. Our mission is to make high-quality learning accessible, encourage patience through difficult problems, and help more Cambodian students trust their own reasoning.",
    missionNote: "Good problems should open doors, not guard them.",
    serveLabel: "WHO WE SERVE",
    serveTitle: "Cambodia’s curious problem solvers.",
    serveText:
      "Lumhat is for the student meeting olympiad mathematics for the first time, the experienced competitor reaching for the next level, and the teachers and mentors helping both of them move forward.",
    serveNote: "For every learner ready to think a little deeper.",
    beginningLabel: "BEGINNING",
    beginningText: "Meeting olympiad mathematics for the first time.",
    beginningRole: "student",
    advancingLabel: "ADVANCING",
    advancingText: "Reaching for the next level, one difficult idea at a time.",
    advancingRole: "competitor",
    guidingLabel: "GUIDING",
    guidingText: "Helping another problem solver find their way forward.",
    guidingRole: "teacher / mentor",
    communityNote: "one learning community",
    closingLabel: "START WITH ONE",
    closing: "One problem can change how a student sees what is possible.",
    action: "Explore the problem library",
  },
  km: {
    eyebrow: "អំពី LUMHAT",
    titleA: "កន្លែងសម្រាប់",
    titleB: "ការគិតដោយក្លាហាន។",
    intro:
      "Lumhat ជាកន្លែងសិក្សាសម្រាប់សិស្សដែលចង់លើសពីការទន្ទេញរូបមន្ត ហើយស្វែងយល់ថាពួកគេអាចធ្វើអ្វីបានជាមួយគំនិតមួយ។",
    buildLabel: "អ្វីដែលយើងបង្កើត",
    buildTitle: "ផ្លូវកាន់តែច្បាស់ទៅកាន់គណិតវិទ្យាដ៏ប្រកួតប្រជែង។",
    buildText:
      "យើងប្រមូលផ្តុំលំហាត់អូឡាំព្យាដដែលបានជ្រើសរើស គន្លឹះមានប្រយោជន៍ និងដំណោះស្រាយងាយយល់នៅក្នុងកន្លែងសិក្សាស្ងប់ស្ងាត់ជាពីរភាសា។ សិស្សអាចស្វែងរកលំហាត់សមស្រប អនុវត្តដោយផ្តោតអារម្មណ៍ និងមើលឃើញការរីកចម្រើនរបស់ខ្លួន។",
    buildNote: "ស្វែងរក។ អនុវត្ត។ យល់ដឹង។",
    problemLabel: "លំហាត់",
    problemText: "បញ្ហាប្រឈមដែលគួរចំណាយពេលគិត",
    hintLabel: "គន្លឹះ",
    hintText: "ការណែនាំ មិនមែនផ្លូវកាត់",
    solutionLabel: "ដំណោះស្រាយ",
    solutionText: "ធ្វើឱ្យគំនិតមើលឃើញច្បាស់",
    missionLabel: "បេសកកម្មរបស់យើង",
    missionTitle: "ធ្វើឱ្យការដោះស្រាយបញ្ហាកម្រិតខ្ពស់អាចសម្រេចបាន។",
    missionText:
      "យើងជឿថាទំនុកចិត្តលើគណិតវិទ្យាត្រូវបានកសាង មិនមែនកើតមកជាមួយនោះទេ។ បេសកកម្មរបស់យើងគឺធ្វើឱ្យការសិក្សាដែលមានគុណភាពអាចចូលដល់បាន លើកទឹកចិត្តឱ្យមានភាពអត់ធ្មត់ និងជួយសិស្សកម្ពុជាកាន់តែច្រើនជឿជាក់លើការគិតរបស់ខ្លួន។",
    missionNote: "លំហាត់ល្អគួរតែបើកទ្វារ មិនមែនបិទផ្លូវទេ។",
    serveLabel: "យើងបម្រើអ្នកណា",
    serveTitle: "អ្នកដោះស្រាយបញ្ហាដែលចង់ដឹងចង់ឃើញនៅកម្ពុជា។",
    serveText:
      "Lumhat គឺសម្រាប់សិស្សដែលទើបស្គាល់គណិតវិទ្យាអូឡាំព្យាដ អ្នកប្រកួតដែលចង់ឈានទៅកម្រិតបន្ទាប់ និងគ្រូបង្រៀនឬអ្នកណែនាំដែលជួយពួកគេឱ្យទៅមុខ។",
    serveNote: "សម្រាប់អ្នករៀនគ្រប់រូបដែលត្រៀមខ្លួនគិតឱ្យជ្រៅជាងមុន។",
    beginningLabel: "ចាប់ផ្តើម",
    beginningText: "ស្គាល់គណិតវិទ្យាអូឡាំព្យាដជាលើកដំបូង។",
    beginningRole: "សិស្ស",
    advancingLabel: "រីកចម្រើន",
    advancingText: "ឈានទៅកម្រិតបន្ទាប់ តាមរយៈគំនិតដ៏លំបាកម្តងមួយៗ។",
    advancingRole: "អ្នកប្រកួត",
    guidingLabel: "ណែនាំ",
    guidingText: "ជួយអ្នកដោះស្រាយបញ្ហាម្នាក់ទៀតរកផ្លូវទៅមុខ។",
    guidingRole: "គ្រូ / អ្នកណែនាំ",
    communityNote: "សហគមន៍សិក្សាតែមួយ",
    closingLabel: "ចាប់ផ្តើមពីមួយ",
    closing: "លំហាត់មួយអាចផ្លាស់ប្តូររបៀបដែលសិស្សម្នាក់មើលឃើញអ្វីដែលអាចធ្វើទៅបាន។",
    action: "ស្វែងរកបណ្ណាល័យលំហាត់",
  },
};

const walkthrough = {
  en: {
    kicker: "HOW LUMHAT WORKS",
    title: "From curious to confident in three steps.",
    intro:
      "Choose a challenge, work through it with the right support, and watch your problem-solving skills grow.",
    steps: [
      {
        number: "01",
        label: "DISCOVER",
        title: "Choose your next challenge",
        text: "Browse olympiad competitions from Cambodia and around the world. Filter by level, topic, or year to find the right problem for you.",
        action: "Explore competitions",
      },
      {
        number: "02",
        label: "PRACTICE",
        title: "Solve one idea at a time",
        text: "Work in a focused practice space, check a hint when you need one, and learn from a clear step-by-step solution.",
        action: "Start practicing",
      },
      {
        number: "03",
        label: "PROGRESS",
        title: "See how far you have come",
        text: "Your answers, accuracy, topic strengths, and streaks come together in one profile—so you always know what to work on next.",
        action: "View your profile",
      },
    ],
  },
  km: {
    kicker: "របៀបប្រើប្រាស់ LUMHAT",
    title: "ពីអ្នកចង់ដឹង ទៅជាអ្នកដោះស្រាយដោយទំនុកចិត្ត ក្នុង ៣ ជំហាន។",
    intro:
      "ជ្រើសរើសលំហាត់ ដោះស្រាយដោយមានជំនួយត្រឹមត្រូវ និងមើលឃើញជំនាញរបស់អ្នករីកចម្រើន។",
    steps: [
      {
        number: "01",
        label: "ស្វែងរក",
        title: "ជ្រើសរើសបញ្ហាប្រឈមបន្ទាប់",
        text: "ស្វែងរកការប្រកួតគណិតវិទ្យាពីកម្ពុជា និងជុំវិញពិភពលោក តាមកម្រិត ប្រធានបទ ឬឆ្នាំ។",
        action: "មើលការប្រកួត",
      },
      {
        number: "02",
        label: "អនុវត្ត",
        title: "ដោះស្រាយមួយគំនិតម្តងៗ",
        text: "ផ្តោតលើលំហាត់ ប្រើគន្លឹះនៅពេលត្រូវការ និងរៀនពីដំណោះស្រាយជាជំហានៗ។",
        action: "ចាប់ផ្តើមអនុវត្ត",
      },
      {
        number: "03",
        label: "វឌ្ឍនភាព",
        title: "មើលថាអ្នកបានរីកចម្រើនប៉ុណ្ណា",
        text: "ចម្លើយ ភាពត្រឹមត្រូវ ប្រធានបទខ្លាំង និងការអនុវត្តជាប់គ្នា ត្រូវបានបង្ហាញក្នុងប្រវត្តិរូបរបស់អ្នក។",
        action: "មើលប្រវត្តិរូប",
      },
    ],
  },
};

type Contest = {
  id: string;
  short: string;
  name: string;
  years: string;
  count: number;
  level: string;
  color: string;
  icon: string;
  desc: string;
};

const contests: Contest[] = [
  {
    id: "imo",
    short: "IMO",
    name: "International Mathematical Olympiad",
    years: "1959–2025",
    count: 402,
    level: "Advanced",
    color: "#e95d44",
    icon: "π",
    desc: "The world’s most prestigious mathematics competition for high school students.",
  },
  {
    id: "amc",
    short: "AMC",
    name: "American Mathematics Competitions",
    years: "2000–2025",
    count: 780,
    level: "Intermediate",
    color: "#315fcb",
    icon: "△",
    desc: "Creative problems that build a strong foundation for olympiad mathematics.",
  },
  {
    id: "kangaroo",
    short: "KMC",
    name: "Kangaroo Math Competition",
    years: "2010–2025",
    count: 526,
    level: "Beginner",
    color: "#e3a12a",
    icon: "✦",
    desc: "Accessible, playful challenges for young mathematical thinkers.",
  },
  {
    id: "seamo",
    short: "SEAMO",
    name: "Southeast Asian Mathematical Olympiad",
    years: "2016–2025",
    count: 238,
    level: "Intermediate",
    color: "#2e9d7b",
    icon: "⬡",
    desc: "Regional olympiad problems designed to inspire Southeast Asian students.",
  },
  {
    id: "cmo",
    short: "CMO",
    name: "Cambodian Mathematical Olympiad",
    years: "2012–2025",
    count: 164,
    level: "Advanced",
    color: "#7c54c4",
    icon: "∞",
    desc: "Problems from Cambodia’s national pathway to international competition.",
  },
  {
    id: "apmo",
    short: "APMO",
    name: "Asian Pacific Mathematics Olympiad",
    years: "1989–2025",
    count: 185,
    level: "Advanced",
    color: "#d16b9d",
    icon: "∑",
    desc: "Proof-based challenges from across the Asia-Pacific region.",
  },
];

function useCompetitions(lang: Lang) {
  const [items, setItems] = useState<Contest[]>(
    isSupabaseConfigured ? [] : contests,
  );
  useEffect(() => {
    if (!supabase) {
      setItems(contests);
      return;
    }
    let active = true;
    supabase
      .from("competitions")
      .select(
        "id, short_code, name_en, name_km, description_en, description_km, level, start_year, end_year, problems(count)",
      )
      .eq("status", "published")
      .neq("slug", "lumhat-problem-bank")
      .order("name_en")
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load competitions", error);
          return;
        }
        const colors = [
          "#e95d44",
          "#315fcb",
          "#e3a12a",
          "#2e9d7b",
          "#7c54c4",
          "#d16b9d",
        ];
        const icons = ["π", "△", "✦", "⬡", "∞", "∑"];
        setItems(
          (data ?? []).map((row: any, index: number) => ({
            id: row.id,
            short: row.short_code,
            name: lang === "km" && row.name_km ? row.name_km : row.name_en,
            years:
              [row.start_year, row.end_year].filter(Boolean).join("–") ||
              "All years",
            count: row.problems?.[0]?.count ?? 0,
            level:
              String(row.level).charAt(0).toUpperCase() +
              String(row.level).slice(1),
            color: colors[index % colors.length],
            icon: icons[index % icons.length],
            desc:
              lang === "km" && row.description_km
                ? row.description_km
                : row.description_en,
          })),
        );
      });
    return () => {
      active = false;
    };
  }, [lang]);
  return items;
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Lumhat home">
      <img className="logo-mark" src="/logo.png" alt="" />
      <span>lumhat</span>
    </button>
  );
}

function Header({
  lang,
  setLang,
  page,
  go,
  user,
  role,
  onSignOut,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  page: Page;
  go: (p: Page) => void;
  user: AuthUser | null;
  role: string;
  onSignOut: () => void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const navigate = (nextPage: Page) => {
    go(nextPage);
    setOpen(false);
  };
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Logo onClick={() => navigate("home")} />
        <nav
          id="primary-navigation"
          className={open ? "open" : ""}
          aria-label="Primary navigation"
        >
          <button
            className={
              page === "competitions" ||
              page === "competition-detail" ||
              page === "problem"
                ? "active"
                : ""
            }
            onClick={() => navigate("competitions")}
          >
            {t.navCompetitions}
          </button>
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            {t.navProgress}
          </button>
          <button
            className={page === "about" ? "active" : ""}
            onClick={() => navigate("about")}
          >
            {t.navAbout}
          </button>
          {(role === "admin" || role === "contributor") && (
            <button
              className={page === "contribute" ? "active" : ""}
              onClick={() => navigate("contribute")}
            >
              {lang === "km" ? "រួមចំណែក" : "Contribute"}
            </button>
          )}
          <div className="mobile-account-actions">
            {user ? (
              <>
                <button onClick={() => navigate("dashboard")}>
                  <img
                    className="nav-profile-picture"
                    src="/default-profile.png"
                    alt=""
                  />
                  <span>{user.email?.split("@")[0]}</span>
                </button>
                <button
                  onClick={() => {
                    onSignOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate("auth")}>{t.login}</button>
                <button
                  className="primary small"
                  onClick={() => navigate("auth")}
                >
                  {t.start}
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </nav>
        <div className="nav-actions">
          <button
            className="lang"
            onClick={() => setLang(lang === "en" ? "km" : "en")}
            aria-label={lang === "en" ? "Switch to Khmer" : "Switch to English"}
          >
            <Globe2 size={17} />
            <span>{lang === "en" ? "ខ្មែរ" : "EN"}</span>
          </button>
          {user ? (
            <>
              <button
                className="login user-login"
                onClick={() => go("dashboard")}
              >
                <img
                  className="nav-profile-picture"
                  src="/default-profile.png"
                  alt=""
                />
                {user.email?.split("@")[0]}
              </button>
              <button className="signout" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="login" onClick={() => go("auth")}>
                {t.login}
              </button>
              <button className="primary small" onClick={() => go("auth")}>
                {t.start}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="primary-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

function MathOrb() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-a">
        <span>π</span>
      </div>
      <div className="orbit orbit-b">
        <span>∑</span>
      </div>
      <div className="paper">
        <div className="paper-top">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="formula">a² + b² = c²</div>
        <div className="diagram">
          <i className="tri"></i>
          <b>?</b>
        </div>
        <div className="lines">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
      <div className="float-card card-check">
        <CheckCircle2 size={24} />
        <span>
          <b>Nice work!</b>
          <small>Elegant solution</small>
        </span>
      </div>
      <div className="float-card card-streak">
        <Flame size={23} />
        <span>
          <b>7 day streak</b>
          <small>Keep it going</small>
        </span>
      </div>
    </div>
  );
}

function ContestCard({
  c,
  t,
  go,
}: {
  c: Contest;
  t: typeof copy.en;
  go: (p: Page) => void;
}) {
  return (
    <article className="contest-card" onClick={() => go("competitions")}>
      <div className="contest-top">
        <div className="contest-icon" style={{ background: c.color }}>
          {c.icon}
        </div>
        <span className={"level " + c.level.toLowerCase()}>{c.level}</span>
      </div>
      <span className="contest-short">{c.short}</span>
      <h3>{c.name}</h3>
      <p>{c.desc}</p>
      <div className="contest-meta">
        <span>
          <BookOpen size={15} />
          {c.count} {t.problems}
        </span>
        <span>
          <Clock3 size={15} />
          {c.years}
        </span>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          go("competitions");
        }}
      >
        {t.viewAll}
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function LegacyAbout({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = aboutCopy[lang];
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="kicker">{t.eyebrow}</span>
          <h1>
            {t.titleA} <em>{t.titleB}</em>
          </h1>
          <p>{t.intro}</p>
        </div>
        <div className="about-hero-mark" aria-hidden="true">
          <div className="about-thinking-path">
            <span><small>01</small><strong>question</strong></span>
            <i>↘</i>
            <span><small>02</small><strong>idea</strong></span>
            <i>↘</i>
            <span><small>03</small><strong>breakthrough</strong></span>
          </div>
          <p>Every answer begins with a better question.</p>
        </div>
      </section>

      <section className="about-stories" aria-label={t.eyebrow}>
        <article className="about-story about-story-build">
          <span className="about-story-number" aria-hidden="true">01</span>
          <div className="about-story-copy">
            <span className="about-story-label">
              <BookOpen size={17} />
              {t.buildLabel}
            </span>
            <h2>{t.buildTitle}</h2>
            <p>{t.buildText}</p>
          </div>
          <div className="about-story-card" aria-hidden="true">
            <span className="about-card-formula">idea → insight</span>
            <strong>{t.buildNote}</strong>
            <i></i>
          </div>
        </article>

        <article className="about-story about-story-mission">
          <span className="about-story-number" aria-hidden="true">02</span>
          <div className="about-story-copy">
            <span className="about-story-label">
              <Target size={17} />
              {t.missionLabel}
            </span>
            <h2>{t.missionTitle}</h2>
            <p>{t.missionText}</p>
          </div>
          <div className="about-story-card" aria-hidden="true">
            <span className="about-card-formula">challenge + patience</span>
            <strong>{t.missionNote}</strong>
            <i></i>
          </div>
        </article>

        <article className="about-story about-story-serve">
          <span className="about-story-number" aria-hidden="true">03</span>
          <div className="about-story-copy">
            <span className="about-story-label">
              <Users size={17} />
              {t.serveLabel}
            </span>
            <h2>{t.serveTitle}</h2>
            <p>{t.serveText}</p>
          </div>
          <div className="about-story-card" aria-hidden="true">
            <span className="about-card-formula">curiosity × community</span>
            <strong>{t.serveNote}</strong>
            <i></i>
          </div>
        </article>
      </section>

      <section className="about-closing">
        <span aria-hidden="true">∞</span>
        <div>
          <h2>{t.closing}</h2>
          <button className="primary light" onClick={() => go("competitions")}>
            {t.action}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function EditorialAbout({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = aboutCopy[lang];
  const buildParts = [
    [t.problemLabel, t.problemText],
    [t.hintLabel, t.hintText],
    [t.solutionLabel, t.solutionText],
  ];
  const audiences = [
    [t.beginningLabel, t.beginningText, t.beginningRole],
    [t.advancingLabel, t.advancingText, t.advancingRole],
    [t.guidingLabel, t.guidingText, t.guidingRole],
  ];

  return (
    <main className="about-page about-editorial">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="kicker">{t.eyebrow}</span>
          <h1>
            {t.titleA} <em>{t.titleB}</em>
          </h1>
          <p>{t.intro}</p>
        </div>

        <figure className="about-proof" aria-hidden="true">
          <svg viewBox="0 0 460 500" role="presentation">
            <g className="about-proof-ruling">
              <path d="M24 96H432M24 196H432M24 296H432M24 396H432" />
              <path d="M124 28V468M224 28V468M324 28V468" />
            </g>
            <g className="about-proof-layers">
              <path className="layer layer-1" d="M194 218h32v32h-32z" />
              <path className="layer layer-2" d="M162 186h96v32M258 186v96h-32" />
              <path className="layer layer-3" d="M130 154h160v32M290 154v160h-32" />
              <path className="layer layer-4" d="M98 122h224v32M322 122v224h-32" />
              <path className="layer layer-accent" d="M66 90h288v32M354 90v288h-32" />
            </g>
            <g className="about-proof-counts">
              <text x="205" y="242">1</text>
              <text x="267" y="206">3</text>
              <text x="299" y="174">5</text>
              <text x="331" y="142">7</text>
            </g>
            <text className="about-proof-equation" x="52" y="438">
              1 + 3 + 5 + ··· + (2n − 1) = n²
            </text>
            <path className="about-proof-underline" d="M50 454C164 467 306 447 410 455" />
          </svg>
        </figure>

        <nav className="about-index" aria-label="About sections">
          <a href="#what-we-build"><small>01</small>{t.buildLabel}</a>
          <a href="#our-mission"><small>02</small>{t.missionLabel}</a>
          <a href="#who-we-serve"><small>03</small>{t.serveLabel}</a>
        </nav>
      </section>

      <section id="what-we-build" className="about-chapter about-build">
        <span className="about-chapter-number" aria-hidden="true">01</span>
        <div className="about-chapter-copy">
          <span className="about-chapter-label">{t.buildLabel}</span>
          <h2>{t.buildTitle}</h2>
          <p>{t.buildText}</p>
        </div>
        <div className="about-library-anatomy">
          {buildParts.map(([label, text], index) => (
            <div key={label}>
              <small>0{index + 1}</small>
              <strong>{label}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="our-mission" className="about-mission">
        <div className="about-mission-inner">
          <span className="about-chapter-number" aria-hidden="true">02</span>
          <div className="about-mission-title">
            <span className="about-chapter-label">{t.missionLabel}</span>
            <h2>{t.missionTitle}</h2>
          </div>
          <div className="about-mission-body">
            <p>{t.missionText}</p>
            <blockquote>{t.missionNote}</blockquote>
          </div>
        </div>
      </section>

      <section id="who-we-serve" className="about-chapter about-serve">
        <span className="about-chapter-number" aria-hidden="true">03</span>
        <div className="about-chapter-copy about-serve-copy">
          <span className="about-chapter-label">{t.serveLabel}</span>
          <h2>{t.serveTitle}</h2>
          <p>{t.serveText}</p>
        </div>
        <div className="about-audiences">
          {audiences.map(([label, text, role], index) => (
            <article key={label}>
              <small>0{index + 1}</small>
              <h3>{label}</h3>
              <p>{text}</p>
              <span>{role}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="about-closing">
        <span className="about-closing-label">{t.closingLabel}</span>
        <h2>{t.closing}</h2>
        <button className="primary" onClick={() => go("competitions")}>
          {t.action}
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function LetterAbout({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = aboutCopy[lang];
  return (
    <main className="about-page about-editorial about-letter-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="kicker">{t.eyebrow}</span>
          <h1>
            {t.titleA} <em>{t.titleB}</em>
          </h1>
          <p>{t.intro}</p>
        </div>

        <figure className="about-proof" aria-hidden="true">
          <svg viewBox="0 0 460 500" role="presentation">
            <g className="about-proof-ruling">
              <path d="M24 96H432M24 196H432M24 296H432M24 396H432" />
              <path d="M124 28V468M224 28V468M324 28V468" />
            </g>
            <g className="about-proof-layers">
              <path className="layer layer-1" d="M194 218h32v32h-32z" />
              <path className="layer layer-2" d="M162 186h96v32M258 186v96h-32" />
              <path className="layer layer-3" d="M130 154h160v32M290 154v160h-32" />
              <path className="layer layer-4" d="M98 122h224v32M322 122v224h-32" />
              <path className="layer layer-accent" d="M66 90h288v32M354 90v288h-32" />
            </g>
            <g className="about-proof-counts">
              <text x="205" y="242">1</text>
              <text x="267" y="206">3</text>
              <text x="299" y="174">5</text>
              <text x="331" y="142">7</text>
            </g>
            <text className="about-proof-equation" x="52" y="438">
              1 + 3 + 5 + ··· + (2n − 1) = n²
            </text>
            <path className="about-proof-underline" d="M50 454C164 467 306 447 410 455" />
          </svg>
        </figure>

        <nav className="about-index" aria-label="About sections">
          <a href="#what-we-build"><small>01</small>{t.buildLabel}</a>
          <a href="#our-mission"><small>02</small>{t.missionLabel}</a>
          <a href="#who-we-serve"><small>03</small>{t.serveLabel}</a>
        </nav>
      </section>

      <section className="about-letter" aria-label={t.eyebrow}>
        <svg
          className="about-letter-thread"
          viewBox="0 0 100 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M18 0 C24 155 9 260 21 410 C29 560 10 705 19 1000" />
        </svg>

        <div className="about-letter-inner">
          <section id="what-we-build" className="about-passage passage-build">
            <header className="about-passage-heading">
              <span className="about-passage-index">01 / {t.buildLabel}</span>
              <h2>{t.buildTitle}</h2>
            </header>
            <div className="about-passage-body">
              <p>{t.buildText}</p>
            </div>
            <aside className="about-ink-note about-build-note">
              <span>{t.buildNote}</span>
              <svg viewBox="0 0 180 20" aria-hidden="true">
                <path d="M3 12C42 4 104 18 177 8" />
              </svg>
            </aside>
          </section>

          <section id="our-mission" className="about-passage passage-mission">
            <span className="about-passage-index">02 / {t.missionLabel}</span>
            <h2>{t.missionTitle}</h2>
            <div className="about-mission-copy">
              <p>{t.missionText}</p>
              <blockquote>{t.missionNote}</blockquote>
            </div>
            <span className="about-proof-mark" aria-hidden="true">∴</span>
          </section>

          <section id="who-we-serve" className="about-passage passage-serve">
            <header className="about-passage-heading">
              <span className="about-passage-index">03 / {t.serveLabel}</span>
              <h2>{t.serveTitle}</h2>
            </header>
            <div className="about-passage-body">
              <p>{t.serveText}</p>
              <p className="about-serve-note">{t.serveNote}</p>
            </div>
            <div className="about-pencil-bracket" aria-hidden="true">
              <span></span>
              <small>{t.communityNote}</small>
            </div>
          </section>

          <footer className="about-postscript">
            <span className="about-postscript-label">P.S.</span>
            <h2>{t.closing}</h2>
            <button className="primary" onClick={() => go("competitions")}>
              {t.action}
              <ArrowRight size={18} />
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function About({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = aboutCopy[lang];
  return (
    <main className="about-page about-editorial about-poster-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="kicker">{t.eyebrow}</span>
          <h1>
            {t.titleA} <em>{t.titleB}</em>
          </h1>
          <p>{t.intro}</p>
        </div>

        <figure className="about-proof" aria-hidden="true">
          <svg viewBox="0 0 460 500" role="presentation">
            <g
              className="about-proof-ruling"
              fill="none"
              stroke="#102440"
              strokeWidth="1"
            >
              <path fill="none" d="M24 96H432M24 196H432M24 296H432M24 396H432" />
              <path fill="none" d="M124 28V468M224 28V468M324 28V468" />
            </g>
            <g
              className="about-proof-layers"
              fill="none"
              stroke="#1e57d2"
              strokeWidth="3"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <rect className="layer layer-1" x="194" y="218" width="32" height="32" fill="none" />
              <polyline className="layer layer-2" points="162,186 258,186 258,282 226,282" fill="none" />
              <polyline className="layer layer-3" points="130,154 290,154 290,314 258,314" fill="none" />
              <polyline className="layer layer-4" points="98,122 322,122 322,346 290,346" fill="none" />
              <polyline
                className="layer layer-accent"
                points="66,90 354,90 354,378 322,378"
                fill="none"
                stroke="#e28b31"
              />
            </g>
            <g className="about-proof-counts" fill="#102440">
              <text x="205" y="242">1</text>
              <text x="267" y="206">3</text>
              <text x="299" y="174">5</text>
              <text x="331" y="142">7</text>
            </g>
            <text className="about-proof-equation" x="52" y="438" fill="#102440">
              1 + 3 + 5 + ··· + (2n − 1) = n²
            </text>
            <path
              className="about-proof-underline"
              d="M50 454C164 467 306 447 410 455"
              fill="none"
              stroke="#e28b31"
            />
          </svg>
        </figure>

        <nav className="about-index" aria-label="About sections">
          <a href="#what-we-build"><small>01</small>{t.buildLabel}</a>
          <a href="#our-mission"><small>02</small>{t.missionLabel}</a>
          <a href="#who-we-serve"><small>03</small>{t.serveLabel}</a>
        </nav>
      </section>

      <section className="about-editorial-sections">
        <article id="what-we-build" className="about-spread spread-build">
          <span className="about-ghost-word" aria-hidden="true">BUILD</span>
          <div className="about-spread-copy">
            <small>01 / {t.buildLabel}</small>
            <h2>{t.buildTitle}</h2>
            <p>{t.buildText}</p>
            <em>{t.buildNote}</em>
          </div>
        </article>

        <article id="our-mission" className="about-spread spread-believe">
          <span className="about-ghost-word" aria-hidden="true">BELIEVE</span>
          <div className="about-spread-copy">
            <small>02 / {t.missionLabel}</small>
            <h2>{t.missionTitle}</h2>
            <p>{t.missionText}</p>
            <blockquote>{t.missionNote}</blockquote>
          </div>
        </article>

        <article id="who-we-serve" className="about-spread spread-belong">
          <span className="about-ghost-word" aria-hidden="true">BELONG</span>
          <div className="about-spread-copy">
            <small>03 / {t.serveLabel}</small>
            <h2>{t.serveTitle}</h2>
            <p>{t.serveText}</p>
            <em>{t.serveNote}</em>
          </div>
        </article>
      </section>

      <section className="about-closing-poster">
        <div className="about-closing-words" aria-hidden="true">
          <span>START</span>
          <span>WITH</span>
          <span>ONE</span>
        </div>
        <div className="about-closing-poster-content">
          <h2>{t.closing}</h2>
          <button className="primary" onClick={() => go("competitions")}>
            {t.action}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function Home({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = copy[lang],
    guide = walkthrough[lang];
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} />
            {t.eyebrow}
          </div>
          <h1>
            {t.heroA}
            <br />
            <em>{t.heroB}</em>
          </h1>
          <p>{t.heroText}</p>
          <div className="hero-buttons">
            <button className="primary" onClick={() => go("competitions")}>
              {t.start}
              <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => go("competitions")}>
              {t.browse}
            </button>
          </div>
          <div className="free-note">
            <span>
              <Check size={14} />
            </span>
            {t.free}
          </div>
        </div>
        <MathOrb />
      </section>
      <section className="trust">
        <p>{t.trusted}</p>
        <div className="trust-row">
          <span>IMO</span>
          <i></i>
          <span>AMC</span>
          <i></i>
          <span>KANGAROO</span>
          <i></i>
          <span>SEAMO</span>
          <i></i>
          <span>CMO</span>
        </div>
      </section>
      <section className="walkthrough section">
        <div className="walkthrough-heading">
          <span className="kicker">{guide.kicker}</span>
          <h2>{guide.title}</h2>
          <p>{guide.intro}</p>
        </div>
        <div className="walkthrough-list">
          {guide.steps.map((step, index) => (
            <Fragment key={step.number}>
              <article className="walkthrough-step">
                <div className="walkthrough-image">
                  <div className="walkthrough-browser">
                    <div className="walkthrough-browser-bar" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                      <small>lumhat.app</small>
                    </div>
                    <div className="walkthrough-screen">
                      <img
                        src={`/step${index + 1}.png`}
                        alt={`Step ${index + 1}: ${step.title}`}
                      />
                      <div className={`cursor-mark cursor-mark-${index + 1}`} aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                        <MousePointer2 />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="walkthrough-copy">
                  <span>{step.number}</span>
                  <small>{step.label}</small>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
              {index < guide.steps.length - 1 && (
                <div className="step-connector" aria-hidden="true">
                  <span className="connector-dot dot-one"></span>
                  <span className="connector-dot dot-two"></span>
                  <MousePointer2 className="connector-cursor" />
                  <ArrowRight className="connector-arrow" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </section>
      <section className="cta section">
        <div className="cta-shape">∑</div>
        <div>
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaText}</p>
        </div>
        <button className="primary light" onClick={() => go("auth")}>
          {t.start}
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function Competitions({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = copy[lang],
    available = useCompetitions(lang);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All levels");
  const filtered = useMemo(
    () =>
      available.filter(
        (c) =>
          (filter === "All levels" || c.level === filter) &&
          `${c.name} ${c.short}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, filter, available],
  );
  return (
    <main className="page-shell">
      <section className="page-title">
        <span className="kicker">QUESTION BANK</span>
        <h1>{t.compTitle}</h1>
        <p>{t.compSub}</p>
      </section>
      <section className="controls">
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
          />
        </label>
        <div className="filters">
          {[
            ["All levels", t.all],
            ["Beginner", t.begin],
            ["Intermediate", t.inter],
            ["Advanced", t.advanced],
          ].map(([v, n]) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>
      <div className="contest-grid">
        {filtered.map((c) => (
          <ContestCard key={c.id} c={c} t={t} go={go} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty">
          <CircleHelp size={32} />
          <h3>No competitions found</h3>
          <p>Try a different search or level.</p>
        </div>
      )}
    </main>
  );
}

function Practice({
  lang,
  go,
  user,
}: {
  lang: Lang;
  go: (p: Page) => void;
  user: AuthUser | null;
}) {
  const [choice, setChoice] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    [hint, setHint] = useState(false),
    [solution, setSolution] = useState(false),
    [saveNote, setSaveNote] = useState("");
  const correct = choice === 2;
  const checkAnswer = async () => {
    if (choice === null || checked) return;
    setChecked(true);
    if (!user || !supabase) return;
    const { error } = await supabase.rpc("record_unranked_practice_attempt", {
      target_key: "imo-number-theory-demo-001",
      submitted_response: { choice },
    });
    setSaveNote(
      error
        ? "Answer checked. Your database schema must be installed before activity can be saved."
        : "Saved to your profile.",
    );
  };
  return (
    <main className="practice-page">
      <div className="practice-bar">
        <button onClick={() => go("competitions")}>
          <ArrowLeft size={18} />
          Competitions
        </button>
        <div>
          <span>IMO · Number Theory</span>
          <b>Problem 3 of 12</b>
        </div>
        <button className="outline-btn">
          <Settings size={17} />
          Settings
        </button>
      </div>
      <div className="progress-line">
        <i style={{ width: "25%" }}></i>
      </div>
      <div className="practice-layout">
        <aside>
          <div className="qnav-head">
            <b>Problems</b>
            <span>3 / 12</span>
          </div>
          <div className="qgrid">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                className={i === 2 ? "current" : i < 2 ? "done" : ""}
                key={i}
              >
                {i < 2 ? <Check size={14} /> : i + 1}
              </button>
            ))}
          </div>
          <div className="session">
            <Clock3 />
            <div>
              <span>Session time</span>
              <b>08:42</b>
            </div>
          </div>
        </aside>
        <section className="problem">
          <div className="problem-tags">
            <span className="level advanced">Advanced</span>
            <span>Number Theory</span>
            <span>2023</span>
          </div>
          <div className="problem-no">
            Problem 3{" "}
            <button>
              <Award size={17} /> 7 points
            </button>
          </div>
          <h2>
            Let <i>p</i> be a prime number. If <span className="math">p</span>{" "}
            divides <span className="math">n² + 1</span> for some positive
            integer <i>n</i>, which statement must be true?
          </h2>
          <p className="instruction">
            Choose the strongest conclusion that follows for every possible
            prime <i>p</i>.
          </p>
          <div className="answers">
            {[
              "p is always odd",
              "p ≡ 3 (mod 4)",
              "p = 2 or p ≡ 1 (mod 4)",
              "p divides n + 1",
            ].map((a, i) => (
              <button
                disabled={checked}
                onClick={() => setChoice(i)}
                className={`${choice === i ? "chosen" : ""} ${checked && i === 2 ? "right" : ""} ${checked && choice === i && i !== 2 ? "wrong" : ""}`}
                key={a}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {a}
                {checked && i === 2 && <CheckCircle2 />}
              </button>
            ))}
          </div>
          {checked && (
            <div className={"feedback " + (correct ? "correct" : "incorrect")}>
              <div>
                {correct ? <CheckCircle2 /> : <CircleHelp />}
                <span>
                  <b>
                    {correct
                      ? "Exactly right!  +35 XP"
                      : "Not quite—keep going.  +8 XP"}
                  </b>
                  <small>
                    {correct
                      ? "Your Number Theory rating increased by 6."
                      : "Review the idea and protect your practice streak."}
                  </small>
                </span>
              </div>
              <button onClick={() => setSolution(true)}>
                View solution
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="problem-actions">
            <button className="hint-btn" onClick={() => setHint(!hint)}>
              <Lightbulb size={18} />
              {hint ? "Hide hint" : "Show a hint"}
            </button>
            <button
              className="primary"
              disabled={choice === null || checked}
              onClick={checkAnswer}
            >
              {checked ? "Answer checked" : "Check answer"}
            </button>
          </div>
          {!user && !checked && (
            <button className="practice-login-note" onClick={() => go("auth")}>
              <LockKeyhole /> Sign in to save XP and practice records
            </button>
          )}
          {saveNote && (
            <div className="save-note">
              <CheckCircle2 />
              {saveNote}
            </div>
          )}
          {hint && (
            <div className="hint">
              <b>
                <Lightbulb size={17} /> Hint 1
              </b>
              <p>
                Start by checking the smallest positive integers. For larger{" "}
                <i>n</i>, consider what prime factors of{" "}
                <span className="math">n² + 1</span> imply.
              </p>
            </div>
          )}
          {solution && (
            <div className="solution">
              <div>
                <b>Solution</b>
                <button onClick={() => setSolution(false)}>
                  <X />
                </button>
              </div>
              <p>
                If <span className="math">p = 2</span>, the claim holds
                directly. Now suppose <i>p</i> is odd. Since{" "}
                <span className="math">n² ≡ −1 (mod p)</span>, raising both
                sides to the power <span className="math">(p − 1)/2</span> and
                using Fermat’s little theorem shows that{" "}
                <span className="math">(−1)^((p−1)/2) ≡ 1</span>. Therefore{" "}
                <span className="math">(p − 1)/2</span> is even, so{" "}
                <span className="math">p ≡ 1 (mod 4)</span>.
              </p>
              <p>
                Thus every such prime is either 2 or congruent to 1 modulo 4.
              </p>
            </div>
          )}
        </section>
        <aside className="side-info">
          <div>
            <span>DIFFICULTY</span>
            <b>
              <Gauge size={18} /> Advanced
            </b>
          </div>
          <div>
            <span>SOURCE</span>
            <b>IMO Shortlist 2023</b>
          </div>
          <div>
            <span>SOLVED BY</span>
            <b>
              <Users size={18} /> 1,284 students
            </b>
          </div>
          <div className="rate">
            <span>SUCCESS RATE</span>
            <b>38%</b>
            <i>
              <em style={{ width: "38%" }}></em>
            </i>
          </div>
        </aside>
      </div>
    </main>
  );
}

type MemberRecord = {
  displayName: string;
  joined: string;
  answered: number;
  practiced: number;
  correct: number;
  accuracy: number;
};

function useMemberRecord(user: AuthUser) {
  const fallbackName = String(
    user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "Math learner",
  );
  const [record, setRecord] = useState<MemberRecord>({
    displayName: fallbackName,
    joined: user.created_at,
    answered: 0,
    practiced: 0,
    correct: 0,
    accuracy: 0,
  });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase
        .from("profiles")
        .select("display_name, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("attempts")
        .select("problem_id, practice_key, is_correct")
        .eq("user_id", user.id),
    ]).then(([profileResult, attemptResult]) => {
      if (!active) return;
      const attempts = attemptResult.data ?? [];
      const practiced = new Set(
        attempts.map((a) => a.problem_id || a.practice_key).filter(Boolean),
      ).size;
      const correct = attempts.filter((a) => a.is_correct === true).length;
      setRecord({
        displayName: profileResult.data?.display_name || fallbackName,
        joined: profileResult.data?.created_at || user.created_at,
        answered: attempts.length,
        practiced,
        correct,
        accuracy: attempts.length
          ? Math.round((correct / attempts.length) * 100)
          : 0,
      });
    });
    return () => {
      active = false;
    };
  }, [user.id, user.created_at, fallbackName]);
  return record;
}

function ProfileGate({ go }: { go: (p: Page) => void }) {
  return (
    <main className="profile-gate">
      <div className="gate-art">
        <div className="gate-orbit">
          <UserRound />
        </div>
        <span className="gate-badge">
          <Trophy />
        </span>
        <span className="gate-badge second">
          <Star />
        </span>
      </div>
      <span className="kicker">YOUR LEARNING RECORD</span>
      <h1>Sign in to see your profile</h1>
      <p>
        Your solved problems, answer history, XP, topic ratings, achievements,
        and join date are private to your account.
      </p>
      <div>
        <button className="primary" onClick={() => go("auth")}>
          Log in <ArrowRight />
        </button>
        <button className="secondary" onClick={() => go("auth")}>
          Create a free account
        </button>
      </div>
      <small>
        <ShieldCheck /> We only show account records to the signed-in learner.
      </small>
    </main>
  );
}

function Dashboard({
  lang,
  go,
  user,
}: {
  lang: Lang;
  go: (p: Page) => void;
  user: AuthUser;
}) {
  const t = copy[lang];
  const record = useMemberRecord(user);
  const joinedLabel = new Intl.DateTimeFormat(
    lang === "km" ? "km-KH" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(record.joined));
  const memberInitials = record.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const memberXp = record.correct * 35;
  const skills = [
    ["Number Theory", 72, 1246, "#e95d44"],
    ["Geometry", 61, 1138, "#315fcb"],
    ["Algebra", 54, 1084, "#7c54c4"],
    ["Combinatorics", 46, 972, "#2e9d7b"],
  ];
  const leaders = [
    ["1", "ML", "Maly Lim", "2,840"],
    ["2", "DV", "Davy Vann", "2,615"],
    ["3", "SP", "Sovann Phan", "2,490"],
    ["—", memberInitials, record.displayName, String(memberXp)],
  ];
  return (
    <main className="profile-page page-shell">
      <section className="profile-hero">
        <div className="profile-person">
          <div className="profile-avatar">
            {memberInitials}
            <span>1</span>
          </div>
          <div>
            <span className="online">
              <i></i> ACTIVE LEARNER
            </span>
            <h1>{record.displayName}</h1>
            <p>
              {user.email} · Joined {joinedLabel}
            </p>
            <div className="profile-tags">
              <span>
                <Trophy /> New Explorer
              </span>
              <span>
                <Flame /> Start your streak
              </span>
            </div>
          </div>
        </div>
        <div className="profile-level">
          <div className="level-ring">
            <span>
              <b>1</b>
              <small>LEVEL</small>
            </span>
          </div>
          <div>
            <span>Problem Solver</span>
            <b>
              {memberXp} <small>XP</small>
            </b>
            <i>
              <em
                style={{ width: `${Math.min(record.correct * 7, 100)}%` }}
              ></em>
            </i>
            <small>{Math.max(500 - memberXp, 0)} XP to Level 2</small>
          </div>
        </div>
      </section>

      <div className="profile-tabs">
        <button className="active">Overview</button>
        <button>
          Achievements <span>12</span>
        </button>
        <button>Competition history</button>
        <button>Saved problems</button>
      </div>

      <section className="weekly-banner">
        <div className="league-medal">
          <Crown />
        </div>
        <div>
          <span>WEEKLY LEAGUE · STARTER DIVISION</span>
          <h2>
            {record.answered ? (
              <>
                <em>{memberXp} XP</em> earned this season
              </>
            ) : (
              "Solve your first problem to join"
            )}
          </h2>
          <p>
            {record.answered
              ? "Keep practicing to climb the weekly leaderboard."
              : "Your league record begins with your first saved answer."}
          </p>
        </div>
        <div className="league-race">
          <div className="racer">
            <span>You</span>
            <i>
              <em style={{ width: `${Math.min(memberXp / 30, 100)}%` }}></em>
            </i>
            <b>{memberXp} XP</b>
          </div>
          <div className="racer">
            <span>Next rank</span>
            <i>
              <em style={{ width: "55%" }}></em>
            </i>
            <b>300 XP</b>
          </div>
        </div>
        <button onClick={() => go("competitions")}>
          Earn XP <Zap />
          <ArrowRight />
        </button>
      </section>

      <div className="profile-layout">
        <div className="profile-main">
          <section className="profile-card skill-card">
            <div className="profile-card-head">
              <div>
                <span className="kicker">SKILL RATINGS</span>
                <h2>Your mathematical strengths</h2>
              </div>
              <span className="rating-note">
                <TrendingUp /> +42 this week
              </span>
            </div>
            <div className="overall-rating">
              <div>
                <span>Overall rating</span>
                <b>1,142</b>
                <small>Intermediate · Top 18%</small>
              </div>
              <div className="rating-scale">
                <span>800</span>
                <span>1000</span>
                <span>1200</span>
                <span>1400</span>
                <span>1600</span>
              </div>
            </div>
            <div className="skills">
              {skills.map(([name, pct, rating, color]) => (
                <div className="skill-row" key={name}>
                  <div className="skill-name">
                    <i style={{ background: String(color) }}></i>
                    <span>{name}</span>
                  </div>
                  <div className="skill-bar">
                    <i>
                      <em
                        style={{ width: `${pct}%`, background: String(color) }}
                      ></em>
                    </i>
                    <small>{pct}% mastery</small>
                  </div>
                  <b>{rating}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-head">
              <div>
                <span className="kicker">ACTIVE QUESTS</span>
                <h2>Goals for this week</h2>
              </div>
              <span className="reset-time">
                <Clock3 /> Resets in 2d 14h
              </span>
            </div>
            <div className="quests">
              <div>
                <span className="quest-icon">
                  <Target />
                </span>
                <div>
                  <b>Geometry explorer</b>
                  <small>Solve 12 geometry problems</small>
                  <i>
                    <em style={{ width: "75%" }}></em>
                  </i>
                </div>
                <strong>9/12</strong>
                <span className="xp-pill">+120 XP</span>
              </div>
              <div>
                <span className="quest-icon purple">
                  <Swords />
                </span>
                <div>
                  <b>Challenge streak</b>
                  <small>Get 5 correct answers in a row</small>
                  <i>
                    <em style={{ width: "60%" }}></em>
                  </i>
                </div>
                <strong>3/5</strong>
                <span className="xp-pill">+80 XP</span>
              </div>
              <div className="quest-done">
                <span className="quest-icon complete">
                  <Check />
                </span>
                <div>
                  <b>Daily thinker</b>
                  <small>Practice on 5 different days</small>
                  <i>
                    <em style={{ width: "100%" }}></em>
                  </i>
                </div>
                <strong>5/5</strong>
                <span className="xp-pill">Claimed</span>
              </div>
            </div>
          </section>

          <section className="profile-card continue-profile">
            <div className="profile-card-head">
              <div>
                <span className="kicker">KEEP GOING</span>
                <h2>{t.continue}</h2>
              </div>
              <button>
                View all <ArrowRight />
              </button>
            </div>
            <div className="continue-item">
              <div className="contest-icon" style={{ background: "#e95d44" }}>
                π
              </div>
              <div>
                <b>IMO · Number Theory</b>
                <span>Problem 3 of 12 · Advanced</span>
                <i>
                  <em style={{ width: "25%" }}></em>
                </i>
              </div>
              <button onClick={() => go("competitions")}>
                <ArrowRight />
              </button>
            </div>
            <div className="continue-item">
              <div className="contest-icon" style={{ background: "#315fcb" }}>
                △
              </div>
              <div>
                <b>AMC 12 · Geometry</b>
                <span>Problem 8 of 20 · Intermediate</span>
                <i>
                  <em style={{ width: "40%" }}></em>
                </i>
              </div>
              <button onClick={() => go("competitions")}>
                <ArrowRight />
              </button>
            </div>
          </section>
        </div>
        <aside className="profile-side">
          <section className="profile-card leaderboard">
            <div className="profile-card-head">
              <div>
                <span className="kicker">STARTER DIVISION</span>
                <h2>Weekly leaderboard</h2>
              </div>
              <Medal />
            </div>
            <div className="until">
              <Clock3 /> 2 days left
            </div>
            {leaders.map(([rank, initials, name, xp]) => (
              <div
                className={`leader-row ${name === record.displayName ? "me" : ""}`}
                key={`${rank}-${name}`}
              >
                <b className={`rank r${rank}`}>{rank}</b>
                <span className="mini-avatar">{initials}</span>
                <div>
                  <b>{name}</b>
                  <small>
                    {name === record.displayName ? "You · " : ""}Cambodia
                  </small>
                </div>
                <strong>
                  {xp} <small>XP</small>
                </strong>
              </div>
            ))}
            <button className="full-board">
              View full leaderboard <ArrowRight />
            </button>
          </section>
          <section className="profile-card achievements">
            <div className="profile-card-head">
              <div>
                <span className="kicker">TROPHY CASE</span>
                <h2>Recent achievements</h2>
              </div>
              <span>12 total</span>
            </div>
            <div className="badge-grid">
              <div>
                <span className="badge orange">
                  <Flame />
                </span>
                <b>On Fire</b>
                <small>7 day streak</small>
              </div>
              <div>
                <span className="badge blue">
                  <Star />
                </span>
                <b>Sharp Mind</b>
                <small>10 in a row</small>
              </div>
              <div>
                <span className="badge purple">
                  <Trophy />
                </span>
                <b>CMO Rookie</b>
                <small>First contest</small>
              </div>
              <div className="locked">
                <span className="badge">
                  <LockKeyhole />
                </span>
                <b>Proof Master</b>
                <small>3 more to go</small>
              </div>
            </div>
          </section>
          <section className="profile-card quick-stats">
            <h2>Your account record</h2>
            <div>
              <span>
                <CheckCircle2 /> Questions answered
              </span>
              <b>{record.answered}</b>
            </div>
            <div>
              <span>
                <BookOpen /> Problems practiced
              </span>
              <b>{record.practiced}</b>
            </div>
            <div>
              <span>
                <Target /> Accuracy
              </span>
              <b>{record.accuracy}%</b>
            </div>
            <div>
              <span>
                <Clock3 /> Joined Somnang
              </span>
              <b>{joinedLabel}</b>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

type TrueAttempt = {
  id: number;
  problem_id: string | null;
  practice_key: string | null;
  response: Record<string, unknown> | null;
  is_correct: boolean | null;
  attempted_at: string;
  problem: ProblemRecord | null;
};
type FavoriteProblem = {
  problem_id: string;
  saved_at: string;
  problem: ProblemRecord | null;
};
type TrueRecord = {
  displayName: string;
  joined: string;
  attempts: TrueAttempt[];
  favorites: FavoriteProblem[];
  answered: number;
  practiced: number;
  correct: number;
  accuracy: number;
  streak: number;
  topics: Array<{ name: string; answered: number; correct: number }>;
  loading: boolean;
  error: string;
};

function useTrueMemberRecord(user: AuthUser) {
  const fallbackName = String(
    user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "Math learner",
  );
  const [record, setRecord] = useState<TrueRecord>({
    displayName: fallbackName,
    joined: user.created_at,
    attempts: [],
    favorites: [],
    answered: 0,
    practiced: 0,
    correct: 0,
    accuracy: 0,
    streak: 0,
    topics: [],
    loading: true,
    error: "",
  });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase
        .from("profiles")
        .select("display_name, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("attempts")
        .select(
          "id, problem_id, practice_key, response, is_correct, attempted_at, problem:problems(id,competition_id,title_en,title_km,statement_en,statement_km,solution_en,solution_km,hint_en,hint_km,topic,tags,difficulty,year,problem_number,points,answer)",
        )
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false }),
      supabase
        .from("saved_problems")
        .select(
          "problem_id,saved_at,problem:problems(id,competition_id,title_en,title_km,statement_en,statement_km,solution_en,solution_km,hint_en,hint_km,topic,tags,difficulty,year,problem_number,points,answer)",
        )
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
    ]).then(([profileResult, attemptResult, favoriteResult]) => {
      if (!active) return;
      if (profileResult.error || attemptResult.error || favoriteResult.error) {
        setRecord((current) => ({
          ...current,
          loading: false,
          error:
            "Your account is signed in, but Lumhat could not load its database records.",
        }));
        return;
      }
      const attempts = (attemptResult.data ?? []).map((attempt) => ({
        ...attempt,
        problem: attempt.problem ? normalizeProblem(attempt.problem) : null,
      })) as unknown as TrueAttempt[];
      const favorites = (favoriteResult.data ?? []).map((favorite) => ({
        ...favorite,
        problem: favorite.problem ? normalizeProblem(favorite.problem) : null,
      })) as unknown as FavoriteProblem[];
      setRecord({
        displayName: profileResult.data?.display_name || fallbackName,
        joined: profileResult.data?.created_at || user.created_at,
        attempts,
        favorites,
        answered: attempts.length,
        practiced: new Set(attempts.map((a) => a.problem_id || a.practice_key)).size,
        correct: attempts.filter((a) => a.is_correct).length,
        accuracy: 0,
        streak: 0,
        topics: [],
        loading: false,
        error: "",
      });
    });
    return () => {
      active = false;
    };
  }, [user.id, user.created_at, fallbackName]);
  return record;
}

function TruthfulPractice({
  go,
  user,
}: {
  go: (p: Page) => void;
  user: AuthUser | null;
}) {
  const [choice, setChoice] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    [hint, setHint] = useState(false),
    [solution, setSolution] = useState(false),
    [saveNote, setSaveNote] = useState(""),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const correct = choice === 2;
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const checkAnswer = async () => {
    if (choice === null || checked) return;
    setChecked(true);
    if (!user || !supabase) return;
    const { error } = await supabase.rpc("record_unranked_practice_attempt", {
      target_key: "lumhat-original-number-theory-001",
      submitted_response: {
          choice,
          topic: "Number Theory",
          title: "Prime divisors of n² + 1",
      },
    });
    setSaveNote(
      error
        ? "The answer was checked, but it could not be saved. Please install the latest database schema."
        : "This attempt was saved to your profile.",
    );
  };
  return (
    <main className="practice-page">
      <div className="practice-bar">
        <button onClick={() => go("competitions")}>
          <ArrowLeft size={18} />
          Question bank
        </button>
        <div>
          <span>Lumhat original · Number Theory</span>
          <b>Practice challenge</b>
        </div>
        <button className="outline-btn">
          <Clock3 size={17} />
          {time}
        </button>
      </div>
      <div className="progress-line">
        <i style={{ width: checked ? "100%" : "0%" }}></i>
      </div>
      <div className="practice-layout truthful-practice">
        <aside>
          <div className="qnav-head">
            <b>This session</b>
            <span>1 problem</span>
          </div>
          <div className="qgrid one">
            <button className={checked ? "done" : "current"}>
              {checked ? <Check size={14} /> : 1}
            </button>
          </div>
          <div className="session">
            <Clock3 />
            <div>
              <span>Actual session time</span>
              <b>{time}</b>
            </div>
          </div>
        </aside>
        <section className="problem">
          <div className="problem-tags">
            <span className="level advanced">Advanced</span>
            <span>Number Theory</span>
          </div>
          <div className="problem-no">
            Lumhat practice{" "}
            <button>
              <Award size={17} /> Original
            </button>
          </div>
          <h2>
            Let <i>p</i> be a prime number. If <span className="math">p</span>{" "}
            divides <span className="math">n² + 1</span> for some positive
            integer <i>n</i>, which statement must be true?
          </h2>
          <p className="instruction">
            Choose the strongest conclusion that follows for every possible
            prime <i>p</i>.
          </p>
          <div className="answers">
            {[
              "p is always odd",
              "p ≡ 3 (mod 4)",
              "p = 2 or p ≡ 1 (mod 4)",
              "p divides n + 1",
            ].map((a, i) => (
              <button
                disabled={checked}
                onClick={() => setChoice(i)}
                className={`${choice === i ? "chosen" : ""} ${checked && i === 2 ? "right" : ""} ${checked && choice === i && i !== 2 ? "wrong" : ""}`}
                key={a}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {a}
                {checked && i === 2 && <CheckCircle2 />}
              </button>
            ))}
          </div>
          {checked && (
            <div className={"feedback " + (correct ? "correct" : "incorrect")}>
              <div>
                {correct ? <CheckCircle2 /> : <CircleHelp />}
                <span>
                  <b>{correct ? "Correct answer" : "Not correct yet"}</b>
                  <small>
                    {user
                      ? "This result counts only after Supabase confirms it was saved."
                      : "Sign in if you want future attempts saved."}
                  </small>
                </span>
              </div>
              <button onClick={() => setSolution(true)}>
                View solution
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="problem-actions">
            <button className="hint-btn" onClick={() => setHint(!hint)}>
              <Lightbulb size={18} />
              {hint ? "Hide hint" : "Show a hint"}
            </button>
            <button
              className="primary"
              disabled={choice === null || checked}
              onClick={checkAnswer}
            >
              {checked ? "Answer checked" : "Check answer"}
            </button>
          </div>
          {!user && !checked && (
            <button className="practice-login-note" onClick={() => go("auth")}>
              <LockKeyhole /> Sign in to save this attempt
            </button>
          )}
          {saveNote && (
            <div
              className={
                saveNote.startsWith("This")
                  ? "save-note"
                  : "save-note save-error"
              }
            >
              {saveNote.startsWith("This") ? <CheckCircle2 /> : <CircleHelp />}
              {saveNote}
            </div>
          )}
          {hint && (
            <div className="hint">
              <b>
                <Lightbulb size={17} /> Hint
              </b>
              <p>
                For odd <i>p</i>, use Euler’s criterion on the congruence{" "}
                <span className="math">n² ≡ −1 (mod p)</span>.
              </p>
            </div>
          )}
          {solution && (
            <div className="solution">
              <div>
                <b>Solution</b>
                <button onClick={() => setSolution(false)}>
                  <X />
                </button>
              </div>
              <p>
                If <span className="math">p = 2</span>, the claim holds
                directly. Suppose <i>p</i> is odd. From{" "}
                <span className="math">n² ≡ −1 (mod p)</span> and Euler’s
                criterion, <span className="math">(−1)^((p−1)/2) ≡ 1</span>.
                Hence <span className="math">(p − 1)/2</span> is even, so{" "}
                <span className="math">p ≡ 1 (mod 4)</span>.
              </p>
              <p>
                Therefore every possible prime is either 2 or congruent to 1
                modulo 4.
              </p>
            </div>
          )}
        </section>
        <aside className="side-info">
          <div>
            <span>DIFFICULTY</span>
            <b>
              <Gauge size={18} /> Advanced
            </b>
          </div>
          <div>
            <span>TOPIC</span>
            <b>Number Theory</b>
          </div>
          <div>
            <span>SOURCE</span>
            <b>Lumhat original</b>
          </div>
          <div>
            <span>RECORDING</span>
            <b>{user ? "Signed in" : "Not signed in"}</b>
          </div>
        </aside>
      </div>
    </main>
  );
}

function LegacyTruthfulDashboard({
  lang,
  go,
  user,
}: {
  lang: Lang;
  go: (p: Page) => void;
  user: AuthUser;
}) {
  const record = useTrueMemberRecord(user),
    joinedLabel = new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(record.joined)),
    initials = record.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase(),
    xp = record.correct * 35 + (record.answered - record.correct) * 8,
    level = Math.floor(xp / 500) + 1,
    levelProgress = xp % 500;
  const unavailable = record.loading
    ? "—"
    : record.error
      ? "Unavailable"
      : null;
  return (
    <main className="profile-page page-shell">
      <section className="profile-hero">
        <div className="profile-person">
          <div className="profile-avatar">
            {initials}
            <span>{record.error ? "—" : level}</span>
          </div>
          <div>
            <span className="online">
              <i></i> SIGNED IN
            </span>
            <h1>{record.displayName}</h1>
            <p>
              {user.email} · Joined {joinedLabel}
            </p>
          </div>
        </div>
        <div className="profile-level">
          <div
            className="level-ring"
            style={{
              background: `conic-gradient(#e6a039 0 ${record.error ? 0 : levelProgress / 5}%,#304b6a ${record.error ? 0 : levelProgress / 5}%)`,
            }}
          >
            <span>
              <b>{record.error ? "—" : level}</b>
              <small>LEVEL</small>
            </span>
          </div>
          <div>
            <span>Recorded activity</span>
            <b>
              {record.error ? "—" : xp} <small>XP</small>
            </b>
            <i>
              <em
                style={{ width: `${record.error ? 0 : levelProgress / 5}%` }}
              ></em>
            </i>
            <small>
              {record.error
                ? "Database record unavailable"
                : `${500 - levelProgress} XP to Level ${level + 1}`}
            </small>
          </div>
        </div>
      </section>
      {record.error && (
        <div className="record-warning">
          <CircleHelp />
          {record.error} Run the latest Supabase schema to enable records.
        </div>
      )}
      <div className="truth-stats">
        <div>
          <span>
            <CheckCircle2 />
          </span>
          <p>Questions answered</p>
          <b>{unavailable ?? record.answered}</b>
        </div>
        <div>
          <span>
            <BookOpen />
          </span>
          <p>Problems practiced</p>
          <b>{unavailable ?? record.practiced}</b>
        </div>
        <div>
          <span>
            <Target />
          </span>
          <p>Accuracy</p>
          <b>
            {unavailable ??
              (record.answered ? `${record.accuracy}%` : "No attempts")}
          </b>
        </div>
        <div>
          <span>
            <Flame />
          </span>
          <p>Current streak</p>
          <b>
            {unavailable ??
              `${record.streak} ${record.streak === 1 ? "day" : "days"}`}
          </b>
        </div>
      </div>
      <div className="truth-layout">
        <section className="profile-card">
          <div className="profile-card-head">
            <div>
              <span className="kicker">YOUR DATA</span>
              <h2>Performance by topic</h2>
            </div>
          </div>
          {record.loading ? (
            <div className="record-empty">Loading your activity…</div>
          ) : record.error ? (
            <div className="record-empty">
              <CircleHelp />
              <b>Record unavailable</b>
              <p>
                Lumhat could not read the activity tables, so no values are
                being assumed.
              </p>
            </div>
          ) : record.topics.length ? (
            <div className="true-topics">
              {record.topics.map((topic) => {
                const pct = Math.round((topic.correct / topic.answered) * 100);
                return (
                  <div key={topic.name}>
                    <div>
                      <b>{topic.name}</b>
                      <span>
                        {topic.correct} correct of {topic.answered}
                      </span>
                    </div>
                    <i>
                      <em style={{ width: `${pct}%` }}></em>
                    </i>
                    <strong>{pct}%</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="record-empty">
              <BookOpen />
              <b>No topic activity yet</b>
              <p>
                Your topic record will appear after you submit a signed-in
                practice attempt.
              </p>
              <button className="primary" onClick={() => go("competitions")}>
                Start practicing <ArrowRight />
              </button>
            </div>
          )}
        </section>
        <section className="profile-card account-facts">
          <div className="profile-card-head">
            <div>
              <span className="kicker">ACCOUNT</span>
              <h2>Your information</h2>
            </div>
          </div>
          <div>
            <span>Name</span>
            <b>{record.displayName}</b>
          </div>
          <div>
            <span>Email</span>
            <b>{user.email}</b>
          </div>
          <div>
            <span>Joined Lumhat</span>
            <b>{joinedLabel}</b>
          </div>
          <div>
            <span>User ID</span>
            <code>{user.id.slice(0, 8)}…</code>
          </div>
        </section>
        <section className="profile-card recent-record">
          <div className="profile-card-head">
            <div>
              <span className="kicker">ATTEMPT HISTORY</span>
              <h2>Recent answers</h2>
            </div>
            <span>
              {record.error ? "Unavailable" : `${record.answered} total`}
            </span>
          </div>
          {record.attempts.length ? (
            <div>
              {record.attempts.slice(0, 8).map((a) => (
                <div className="true-attempt" key={a.id}>
                  <span
                    className={a.is_correct ? "attempt-good" : "attempt-bad"}
                  >
                    {a.is_correct ? <Check /> : <X />}
                  </span>
                  <div>
                    <b lang={a.problem?.content_language}>
                      {a.problem
                        ? problemText(a.problem, "statement")
                        : typeof a.response?.statement === "string"
                          ? a.response.statement
                          : typeof a.response?.title === "string"
                            ? a.response.title
                            : a.practice_key || "Practice problem"}
                    </b>
                    <small>
                      {typeof a.response?.topic === "string"
                        ? a.response.topic
                        : "Uncategorized"}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat(
                        lang === "km" ? "km-KH" : "en-US",
                        { dateStyle: "medium", timeStyle: "short" },
                      ).format(new Date(a.attempted_at))}
                    </small>
                  </div>
                  <strong>{a.is_correct ? "Correct" : "Incorrect"}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="record-empty compact">
              <Clock3 />
              <b>
                {record.error ? "Record unavailable" : "No answers recorded"}
              </b>
              <p>
                {record.error
                  ? "No attempt count is shown because the database query failed."
                  : "Only answers successfully saved to your account will appear here."}
              </p>
            </div>
          )}
        </section>
        <section className="profile-card true-milestones">
          <div className="profile-card-head">
            <div>
              <span className="kicker">MILESTONES</span>
              <h2>Earned from your record</h2>
            </div>
          </div>
          {record.error ? (
            <div className="record-empty compact">
              <LockKeyhole />
              <b>Milestones unavailable</b>
              <p>Achievements appear only when activity can be verified.</p>
            </div>
          ) : (
            <>
              <div className={record.answered >= 1 ? "earned" : ""}>
                <span>
                  <Star />
                </span>
                <div>
                  <b>First step</b>
                  <small>Answer your first question</small>
                </div>
                <strong>
                  {record.answered >= 1 ? "Earned" : "Not earned"}
                </strong>
              </div>
              <div className={record.correct >= 10 ? "earned" : ""}>
                <span>
                  <Trophy />
                </span>
                <div>
                  <b>Ten correct</b>
                  <small>Answer 10 questions correctly</small>
                </div>
                <strong>
                  {record.correct >= 10 ? "Earned" : `${record.correct}/10`}
                </strong>
              </div>
              <div className={record.streak >= 7 ? "earned" : ""}>
                <span>
                  <Flame />
                </span>
                <div>
                  <b>Seven-day streak</b>
                  <small>Practice for 7 consecutive days</small>
                </div>
                <strong>
                  {record.streak >= 7 ? "Earned" : `${record.streak}/7`}
                </strong>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function TruthfulDashboard({
  lang,
  go,
  user,
  onOpenProblem,
}: {
  lang: Lang;
  go: (p: Page) => void;
  user: AuthUser;
  onOpenProblem: (problem: ProblemRecord) => void;
}) {
  const record = useTrueMemberRecord(user);
  const joinedLabel = new Intl.DateTimeFormat(
    lang === "km" ? "km-KH" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(record.joined));
  const initials = record.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  const attemptLabel = (attempt: TrueAttempt) =>
    attempt.problem
      ? problemText(attempt.problem, "statement")
      : typeof attempt.response?.statement === "string"
        ? attempt.response.statement
        : typeof attempt.response?.title === "string"
          ? attempt.response.title
          : attempt.practice_key || "Practice problem";
  return (
    <main className="profile-page page-shell">
      <section className="profile-hero simple-profile-hero">
        <div className="profile-person">
          <div className="profile-avatar fixed-profile-picture">
            <img src="/default-profile.png" alt="Default profile" />
          </div>
          <div>
            <span className="online"><i /> SIGNED IN</span>
            <h1>{record.displayName}</h1>
            <p>{user.email} · Joined {joinedLabel}</p>
          </div>
        </div>
      </section>
      {record.error && (
        <div className="record-warning">
          <CircleHelp /> {record.error}
        </div>
      )}
      <div className="truth-layout profile-problem-lists">
        <section className="profile-card problem-record-card">
          <div className="profile-card-head">
            <div>
              <span className="kicker">PROBLEM HISTORY</span>
              <h2>Past problems</h2>
            </div>
            <span>{record.error ? "Unavailable" : `${record.attempts.length} attempts`}</span>
          </div>
          {record.loading ? (
            <div className="record-empty compact">Loading your problems…</div>
          ) : record.attempts.length ? (
            <div>
              {record.attempts.map((attempt) => (
                <button
                  className="profile-problem-row"
                  key={attempt.id}
                  disabled={!attempt.problem}
                  onClick={() => attempt.problem && onOpenProblem(attempt.problem)}
                >
                  <span className="history-icon"><Clock3 /></span>
                  <div>
                    <b lang={attempt.problem?.content_language}>
                      <MathContent
                        as="span"
                        lang={attempt.problem?.content_language}
                      >
                        {attemptLabel(attempt)}
                      </MathContent>
                    </b>
                    <small>
                      {attempt.problem?.topic ||
                        (typeof attempt.response?.topic === "string"
                          ? attempt.response.topic
                          : "Practice")} · {date(attempt.attempted_at)}
                    </small>
                  </div>
                  {attempt.problem && <ArrowRight />}
                </button>
              ))}
            </div>
          ) : (
            <div className="record-empty compact">
              <BookOpen />
              <b>{record.error ? "History unavailable" : "No past problems yet"}</b>
              <p>{record.error ? "Lumhat could not load your problem history." : "Problems you attempt while signed in will appear here."}</p>
              {!record.error && <button className="primary" onClick={() => go("competitions")}>Start practicing <ArrowRight /></button>}
            </div>
          )}
        </section>
        <section className="profile-card problem-record-card">
          <div className="profile-card-head">
            <div>
              <span className="kicker">SAVED FOR LATER</span>
              <h2>Favorite problems</h2>
            </div>
            <span>{record.error ? "Unavailable" : `${record.favorites.length} saved`}</span>
          </div>
          {record.loading ? (
            <div className="record-empty compact">Loading your favorites…</div>
          ) : record.favorites.length ? (
            <div>
              {record.favorites.map((favorite) =>
                favorite.problem ? (
                  <button
                    className="profile-problem-row"
                    key={favorite.problem_id}
                    onClick={() => onOpenProblem(favorite.problem!)}
                  >
                    <span className="favorite-icon"><Heart fill="currentColor" /></span>
                    <div>
                      <b lang={favorite.problem.content_language}>
                        <MathContent
                          as="span"
                          lang={favorite.problem.content_language}
                        >
                          {problemText(favorite.problem, "statement")}
                        </MathContent>
                      </b>
                      <small>{favorite.problem.topic} · Saved {date(favorite.saved_at)}</small>
                    </div>
                    <ArrowRight />
                  </button>
                ) : null,
              )}
            </div>
          ) : (
            <div className="record-empty compact">
              <Heart />
              <b>{record.error ? "Favorites unavailable" : "No favorite problems yet"}</b>
              <p>{record.error ? "Lumhat could not load your favorite problems." : "Tap the heart on a problem to keep it here and solve it again later."}</p>
              {!record.error && <button className="primary" onClick={() => go("competitions")}>Browse problems <ArrowRight /></button>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Admin({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [tab, setTab] = useState<"contests" | "problems">("contests");
  const [modal, setModal] = useState(false);
  return (
    <main className="admin-page">
      <aside className="admin-nav">
        <Logo onClick={() => {}} />
        <div>
          <button className="active">
            <LayoutDashboard />
            Overview
          </button>
          <button
            onClick={() => setTab("contests")}
            className={tab === "contests" ? "active" : ""}
          >
            <Trophy />
            Competitions
          </button>
          <button
            onClick={() => setTab("problems")}
            className={tab === "problems" ? "active" : ""}
          >
            <BookOpen />
            Problems
          </button>
          <button>
            <Users />
            Users
          </button>
          <button>
            <BarChart3 />
            Analytics
          </button>
        </div>
        <div>
          <button>
            <Settings />
            Settings
          </button>
          <div className="admin-user">
            <span>NS</span>
            <div>
              <b>Narin Sok</b>
              <small>Administrator</small>
            </div>
          </div>
        </div>
      </aside>
      <section className="admin-content">
        <div className="admin-header">
          <div>
            <span className="kicker">CONTENT MANAGEMENT</span>
            <h1>{t.adminTitle}</h1>
            <p>{t.adminSub}</p>
          </div>
          <button className="primary" onClick={() => setModal(true)}>
            <Plus />
            {tab === "contests" ? t.newContest : t.addProblem}
          </button>
        </div>
        <div className="admin-stats">
          <div>
            <span>
              <Trophy />
            </span>
            <p>Competitions</p>
            <b>14</b>
            <small>12 published</small>
          </div>
          <div>
            <span>
              <BookOpen />
            </span>
            <p>Total problems</p>
            <b>2,295</b>
            <small>+48 this month</small>
          </div>
          <div>
            <span>
              <Users />
            </span>
            <p>Contributors</p>
            <b>27</b>
            <small>6 active today</small>
          </div>
        </div>
        <div className="data-card">
          <div className="data-title">
            <div>
              <h2>
                {tab === "contests"
                  ? "Competitions"
                  : "Recently added problems"}
              </h2>
              <p>
                {tab === "contests"
                  ? "Create, edit, and organize contest collections."
                  : "Review and publish contributor submissions."}
              </p>
            </div>
            <label>
              <Search />
              <input placeholder="Search..." />
            </label>
          </div>
          <table>
            <thead>
              <tr>
                {(tab === "contests"
                  ? ["Competition", "Problems", "Years", "Status", "Updated"]
                  : ["Problem", "Competition", "Topic", "Status", "Contributor"]
                ).map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tab === "contests"
                ? contests
                    .slice(0, 5)
                    .map((c) => [
                      c.name,
                      c.count,
                      c.years,
                      c.id === "apmo" ? "Draft" : "Published",
                      "2 days ago",
                    ])
                : [
                    [
                      "Cyclic quadrilateral proof",
                      "CMO",
                      "Geometry",
                      "Published",
                      "Dara K.",
                    ],
                    [
                      "Integer divisibility",
                      "IMO Shortlist",
                      "Number Theory",
                      "In review",
                      "Sovann P.",
                    ],
                    [
                      "Functional equation P4",
                      "APMO",
                      "Algebra",
                      "Draft",
                      "Maly S.",
                    ],
                    [
                      "Coloring a 9×9 board",
                      "SEAMO",
                      "Combinatorics",
                      "Published",
                      "Admin",
                    ],
                  ]
              ).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      {j === 0 ? (
                        <b>{cell}</b>
                      ) : j === 3 ? (
                        <span
                          className={
                            "status " +
                            String(cell).toLowerCase().replace(" ", "-")
                          }
                        >
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <div className="modal-bg" onMouseDown={() => setModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{tab === "contests" ? t.newContest : t.addProblem}</h2>
                <p>
                  Add the English content first; Khmer can be added before
                  publishing.
                </p>
              </div>
              <button onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <div className="form-grid">
              <label>
                <span>
                  {tab === "contests" ? "Competition name" : "Problem title"}
                </span>
                <input
                  placeholder={
                    tab === "contests"
                      ? "e.g. Cambodian Junior Math Olympiad"
                      : "Internal title for editors"
                  }
                />
              </label>
              <label>
                <span>Short code</span>
                <input placeholder="e.g. CJMO" />
              </label>
              <label className="full">
                <span>Description</span>
                <textarea placeholder="Write a short description..."></textarea>
              </label>
              <label>
                <span>Difficulty</span>
                <select>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select>
                  <option>Draft</option>
                  <option>Published</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="primary" onClick={() => setModal(false)}>
                <Check />
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Auth({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const t = copy[lang];
  const [signupMode, setSignupMode] = useState(false),
    [show, setShow] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (signupMode) {
        const result = await signUp(email, password, name);
        if (result.session) go("dashboard");
        else
          setNotice(
            "Account created. Check your email to confirm your address, then sign in.",
          );
      } else {
        await signIn(email, password);
        go("dashboard");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Logo onClick={() => go("home")} />
        <div>
          <span className="auth-kicker">
            <Sparkles />
            LEARN · THINK · GROW
          </span>
          <h1>
            Every great solver
            <br />
            started with a <em>question.</em>
          </h1>
          <p>
            Build the habits, intuition, and confidence to go further in
            olympiad mathematics.
          </p>
          <div className="quote">
            <span>“</span>
            <p>
              Mathematics is not about numbers, equations, computations, or
              algorithms: it is about understanding.
            </p>
          </div>
        </div>
        <small>© 2026 Lumhat Learning</small>
      </div>
      <div className="auth-form">
        <div className="auth-box">
          <div className="mobile-logo">
            <Logo onClick={() => go("home")} />
          </div>
          <h2>{t.authWelcome}</h2>
          <p>{t.authSub}</p>
          {!isSupabaseConfigured && (
            <div className="auth-alert">
              Database connection is ready for your Supabase project values.
            </div>
          )}
          <div className="auth-tabs">
            <button
              className={!signupMode ? "active" : ""}
              onClick={() => setSignupMode(false)}
            >
              {t.signIn}
            </button>
            <button
              className={signupMode ? "active" : ""}
              onClick={() => setSignupMode(true)}
            >
              {t.signUp}
            </button>
          </div>
          <form onSubmit={submit}>
            {signupMode && (
              <label>
                <span>{t.name}</span>
                <div>
                  <UserRound />
                  <input
                    required
                    autoComplete="name"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              </label>
            )}
            <label>
              <span>{t.email}</span>
              <div>
                <Globe2 />
                <input
                  required
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                />
              </div>
            </label>
            <label>
              <span>{t.password}</span>
              <div>
                <LockKeyhole />
                <input
                  required
                  autoComplete={signupMode ? "new-password" : "current-password"}
                  minLength={signupMode ? 8 : 6}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(!show)}>
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            {!signupMode && (
              <button type="button" className="forgot">
                Forgot password?
              </button>
            )}
            {error && <div className="auth-message error">{error}</div>}
            {notice && <div className="auth-message success">{notice}</div>}
            <button className="primary submit" disabled={loading}>
              {loading ? "Please wait…" : signupMode ? t.signUp : t.signIn}
              <ArrowRight />
            </button>
          </form>
          <div className="secure">
            <ShieldCheck /> Your learning data stays private and secure.
          </div>
        </div>
      </div>
    </main>
  );
}

function Footer({
  lang,
  setLang,
  go,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  go: (p: Page) => void;
}) {
  const t = copy[lang];
  return (
    <footer>
      <div className="footer-main">
        <div>
          <Logo onClick={() => go("home")} />
          <p>{t.footer}</p>
        </div>
        <div>
          <b>{lang === "km" ? "សិក្សា" : "Learn"}</b>
          <button onClick={() => go("competitions")}>{t.navCompetitions}</button>
          <button onClick={() => go("dashboard")}>{lang === "km" ? "វឌ្ឍនភាព" : "Progress"}</button>
        </div>
        <div>
          <b>{lang === "km" ? "សហគមន៍" : "Community"}</b>
          <button>{lang === "km" ? "រួមចំណែក" : "Contribute"}</button>
          <button onClick={() => go("about")}>{t.navAbout}</button>
          <button>{lang === "km" ? "ទំនាក់ទំនង" : "Contact"}</button>
        </div>
        <div>
          <b>{lang === "km" ? "ភាសា" : "Language"}</b>
          <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
          <button className={lang === "km" ? "active" : ""} onClick={() => setLang("km")}>ភាសាខ្មែរ</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{lang === "km" ? "© ២០២៦ Lumhat។ រក្សាសិទ្ធិគ្រប់យ៉ាង។" : "© 2026 Lumhat. All rights reserved."}</span>
        <span>{lang === "km" ? "បង្កើតឡើងសម្រាប់អ្នកសិក្សាគ្រប់ទីកន្លែង 🇰🇭" : "Built for learners everywhere 🇰🇭"}</span>
      </div>
    </footer>
  );
}

export default function App() {
  const initialRoute = useMemo(() => readRoute(), []);
  const [lang, setLang] = useState<Lang>("en"),
    [page, setPage] = useState<Page>(initialRoute.page),
    [user, setUser] = useState<AuthUser | null>(null),
    [role, setRole] = useState<string | null>(null),
    [roleError, setRoleError] = useState(""),
    [selectedCompetition, setSelectedCompetition] =
      useState<CompetitionRecord | null>(initialRoute.competition),
    [selectedCompetitionYear, setSelectedCompetitionYear] = useState<
      number | null
    >(initialRoute.year),
    [selectedCompetitionDay, setSelectedCompetitionDay] = useState<
      number | null
    >(initialRoute.day),
    [selectedProblem, setSelectedProblem] = useState<ProblemRecord | null>(
      null,
    ),
    [routeProblemId, setRouteProblemId] = useState<string | null>(
      initialRoute.problemId,
    ),
    [routeProblemLoading, setRouteProblemLoading] = useState(
      initialRoute.problemId !== null,
    ),
    [routeProblemError, setRouteProblemError] = useState("");
  const roleRequest = useRef(0);

  useEffect(() => {
    const applyRoute = (route: AppRoute) => {
      setPage(route.page);
      setSelectedCompetition(route.competition);
      setSelectedCompetitionYear(route.year);
      setSelectedCompetitionDay(route.day);
      setRouteProblemId(route.problemId);
      setRouteProblemError("");
      if (route.page !== "problem") {
        setSelectedProblem(null);
        setRouteProblemLoading(false);
      } else {
        setSelectedProblem(null);
        setRouteProblemLoading(true);
      }
      window.scrollTo({ top: 0 });
    };
    const onPopState = () => applyRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (
      page !== "competition-detail" ||
      !selectedCompetition ||
      selectedCompetition.id ||
      !supabase
    )
      return;
    let active = true;
    supabase
      .from("competitions")
      .select(
        "id,slug,short_code,name_en,name_km,description_en,description_km,level",
      )
      .ilike("short_code", selectedCompetition.short_code)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setSelectedCompetition(data as CompetitionRecord);
        else setPage("competitions");
      });
    return () => {
      active = false;
    };
  }, [page, selectedCompetition]);

  useEffect(() => {
    if (!routeProblemId) return;
    if (!supabase) {
      setRouteProblemLoading(false);
      setRouteProblemError("This problem could not be loaded.");
      return;
    }
    let active = true;
    setRouteProblemLoading(true);
    setRouteProblemError("");
    supabase
      .from("problems")
      .select("*")
      .eq("id", routeProblemId)
      .eq("status", "published")
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        setRouteProblemLoading(false);
        if (error || !data) {
          setRouteProblemError("This problem does not exist or is not published.");
          return;
        }
        const problem = normalizeProblem(data);
        setSelectedProblem(problem);
        const { data: databaseCompetition } = problem.competition_id
          ? await supabase!
              .from("competitions")
              .select(
                "id,slug,short_code,name_en,name_km,description_en,description_km,level",
              )
              .eq("id", problem.competition_id)
              .maybeSingle()
          : { data: null };
        if (!active) return;
        const competition = (databaseCompetition as CompetitionRecord | null) ?? PORTALS.find((portal) =>
          problem.tags.includes(portal.short_code),
        );
        if (competition) setSelectedCompetition(competition);
      });
    return () => {
      active = false;
    };
  }, [routeProblemId]);

  useEffect(() => {
    const titles: Record<Page, string> = {
      home: "Lumhat — Math Olympiad Practice",
      about: "About us — Lumhat",
      competitions: "Competitions — Lumhat",
      "competition-detail": selectedCompetition
        ? `${selectedCompetition.short_code} — Lumhat`
        : "Competitions — Lumhat",
      problem: "Problem — Lumhat",
      dashboard: "My Profile — Lumhat",
      contribute: "Contribute — Lumhat",
      auth: "Log in — Lumhat",
    };
    document.title = titles[page];
  }, [page, selectedCompetition, selectedProblem]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const applyUser = (next: AuthUser | null) => {
      if (!active) return;
      const request = ++roleRequest.current;
      setUser(next);
      setRoleError("");
      if (!next) {
        setRole(null);
        return;
      }
      setRole(null);
      // Let the auth callback finish before starting another Supabase request.
      window.setTimeout(async () => {
        const { data, error } = await supabase!
          .from("profiles")
          .select("role")
          .eq("id", next.id)
          .maybeSingle();
        if (!active || request !== roleRequest.current) return;
        if (error || !data) {
          setRoleError(error?.message || "Your account profile is missing.");
          setRole("student");
          return;
        }
        setRole(data.role);
      }, 0);
    };
    supabase.auth.getUser().then(({ data, error }) => {
      if (error && active) setRoleError(error.message);
      applyUser(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      applyUser(session?.user ?? null),
    );
    return () => {
      active = false;
      roleRequest.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  const go = (p: Page) => {
    let path: string;
    if (p === "competition-detail" && selectedCompetition)
      path = competitionPath(
        selectedCompetition,
        selectedCompetitionYear,
        selectedCompetitionDay,
      );
    else if (p === "problem" && selectedProblem)
      path = `/problems/${encodeURIComponent(selectedProblem.id)}`;
    else if (p === "competition-detail" || p === "problem")
      path = "/competitions";
    else path = pagePaths[p];
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setRole(null);
    go("home");
  };
  const openCompetition = (competition: CompetitionRecord) => {
      setSelectedCompetition(competition);
      setSelectedCompetitionYear(null);
      setSelectedCompetitionDay(null);
      setSelectedProblem(null);
      setRouteProblemId(null);
      setRouteProblemLoading(false);
      setRouteProblemError("");
      window.history.pushState({}, "", competitionPath(competition));
      setPage("competition-detail");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    openProblem = (problem: ProblemRecord) => {
      setSelectedProblem(normalizeProblem(problem));
      setRouteProblemId(null);
      setRouteProblemLoading(false);
      setRouteProblemError("");
      window.history.pushState(
        {},
        "",
        `/problems/${encodeURIComponent(problem.id)}`,
      );
      setPage("problem");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  const changeCompetitionYear = (year: number | null) => {
    setSelectedCompetitionYear(year);
    setSelectedCompetitionDay(null);
    if (selectedCompetition)
      window.history.replaceState(
        {},
        "",
        competitionPath(selectedCompetition, year),
      );
  };
  const changeCompetitionDay = (day: number | null) => {
    setSelectedCompetitionDay(day);
    if (selectedCompetition)
      window.history.replaceState(
        {},
        "",
        competitionPath(
          selectedCompetition,
          selectedCompetitionYear,
          day,
        ),
      );
  };
  const standalone = page === "auth" || page === "contribute";
  return (
    <div className={lang === "km" ? "khmer" : ""} lang={lang}>
      {!standalone && (
        <Header
          lang={lang}
          setLang={setLang}
          page={page}
          go={go}
          user={user}
          role={role ?? "student"}
          onSignOut={handleSignOut}
        />
      )}{" "}
      {page === "home" && <Home lang={lang} go={go} />}{" "}
      {page === "about" && <About lang={lang} go={go} />}{" "}
      {page === "competitions" && (
        <CompetitionLibrary
          lang={lang}
          onOpen={openCompetition}
          adminId={role === "admin" ? user?.id : undefined}
        />
      )}{" "}
      {page === "competition-detail" &&
        (selectedCompetition ? (
          <CompetitionProblems
            lang={lang}
            competition={selectedCompetition}
            initialYear={selectedCompetitionYear}
            onYearChange={changeCompetitionYear}
            initialDay={selectedCompetitionDay}
            onDayChange={changeCompetitionDay}
            onBack={() => go("competitions")}
            onPractice={openProblem}
          />
        ) : (
          <CompetitionLibrary
            lang={lang}
            onOpen={openCompetition}
            adminId={role === "admin" ? user?.id : undefined}
          />
        ))}{" "}
      {page === "problem" &&
        (selectedProblem ? (
          <DatabasePractice
            lang={lang}
            user={user}
            problem={selectedProblem}
            onBack={() => go("competition-detail")}
            onLogin={() => go("auth")}
          />
        ) : routeProblemLoading ? (
          <main className="bank-page portal-page">
            <section className="bank-heading">
              <span className="kicker">{lang === "km" ? "កំពុងផ្ទុក" : "LOADING"}</span>
              <h1>{lang === "km" ? "កំពុងបើកលំហាត់…" : "Opening problem…"}</h1>
            </section>
          </main>
        ) : routeProblemError ? (
          <main className="bank-page portal-page">
            <section className="bank-heading">
              <span className="kicker">{lang === "km" ? "រកមិនឃើញលំហាត់" : "PROBLEM NOT FOUND"}</span>
              <h1>
                {lang === "km"
                  ? "លំហាត់នេះមិនមាន ឬមិនទាន់បានផ្សព្វផ្សាយទេ។"
                  : routeProblemError}
              </h1>
              <button className="primary" onClick={() => go("competitions")}>
                {lang === "km" ? "មើលការប្រកួត" : "Browse competitions"}
              </button>
            </section>
          </main>
        ) : (
          <CompetitionLibrary
            lang={lang}
            onOpen={openCompetition}
            adminId={role === "admin" ? user?.id : undefined}
          />
        ))}{" "}
      {page === "dashboard" &&
        (user ? (
          <TruthfulDashboard
            lang={lang}
            go={go}
            user={user}
            onOpenProblem={openProblem}
          />
        ) : (
          <ProfileGate go={go} />
        ))}{" "}
      {page === "contribute" &&
        (user && (role === "admin" || role === "contributor") ? (
          <AdminContribute user={user} role={role} onExit={() => go("home")} />
        ) : (
          <AdminAccessGate
            loggedIn={Boolean(user)}
            checking={Boolean(user) && role === null}
            error={roleError}
            go={go}
          />
        ))}{" "}
      {page === "auth" && <Auth lang={lang} go={go} />}{" "}
      {!standalone && <Footer lang={lang} setLang={setLang} go={go} />}
    </div>
  );
}

function AdminAccessGate({
  loggedIn,
  checking,
  error,
  go,
}: {
  loggedIn: boolean;
  checking: boolean;
  error: string;
  go: (p: Page) => void;
}) {
  return (
    <main className="admin-access-gate">
      <LockKeyhole />
      <h1>
        {checking ? "Checking contribution access…" : "Contributor access only"}
      </h1>
      <p>
        {checking
          ? "Lumhat is reading the role assigned to your account."
          : error
            ? "Your role could not be verified. Please refresh and try again."
            : loggedIn
              ? "Ask an administrator to make this account a contributor."
              : "Sign in with a contributor or administrator account."}
      </p>
      {!checking && (
        <button
          className="primary"
          onClick={() => go(loggedIn ? "home" : "auth")}
        >
          {loggedIn ? "Return home" : "Sign in"}
          <ArrowRight />
        </button>
      )}
    </main>
  );
}
