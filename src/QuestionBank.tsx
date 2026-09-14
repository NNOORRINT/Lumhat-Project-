import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Eye,
  FileDown,
  FilePlus2,
  Filter,
  FolderCog,
  GripVertical,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Medal,
  Pencil,
  Pin,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Tags,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { supabase, type AuthUser } from "./lib/supabase";
import {
  LatexPreview,
  MathContent,
  normalizeMathText,
  validateLatex,
} from "./MathContent";

export type Language = "en" | "km";
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
  correct_index: number;
  solution_image_url?: string;
  solution_image_alt?: string;
};
type OpenAnswer = {
  type: "open_ended";
  language?: ProblemLanguage;
  accepted_answers: string[];
  accepted_answers_km?: string[];
  display_answer: string;
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

type DatabaseError = {
  code?: string;
  message: string;
};

const problemWriteErrorMessage = (error: DatabaseError) => {
  const isDuplicate =
    error.code === "23505" ||
    error.message.includes(
      "problems_competition_id_year_contest_day_problem_number_key",
    ) ||
    error.message.includes(
      "problems_competition_category_year_day_number_key",
    );

  return isDuplicate
    ? "That category already has a problem with this contest year, day, and problem number. Edit the existing problem or choose a different number."
    : error.message;
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
  const primaryTextContainsKhmer = /[\u1780-\u17ff]/.test(
    row.statement_en ?? "",
  );
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
    difficulty_scale: Number(
      row.difficulty_scale ?? row.answer?.difficulty_scale ?? 3,
    ),
    time_limit_seconds: Number(
      row.time_limit_seconds ?? row.answer?.time_limit_seconds ?? 600,
    ),
    problem_type: (row.answer?.type === "study"
      ? "study"
      : (row.problem_type ??
        (row.answer?.type === "open_ended" ? "open_ended" : "qcm"))) as
      | "qcm"
      | "open_ended"
      | "study",
  };
};

const safeContributorName = (creator?: { display_name: string } | null) => {
  const name = creator?.display_name?.trim();
  return name && !name.includes("@") ? name : "Contributor";
};

type ProblemTextField = "statement" | "solution" | "hint";
export const problemText = (
  problem: ProblemRecord,
  field: ProblemTextField,
) => {
  // Problem content follows the language chosen by its author. It deliberately
  // does not accept the interface language, so the EN/KM site switch cannot
  // translate or replace statements, hints, or solutions.
  const en = problem[`${field}_en` as keyof ProblemRecord] as string | null;
  const km = problem[`${field}_km` as keyof ProblemRecord] as string | null;
  return problem.content_language === "km" ? (km || en || "") : (en || km || "");
};

const problemChoices = (problem: ProblemRecord) => {
  const answer =
    problem.answer?.type === "qcm" ||
    problem.answer?.type === "multiple_choice"
      ? problem.answer
      : null;
  if (!answer) return [];
  return problem.content_language === "km" && answer.choices_km?.length
    ? answer.choices_km
    : answer.choices_en;
};

const TOPICS = [
  ["Number Theory", "N"],
  ["Geometry", "G"],
  ["Combinatorics", "C"],
  ["Algebra", "A"],
] as const;
export const PORTALS: CompetitionRecord[] = [
  {
    id: "NMO9",
    display_order: 0,
    is_pinned: false,
    short_code: "NMO9",
    name_en: "National Olympiad (KHM–9)",
    name_km: "អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ទី៩",
    description_en:
      "Problems selected for Cambodia’s Grade 9 National Mathematical Olympiad.",
    description_km:
      "វិញ្ញាសាសម្រាប់អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ជាតិថ្នាក់ទី៩ នៃប្រទេសកម្ពុជា។",
  },
  {
    id: "NMO12",
    display_order: 1,
    is_pinned: false,
    short_code: "NMO12",
    name_en: "National Olympiad (KHM–12)",
    name_km: "អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ទី១២",
    description_en:
      "Problems selected for Cambodia’s Grade 12 National Mathematical Olympiad.",
    description_km:
      "វិញ្ញាសាសម្រាប់អូឡាំព្យាដគណិតវិទ្យាថ្នាក់ជាតិថ្នាក់ទី១២ នៃប្រទេសកម្ពុជា។",
  },
  {
    id: "MO",
    display_order: 2,
    is_pinned: false,
    short_code: "MO",
    name_en: "Math Olympiad",
    name_km: "អូឡាំព្យាដគណិតវិទ្យា",
    description_en:
      "International competition practice from Kangaroo, AMC, and similar olympiads.",
    description_km:
      "លំហាត់អនុវត្តពីការប្រកួតអន្តរជាតិ ដូចជា Kangaroo, AMC និងអូឡាំព្យាដផ្សេងៗ។",
  },
];

const isDatabaseCategory = (category: CompetitionRecord) =>
  /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(category.id);

const categorySlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const TIMES = [300, 600, 900, 1800, 3600, 5400];
const timeLabel = (s: number) =>
  s < 3600 ? `${s / 60} min` : s === 3600 ? "1 hour" : "1 h 30 min";
const ui = (lang: Language, en: string, km: string) =>
  lang === "km" ? km : en;
const localizedTimeLabel = (s: number, lang: Language) =>
  lang === "km"
    ? s < 3600
      ? `${s / 60} នាទី`
      : s === 3600
        ? "១ ម៉ោង"
        : "១ ម៉ោង ៣០ នាទី"
    : timeLabel(s);
const topicLabel = (topic: string, lang: Language) => {
  if (lang === "en") return topic;
  return (
    {
      "Number Theory": "ទ្រឹស្តីចំនួន",
      Geometry: "ធរណីមាត្រ",
      Combinatorics: "បន្សំ",
      Algebra: "ពិជគណិត",
    }[topic] ?? topic
  );
};
const localText = (
  lang: Language,
  en: string | null,
  km: string | null | undefined,
) => (lang === "km" && km ? km : (en ?? ""));
const clock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Bulbs({
  value = 1,
  lang = "en",
  interactive = false,
  onChange,
}: {
  value?: number;
  lang?: Language;
  interactive?: boolean;
  onChange?: (n: number) => void;
}) {
  return (
    <div className={`bulb-scale ${interactive ? "interactive" : ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          disabled={!interactive}
          className={n <= value ? "on" : ""}
          onClick={() => onChange?.(n)}
          key={n}
          aria-label={`${n} lightbulbs`}
        >
          <Lightbulb />
        </button>
      ))}
      <small>
        {value === 1
          ? ui(lang, "Easy", "ងាយ")
          : value === 5
            ? ui(lang, "Hard", "ពិបាក")
            : `${value}/5`}
      </small>
    </div>
  );
}
function BankState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bank-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function CompetitionLibrary({
  lang,
  onOpen,
  adminId,
}: {
  lang: Language;
  onOpen: (c: CompetitionRecord) => void;
  adminId?: string;
}) {
  const [items, setItems] = useState<CompetitionRecord[]>(PORTALS),
    [query, setQuery] = useState(""),
    [scope, setScope] = useState<"all" | "national" | "international">("all"),
    [managerOpen, setManagerOpen] = useState(false),
    [editingCategory, setEditingCategory] =
      useState<CompetitionRecord | null>(null),
    [categoryName, setCategoryName] = useState(""),
    [categoryNameKm, setCategoryNameKm] = useState(""),
    [categoryCode, setCategoryCode] = useState(""),
    [categoryDescription, setCategoryDescription] = useState(""),
    [categoryNotice, setCategoryNotice] = useState(""),
    [categorySaving, setCategorySaving] = useState(false),
    [categoryOrderSaving, setCategoryOrderSaving] = useState(false),
    [bannerOrderingAvailable, setBannerOrderingAvailable] = useState(true),
    [managerNotice, setManagerNotice] = useState(""),
    [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);

  const categoryScope = (category: CompetitionRecord) =>
    /national|cambodia|khm|nmo/i.test(
      `${category.short_code} ${category.name_en} ${category.description_en}`,
    )
      ? "national"
      : "international";

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesScope = scope === "all" || categoryScope(item) === scope;
      const matchesQuery =
        !term ||
        [
          item.short_code,
          item.name_en,
          item.name_km,
          item.description_en,
          item.description_km,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      return matchesScope && matchesQuery;
    });
  }, [items, query, scope]);

  const loadCategories = async () => {
    if (!supabase) return;
    const [categoryResult, problemResult] = await Promise.all([
      supabase
        .from("competitions")
        .select(
          "id,slug,short_code,name_en,name_km,description_en,description_km,level,display_order,is_pinned",
        )
        .eq("status", "published")
        .neq("short_code", "BANK")
        .order("is_pinned", { ascending: false })
        .order("display_order")
        .order("created_at"),
      supabase
        .from("problems")
        .select("competition_id,tags")
        .eq("status", "published"),
    ]);
    let categoryRows = categoryResult.data;
    if (categoryResult.error) {
      const legacyResult = await supabase
        .from("competitions")
        .select(
          "id,slug,short_code,name_en,name_km,description_en,description_km,level",
        )
        .eq("status", "published")
        .neq("short_code", "BANK")
        .order("created_at");
      categoryRows = legacyResult.data as typeof categoryRows;
      setBannerOrderingAvailable(false);
    } else {
      setBannerOrderingAvailable(true);
    }
    const problemRows = problemResult.data;
    const databaseCategories = (categoryRows ?? []) as CompetitionRecord[];
    const categories = [
      ...databaseCategories,
      ...PORTALS.filter(
        (fallback) =>
          !databaseCategories.some(
            (category) =>
              category.short_code === fallback.short_code ||
              category.slug === `${categorySlug(fallback.short_code)}-category`,
          ),
      ),
    ].sort(
      (a, b) =>
        Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
        (a.display_order ?? Number.MAX_SAFE_INTEGER) -
          (b.display_order ?? Number.MAX_SAFE_INTEGER),
    );
    setItems(
      categories.map((category) => ({
        ...category,
        count: (problemRows ?? []).filter(
          (problem) =>
            problem.competition_id === category.id ||
            (!isDatabaseCategory(category) &&
              (problem.tags ?? []).includes(category.short_code)),
        ).length,
      })),
    );
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const beginCategory = (category?: CompetitionRecord) => {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name_en ?? "");
    setCategoryNameKm(category?.name_km ?? "");
    setCategoryCode(category?.short_code ?? "");
    setCategoryDescription(category?.description_en ?? "");
    setCategoryNotice("");
  };

  const persistCategoryOrder = async (nextItems: CompetitionRecord[]) => {
    if (
      !supabase ||
      !adminId ||
      categoryOrderSaving ||
      !bannerOrderingAvailable
    )
      return;
    const database = supabase;
    const ordered = nextItems.map((item, index) => ({
      ...item,
      display_order: index,
    }));
    const previous = items;
    setItems(ordered);
    setCategoryOrderSaving(true);
    setManagerNotice("");
    const results = await Promise.all(
      ordered
        .filter(isDatabaseCategory)
        .map((item) =>
          database
            .from("competitions")
            .update({
              display_order: item.display_order,
              is_pinned: Boolean(item.is_pinned),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id),
        ),
    );
    const failed = results.find((result) => result.error)?.error;
    setCategoryOrderSaving(false);
    if (failed) {
      setItems(previous);
      setManagerNotice(`Could not update banner order: ${failed.message}`);
      return;
    }
    setManagerNotice("Banner order saved.");
  };

  const moveCategory = (categoryId: string, direction: -1 | 1) => {
    const currentIndex = items.findIndex((item) => item.id === categoryId);
    if (currentIndex < 0) return;
    const pinned = Boolean(items[currentIndex].is_pinned);
    const groupIndexes = items.flatMap((item, index) =>
      Boolean(item.is_pinned) === pinned ? [index] : [],
    );
    const position = groupIndexes.indexOf(currentIndex);
    const targetIndex = groupIndexes[position + direction];
    if (targetIndex === undefined) return;
    const nextItems = [...items];
    [nextItems[currentIndex], nextItems[targetIndex]] = [
      nextItems[targetIndex],
      nextItems[currentIndex],
    ];
    void persistCategoryOrder(nextItems);
  };

  const toggleCategoryPin = (categoryId: string) => {
    const changed = items.map((item) =>
      item.id === categoryId ? { ...item, is_pinned: !item.is_pinned } : item,
    );
    const nextItems = [
      ...changed.filter((item) => item.is_pinned),
      ...changed.filter((item) => !item.is_pinned),
    ];
    void persistCategoryOrder(nextItems);
  };

  const dropCategory = (targetId: string) => {
    if (!draggedCategoryId || draggedCategoryId === targetId) return;
    const fromIndex = items.findIndex((item) => item.id === draggedCategoryId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (
      fromIndex < 0 ||
      targetIndex < 0 ||
      Boolean(items[fromIndex].is_pinned) !== Boolean(items[targetIndex].is_pinned)
    ) {
      setManagerNotice("Pin or unpin a banner before moving it between sections.");
      setDraggedCategoryId(null);
      return;
    }
    const nextItems = [...items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    setDraggedCategoryId(null);
    void persistCategoryOrder(nextItems);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !adminId) return;
    const name = categoryName.trim();
    const code = categoryCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!name || !code) {
      setCategoryNotice("Add a category name and a short code.");
      return;
    }
    setCategorySaving(true);
    setCategoryNotice("");
    const values = {
      short_code: code,
      name_en: name,
      name_km: categoryNameKm.trim() || null,
      description_en: categoryDescription.trim(),
      description_km: editingCategory?.description_km ?? null,
      level: editingCategory?.level ?? ("intermediate" as const),
      status: "published" as const,
    };
    let error: { message: string } | null = null;
    if (editingCategory && isDatabaseCategory(editingCategory)) {
      const result = await supabase
        .from("competitions")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", editingCategory.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("competitions")
        .insert({
          ...values,
          slug: editingCategory
            ? `${categorySlug(editingCategory.short_code)}-category`
            : `${categorySlug(code || name)}-${crypto.randomUUID().slice(0, 8)}`,
          created_by: adminId,
          ...(bannerOrderingAvailable
            ? {
                display_order:
                  Math.max(
                    -1,
                    ...items.map((item) => item.display_order ?? -1),
                  ) + 1,
                is_pinned: false,
              }
            : {}),
        })
        .select("id")
        .single();
      error = result.error;
      if (!error && editingCategory && result.data) {
        const reassignment = await supabase
          .from("problems")
          .update({ competition_id: result.data.id })
          .contains("tags", [editingCategory.short_code]);
        error = reassignment.error;
      }
    }
    setCategorySaving(false);
    if (error) {
      setCategoryNotice(`Could not save the category: ${error.message}`);
      return;
    }
    await loadCategories();
    beginCategory();
    setCategoryNotice(
      editingCategory
        ? "Category renamed. Its problems stayed attached."
        : "Category added.",
    );
  };
  return (
    <main className="bank-page portal-page">
      <section className="category-heading">
        <div className="category-heading-copy">
          <span className="kicker">
            {ui(lang, "COMPETITION LIBRARY", "បណ្ណាល័យការប្រកួត")}
          </span>
          <h1>{ui(lang, "Find your next challenge", "ស្វែងរកបញ្ហាប្រឈមបន្ទាប់")}</h1>
          <p>
            {ui(
              lang,
              "Search by competition or browse a collection. Each library keeps your practice focused.",
              "ស្វែងរកតាមការប្រកួត ឬជ្រើសរើសបណ្ណាល័យដែលសមស្របសម្រាប់អ្នក។",
            )}
          </p>
        </div>
        {adminId && (
          <button
            className="manage-categories-button"
            onClick={() => {
              beginCategory();
              setManagerOpen(true);
            }}
          >
            <FolderCog /> Manage categories
          </button>
        )}
      </section>

      <section
        className="category-browser"
        aria-label={ui(lang, "Find a competition", "ស្វែងរកការប្រកួត")}
      >
        <label className="category-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ui(lang, "Search by name or code…", "ស្វែងរកតាមឈ្មោះ ឬលេខកូដ…")}
            aria-label={ui(lang, "Search competitions", "ស្វែងរកការប្រកួត")}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={ui(lang, "Clear search", "លុបការស្វែងរក")}
            >
              <X />
            </button>
          )}
        </label>
        <div
          className="category-filter"
          aria-label={ui(lang, "Filter competitions", "ចម្រាញ់ការប្រកួត")}
        >
          {([
            ["all", ui(lang, "All", "ទាំងអស់")],
            ["national", ui(lang, "Cambodia", "កម្ពុជា")],
            ["international", ui(lang, "International", "អន្តរជាតិ")],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={scope === value ? "active" : ""}
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="category-results-heading" aria-live="polite">
        <strong>
          {visibleItems.length}{" "}
          {ui(
            lang,
            visibleItems.length === 1 ? "collection" : "collections",
            "បណ្ណាល័យ",
          )}
        </strong>
        <span>
          {ui(
            lang,
            "Choose one to see its years and problems",
            "ជ្រើសរើសមួយដើម្បីមើលឆ្នាំ និងលំហាត់",
          )}
        </span>
      </div>

      {visibleItems.length > 0 ? (
        <div className="portal-grid">
        {visibleItems.map((item) => {
          const originalIndex = items.findIndex((candidate) => candidate.id === item.id);
          const itemScope = categoryScope(item);
          return (
          <button
            className={`category-portal portal-${(originalIndex % 4) + 1} ${item.is_pinned ? "pinned" : ""}`}
            key={item.id}
            onClick={() => onOpen(item)}
          >
            {item.is_pinned && (
              <span className="portal-pinned-badge">
                <Pin /> {ui(lang, "Pinned", "បានខ្ទាស់")}
              </span>
            )}
            <div className="portal-card-top">
              <span className="portal-code">
                <img
                  src={item.short_code === "MO" ? "/mologo.png" : "/moeyslogo.png"}
                  className={item.short_code === "MO" ? "" : "national-logo"}
                  alt=""
                />
              </span>
              <span className="portal-short-code">{item.short_code}</span>
            </div>
            <div className="portal-card-copy">
              <small>
                {itemScope === "national"
                  ? ui(lang, "CAMBODIA", "កម្ពុជា")
                  : ui(lang, "INTERNATIONAL", "អន្តរជាតិ")}
              </small>
              <h2>{localText(lang, item.name_en, item.name_km)}</h2>
              <p>{localText(lang, item.description_en, item.description_km)}</p>
            </div>
            <footer>
              <span>
                <BookOpen />
                {item.count ?? 0} {ui(lang, "problems", "លំហាត់")}
              </span>
              <span className="portal-open-label">
                {ui(lang, "Open", "បើក")} <ArrowRight />
              </span>
            </footer>
          </button>
          );
        })}
        </div>
      ) : (
        <div className="category-empty">
          <Search />
          <h2>{ui(lang, "No collections found", "រកមិនឃើញបណ្ណាល័យ")}</h2>
          <p>
            {ui(
              lang,
              "Try a different name or show all competitions.",
              "សាកល្បងឈ្មោះផ្សេង ឬបង្ហាញការប្រកួតទាំងអស់។",
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setScope("all");
            }}
          >
            {ui(lang, "View all collections", "មើលបណ្ណាល័យទាំងអស់")}
          </button>
        </div>
      )}
      {managerOpen && adminId && (
        <div className="category-manager-backdrop" role="presentation">
          <section
            className="category-manager"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-manager-title"
          >
            <header>
              <div>
                <span className="kicker">ADMIN PORTAL</span>
                <h2 id="category-manager-title">Manage categories</h2>
                <p>Pin priority banners and drag or use the arrows to arrange them.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close category manager"
                onClick={() => setManagerOpen(false)}
              >
                <X />
              </button>
            </header>
            <div className="category-manager-body">
              <div className="category-manager-list">
                <b>Current categories</b>
                {!bannerOrderingAvailable && (
                  <p className="manager-notice warning">
                    Database setup needed: run
                    20260912000000_add_competition_banner_order.sql in Supabase SQL
                    Editor, then refresh this page.
                  </p>
                )}
                {managerNotice && <p className="manager-notice">{managerNotice}</p>}
                {items.map((category) => {
                  const sameGroup = items.filter(
                    (item) => Boolean(item.is_pinned) === Boolean(category.is_pinned),
                  );
                  const groupIndex = sameGroup.findIndex(
                    (item) => item.id === category.id,
                  );
                  return (
                    <div
                      key={category.id}
                      className={`category-manager-item ${editingCategory?.id === category.id ? "active" : ""} ${category.is_pinned ? "pinned" : ""} ${draggedCategoryId === category.id ? "dragging" : ""}`}
                      draggable={
                        bannerOrderingAvailable &&
                        !categoryOrderSaving &&
                        isDatabaseCategory(category)
                      }
                      onDragStart={() => setDraggedCategoryId(category.id)}
                      onDragEnd={() => setDraggedCategoryId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropCategory(category.id)}
                    >
                      <button
                        type="button"
                        className="category-manager-select"
                        onClick={() => beginCategory(category)}
                      >
                        <span>{category.short_code}</span>
                        <div>
                          <strong>{category.name_en}</strong>
                          <small>
                            {category.is_pinned && <em>Pinned · </em>}
                            {category.count ?? 0} published problems
                          </small>
                        </div>
                        <Pencil />
                      </button>
                      <div className="category-order-controls">
                        <button
                          type="button"
                          className={category.is_pinned ? "active" : ""}
                          disabled={
                            !bannerOrderingAvailable ||
                            categoryOrderSaving ||
                            !isDatabaseCategory(category)
                          }
                          aria-label={`${category.is_pinned ? "Unpin" : "Pin"} ${category.name_en}`}
                          aria-pressed={Boolean(category.is_pinned)}
                          title={
                            category.is_pinned
                              ? "Unpin banner"
                              : "Pin banner to the top"
                          }
                          onClick={() => toggleCategoryPin(category.id)}
                        >
                          <Pin
                            fill={category.is_pinned ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          type="button"
                          disabled={
                            !bannerOrderingAvailable ||
                            categoryOrderSaving ||
                            !isDatabaseCategory(category) ||
                            groupIndex === 0
                          }
                          aria-label={`Move ${category.name_en} up`}
                          title="Move banner up"
                          onClick={() => moveCategory(category.id, -1)}
                        >
                          <ArrowUp />
                        </button>
                        <button
                          type="button"
                          disabled={
                            !bannerOrderingAvailable ||
                            categoryOrderSaving ||
                            !isDatabaseCategory(category) ||
                            groupIndex === sameGroup.length - 1
                          }
                          aria-label={`Move ${category.name_en} down`}
                          title="Move banner down"
                          onClick={() => moveCategory(category.id, 1)}
                        >
                          <ArrowDown />
                        </button>
                        <GripVertical aria-hidden="true" />
                      </div>
                    </div>
                  );
                })}
                <button className="new-category-button" onClick={() => beginCategory()}>
                  <FilePlus2 /> Add a new category
                </button>
              </div>
              <form className="category-manager-form" onSubmit={saveCategory}>
                <h3>{editingCategory ? "Rename category" : "New category"}</h3>
                <label>
                  <span>Category name</span>
                  <input
                    required
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="e.g. Regional Mathematics Olympiad"
                  />
                </label>
                <label>
                  <span>Short code</span>
                  <input
                    required
                    value={categoryCode}
                    onChange={(event) => setCategoryCode(event.target.value)}
                    placeholder="e.g. RMO"
                  />
                </label>
                <label>
                  <span>Khmer name (optional)</span>
                  <input
                    value={categoryNameKm}
                    onChange={(event) => setCategoryNameKm(event.target.value)}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={categoryDescription}
                    onChange={(event) => setCategoryDescription(event.target.value)}
                    placeholder="What learners will find in this category"
                  />
                </label>
                {categoryNotice && (
                  <p className="category-notice">{categoryNotice}</p>
                )}
                <button className="primary" disabled={categorySaving}>
                  <Check />
                  {categorySaving
                    ? "Saving..."
                    : editingCategory
                      ? "Save new name"
                      : "Add category"}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function CompetitionProblems({
  lang,
  competition,
  onBack,
  onPractice,
  initialYear = null,
  onYearChange,
  initialDay = null,
  onDayChange,
}: {
  lang: Language;
  competition: CompetitionRecord;
  onBack: () => void;
  onPractice: (p: ProblemRecord) => void;
  initialYear?: number | null;
  onYearChange?: (year: number | null) => void;
  initialDay?: number | null;
  onDayChange?: (day: number | null) => void;
}) {
  const [problems, setProblems] = useState<ProblemRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selectedYear, setSelectedYear] = useState<number | null>(initialYear),
    [selectedDay, setSelectedDay] = useState<number | null>(initialDay),
    [topic, setTopic] = useState("All"),
    [generated, setGenerated] = useState<ProblemRecord[] | null>(null),
    [lastType, setLastType] = useState<"open_ended" | "qcm">("open_ended"),
    [message, setMessage] = useState(""),
    [preparingPdf, setPreparingPdf] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let request = supabase
      .from("problems")
      .select(
        "id,competition_id,title_en,title_km,statement_en,statement_km,solution_en,solution_km,hint_en,hint_km,topic,tags,difficulty,year,problem_number,points,answer",
      )
      .eq("status", "published");
    request = isDatabaseCategory(competition)
      ? request.eq("competition_id", competition.id)
      : request.contains("tags", [competition.short_code]);
    request.then(({ data, error }) => {
        setLoading(false);
        if (error)
          setError(
            ui(lang, "Problems could not be loaded.", "មិនអាចផ្ទុកលំហាត់បានទេ។"),
          );
        else
          setProblems(
            (data ?? [])
              .map(normalizeProblem)
              .sort(
                (a, b) =>
                  (b.year ?? 0) - (a.year ?? 0) ||
                  (a.contest_day ?? Number.MAX_SAFE_INTEGER) -
                    (b.contest_day ?? Number.MAX_SAFE_INTEGER) ||
                  (a.problem_number ?? Number.MAX_SAFE_INTEGER) -
                    (b.problem_number ?? Number.MAX_SAFE_INTEGER) ||
                  problemText(a, "statement").localeCompare(
                    problemText(b, "statement"),
                  ),
              ),
          );
      });
  }, [competition.id, competition.short_code, lang]);
  const randomize = <T,>(items: T[]) =>
    [...items].sort(() => Math.random() - 0.5);
  const take = (source: ProblemRecord[], count: number, used: Set<string>) => {
    const picked = randomize(source.filter((p) => !used.has(p.id))).slice(
      0,
      count,
    );
    picked.forEach((p) => used.add(p.id));
    return picked;
  };
  const isMathOlympiad = competition.short_code === "MO";
  const isNationalOlympiad = !isMathOlympiad;
  const chooseYear = (year: number | null) => {
    setSelectedYear(year);
    setSelectedDay(null);
    onYearChange?.(year);
  };
  const chooseDay = (day: number | null) => {
    setSelectedDay(day);
    onDayChange?.(day);
  };
  const years = useMemo(
    () =>
      [...new Set(problems.flatMap((problem) => problem.year ?? []))].sort(
        (a, b) => b - a,
      ),
    [problems],
  );
  const generate = () => {
    setTopic("All");
    if (!isMathOlympiad) {
      const eligible = problems.filter((problem) => problem.year != null);
      const missingTopics = TOPICS.map((item) => item[0]).filter(
        (requiredTopic) =>
          !eligible.some((problem) => problem.topic === requiredTopic),
      );
      const availableYears = [
        ...new Set(eligible.map((problem) => problem.year as number)),
      ];
      if (missingTopics.length || availableYears.length < 6) {
        setGenerated(null);
        setMessage(
          missingTopics.length
            ? ui(
                lang,
                `Cannot build a balanced set yet. Add a published ${missingTopics.join(", ")} problem with a contest year.`,
                "មិនទាន់អាចបង្កើតសំណុំមានតុល្យភាពបានទេ។ សូមបន្ថែមលំហាត់ដែលបានផ្សព្វផ្សាយឱ្យគ្រប់ប្រធានបទ និងឆ្នាំប្រកួត។",
              )
            : ui(
                lang,
                `The set builder needs problems from at least 6 different years. It currently has ${availableYears.length}.`,
                `ត្រូវការលំហាត់ពីយ៉ាងតិច ៦ ឆ្នាំផ្សេងគ្នា។ បច្ចុប្បន្នមាន ${availableYears.length} ឆ្នាំ។`,
              ),
        );
        return;
      }

      const requiredTopics = [...TOPICS]
        .map(([requiredTopic]) => ({
          topic: requiredTopic,
          candidates: randomize(
            eligible.filter((problem) => problem.topic === requiredTopic),
          ),
        }))
        .sort(
          (a, b) =>
            new Set(a.candidates.map((problem) => problem.year)).size -
            new Set(b.candidates.map((problem) => problem.year)).size,
        );
      const chooseRequired = (
        index: number,
        picked: ProblemRecord[],
        usedYears: Set<number>,
      ): ProblemRecord[] | null => {
        if (index === requiredTopics.length) return picked;
        for (const candidate of requiredTopics[index].candidates) {
          const year = candidate.year as number;
          if (usedYears.has(year)) continue;
          const result = chooseRequired(
            index + 1,
            [...picked, candidate],
            new Set([...usedYears, year]),
          );
          if (result) return result;
        }
        return null;
      };
      const required = chooseRequired(0, [], new Set());
      if (!required) {
        setGenerated(null);
        setMessage(
          ui(
            lang,
            "The current problems cannot cover all four topics using different years. Add more year and topic combinations.",
            "លំហាត់បច្ចុប្បន្នមិនអាចគ្របដណ្តប់ប្រធានបទទាំងបួនដោយប្រើឆ្នាំផ្សេងគ្នាបានទេ។",
          ),
        );
        return;
      }
      const usedYears = new Set(required.map((problem) => problem.year));
      const extraYears = randomize(
        availableYears.filter((year) => !usedYears.has(year)),
      ).slice(0, 2);
      const extras = extraYears.map(
        (year) =>
          randomize(eligible.filter((problem) => problem.year === year))[0],
      );
      const mixedSet = [...required, ...extras].sort(
        (a, b) =>
          a.difficulty_scale - b.difficulty_scale ||
          (b.year ?? 0) - (a.year ?? 0),
      );
      setGenerated(mixedSet);
      setMessage(
        ui(
          lang,
          `6 ${competition.short_code} problems selected from 6 different years. All four topics are covered and the set runs from easiest to hardest.`,
          `បានជ្រើសរើសលំហាត់ ${competition.short_code} ចំនួន ៦ ពី ៦ ឆ្នាំផ្សេងគ្នា និងរៀបពីងាយទៅពិបាក។`,
        ),
      );
      return;
    }
    const used = new Set<string>(),
      byEase = [...problems].sort(
        (a, b) => a.difficulty_scale - b.difficulty_scale,
      ),
      easy: ProblemRecord[] = [];
    for (const level of [1, 2, 3, 4, 5]) {
      easy.push(
        ...take(
          byEase.filter((p) => p.difficulty_scale === level),
          5 - easy.length,
          used,
        ),
      );
      if (easy.length === 5) break;
    }
    const middle = take(
        problems.filter(
          (p) => p.difficulty_scale >= 2 && p.difficulty_scale <= 4,
        ),
        5,
        used,
      ),
      last = take(
        problems.filter((p) => p.problem_type === lastType),
        5,
        used,
      ),
      set = [...easy, ...middle, ...last];
    setGenerated(set);
    setMessage(
      set.length < 15
        ? ui(
            lang,
            `This category currently has only ${set.length} unique problems matching the recipe. No problem was repeated.`,
            `ប្រភេទនេះមានតែលំហាត់មិនស្ទួន ${set.length} ដែលត្រូវនឹងលក្ខខណ្ឌ។`,
          )
        : ui(
            lang,
            `15 unique questions selected: 5 easiest, 5 medium, and 5 ${lastType === "open_ended" ? "open-ended" : "QCM"}.`,
            "បានជ្រើសរើសលំហាត់មិនស្ទួន ១៥៖ ងាយ ៥ មធ្យម ៥ និងតាមទម្រង់ដែលបានជ្រើស ៥។",
          ),
    );
  };
  const yearProblems = selectedYear
    ? problems.filter((problem) => problem.year === selectedYear)
    : problems;
  const dayProblems =
    selectedDay === null
      ? yearProblems
      : selectedDay === 0
        ? yearProblems.filter((problem) => problem.contest_day == null)
        : yearProblems.filter((problem) => problem.contest_day === selectedDay);
  const base = generated ?? dayProblems;
  const visible =
    topic === "All" ? base : base.filter((p) => p.topic === topic);
  const canExportExam =
    isNationalOlympiad &&
    selectedYear !== null &&
    (selectedDay === 1 || selectedDay === 2) &&
    dayProblems.length > 0;
  const downloadExamPdf = async () => {
    if (!canExportExam || preparingPdf) return;
    setPreparingPdf(true);

    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".exam-print-sheet img"),
    );
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );
    await document.fonts?.ready;

    const filename = `${competition.short_code}_${selectedYear}_Day_${selectedDay}_Exam.pdf`;
    const sheet = document.querySelector<HTMLElement>(".exam-print-sheet");
    if (!sheet) {
      setPreparingPdf(false);
      return;
    }

    document.body.classList.add("printing-exam");
    sheet.classList.add("exam-print-sheet--exporting");
    const finish = () => {
      sheet.classList.remove("exam-print-sheet--exporting");
      document.body.classList.remove("printing-exam");
      setPreparingPdf(false);
    };

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .set({
          margin: [14, 14, 18, 14],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          enableLinks: false,
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(sheet)
        .save(filename);
      finish();
    } catch {
      const originalTitle = document.title;
      document.title = filename.replace(/\.pdf$/, "");
      const finishPrint = () => {
        document.title = originalTitle;
        finish();
      };
      window.addEventListener("afterprint", finishPrint, { once: true });
      try {
        window.print();
      } catch {
        window.removeEventListener("afterprint", finishPrint);
        finishPrint();
      }
    }
  };
  return (
    <main className="bank-page">
      {canExportExam && (
        <ExamPrintSheet
          competition={competition}
          year={selectedYear}
          day={selectedDay}
          problems={dayProblems}
          lang={lang}
        />
      )}
      <button className="bank-back" onClick={onBack}>
        <ArrowLeft />
        {ui(lang, "All categories", "ប្រភេទទាំងអស់")}
      </button>
      <section className="competition-title">
        <span>{competition.short_code}</span>
        <div>
          <div className="bank-level">
            {competition.short_code === "MO"
              ? ui(lang, "PRACTICE LIBRARY", "បណ្ណាល័យអនុវត្ត")
              : ui(lang, "YEARLY CONTEST ARCHIVE", "បណ្ណសារប្រកួតតាមឆ្នាំ")}
          </div>
          <h1>{localText(lang, competition.name_en, competition.name_km)}</h1>
          <p>
            {localText(
              lang,
              competition.description_en,
              competition.description_km,
            )}
          </p>
        </div>
      </section>
      {isNationalOlympiad && selectedYear === null && generated === null ? (
        loading ? (
          <BankState
            icon={<Clock3 />}
            title={ui(lang, "Loading contest years", "កំពុងផ្ទុកឆ្នាំប្រកួត")}
            text={ui(lang, "Building the year archive from published problems.", "កំពុងរៀបចំបណ្ណសារឆ្នាំពីលំហាត់ដែលបានផ្សព្វផ្សាយ។")}
          />
        ) : error ? (
          <BankState
            icon={<CircleHelp />}
            title={ui(lang, "Contest years unavailable", "មិនអាចផ្ទុកឆ្នាំប្រកួតបាន")}
            text={error}
          />
        ) : years.length === 0 ? (
          <BankState
            icon={<CalendarDays />}
            title={ui(lang, "No contest years yet", "មិនទាន់មានឆ្នាំប្រកួត")}
            text={ui(lang, `A year portal will appear automatically when a published ${competition.short_code} problem has a contest year.`, "ឆ្នាំប្រកួតនឹងបង្ហាញនៅទីនេះ នៅពេលមានលំហាត់ដែលបានផ្សព្វផ្សាយ។")}
          />
        ) : (
          <>
          <section className="practice-generator national-generator">
            <div>
              <Shuffle />
              <div>
                <h2>{ui(lang, "Build a 6-question mixed-year set", "បង្កើតសំណុំលំហាត់ ៦ ពីឆ្នាំចម្រុះ")}</h2>
                <p>
                  {ui(lang, "Six different contest years, all four topics, ordered from easiest to hardest.", "៦ ឆ្នាំប្រកួតផ្សេងគ្នា គ្រប់ប្រធានបទទាំងបួន និងរៀបពីងាយទៅពិបាក។")}
                </p>
              </div>
            </div>
            <div className="generator-actions">
              <button className="primary" onClick={generate}>
                <RefreshCw /> {ui(lang, "Build set", "បង្កើតសំណុំ")}
              </button>
            </div>
            {message && <p className="generator-message">{message}</p>}
          </section>
          <section className="year-archive">
            <div className="year-archive-heading">
              <div>
                <span className="kicker">{ui(lang, "OFFICIAL CONTEST ARCHIVE", "បណ្ណសារប្រកួតផ្លូវការ")}</span>
                <h2>{ui(lang, "Select a contest year", "ជ្រើសរើសឆ្នាំប្រកួត")}</h2>
                <p>{ui(lang, "Each portal contains the published problems from that year’s exam.", "ឆ្នាំនីមួយៗមានលំហាត់ដែលបានផ្សព្វផ្សាយពីការប្រឡងឆ្នាំនោះ។")}</p>
              </div>
              <CalendarDays />
            </div>
            <div className="year-grid">
              {years.map((year) => {
                const count = problems.filter(
                  (problem) => problem.year === year,
                ).length;
                return (
                  <button key={year} onClick={() => chooseYear(year)}>
                    <span>{competition.short_code}</span>
                    <strong>{year}</strong>
                    <small>
                      {count} {ui(lang, count === 1 ? "problem" : "problems", "លំហាត់")}
                    </small>
                    <i>
                      {ui(lang, "Open contest", "បើកការប្រកួត")} <ArrowRight />
                    </i>
                  </button>
                );
              })}
            </div>
          </section>
          </>
        )
      ) : isNationalOlympiad &&
        selectedYear !== null &&
        selectedDay === null &&
        generated === null ? (
        <section className="year-archive day-archive">
          <button
            className="day-archive-back"
            onClick={() => chooseYear(null)}
          >
            <ArrowLeft /> {ui(lang, "All years", "ឆ្នាំទាំងអស់")}
          </button>
          <div className="year-archive-heading">
            <div>
              <span className="kicker">{competition.short_code} {selectedYear}</span>
              <h2>{ui(lang, "Select an exam day", "ជ្រើសរើសថ្ងៃប្រឡង")}</h2>
              <p>{ui(lang, "Day 1 and Day 2 problems stay in their official contest order.", "លំហាត់ថ្ងៃទី១ និងថ្ងៃទី២ ត្រូវបានរៀបតាមលំដាប់ផ្លូវការ។")}</p>
            </div>
            <CalendarDays />
          </div>
          <div className="day-grid">
            {[1, 2].map((day) => {
              const count = yearProblems.filter(
                (problem) => problem.contest_day === day,
              ).length;
              return (
                <button
                  key={day}
                  disabled={count === 0}
                  onClick={() => chooseDay(day)}
                >
                  <span>{ui(lang, "OFFICIAL EXAM", "ការប្រឡងផ្លូវការ")}</span>
                  <strong>{ui(lang, `Day ${day}`, `ថ្ងៃទី ${day}`)}</strong>
                  <small>{count} {ui(lang, count === 1 ? "problem" : "problems", "លំហាត់")}</small>
                  <i>{count ? ui(lang, "Open day", "បើកថ្ងៃប្រឡង") : ui(lang, "No problems yet", "មិនទាន់មានលំហាត់")} <ArrowRight /></i>
                </button>
              );
            })}
            {yearProblems.some((problem) => problem.contest_day == null) && (
              <button className="unassigned-day" onClick={() => chooseDay(0)}>
                <span>{ui(lang, "NEEDS ORGANIZATION", "ត្រូវការរៀបចំ")}</span>
                <strong>{ui(lang, "Day unassigned", "មិនទាន់កំណត់ថ្ងៃ")}</strong>
                <small>
                  {yearProblems.filter((problem) => problem.contest_day == null).length} {ui(lang, "problems", "លំហាត់")}
                </small>
                <i>{ui(lang, "View problems", "មើលលំហាត់")} <ArrowRight /></i>
              </button>
            )}
          </div>
        </section>
      ) : (
      <>
      {isNationalOlympiad && selectedYear !== null && selectedDay !== null && (
        <div className="year-contest-bar">
          <button
            onClick={() => {
              chooseDay(null);
              setTopic("All");
            }}
          >
            <ArrowLeft /> {selectedYear} {ui(lang, "exam days", "ថ្ងៃប្រឡង")}
          </button>
          <div>
            <span>{ui(lang, "OFFICIAL YEARLY EXAM", "ការប្រឡងប្រចាំឆ្នាំផ្លូវការ")}</span>
            <b>
              {competition.short_code} {selectedYear} ·{" "}
              {selectedDay === 0
                ? ui(lang, "Day unassigned", "មិនទាន់កំណត់ថ្ងៃ")
                : ui(lang, `Day ${selectedDay}`, `ថ្ងៃទី ${selectedDay}`)}
            </b>
          </div>
          <small>{dayProblems.length} {ui(lang, "problems", "លំហាត់")}</small>
        </div>
      )}
      {isNationalOlympiad && selectedYear === null && generated && (
        <div className="year-contest-bar mixed-year-bar">
          <button
            onClick={() => {
              setGenerated(null);
              setMessage("");
              setTopic("All");
            }}
          >
            <ArrowLeft /> {ui(lang, "Year archive", "បណ្ណសារឆ្នាំ")}
          </button>
          <div>
            <span>{ui(lang, "MIXED-YEAR PRACTICE", "ការអនុវត្តឆ្នាំចម្រុះ")}</span>
            <b>{competition.short_code} · {ui(lang, "6-problem set", "សំណុំ ៦ លំហាត់")}</b>
          </div>
          <small>{ui(lang, "Easy to hard", "ពីងាយទៅពិបាក")}</small>
        </div>
      )}
      {isMathOlympiad && <section className="practice-generator">
        <div>
          <Shuffle />
          <div>
            <h2>
              {ui(lang, `Build a ${isMathOlympiad ? "15" : "6"}-question practice set`, `បង្កើតសំណុំអនុវត្ត ${isMathOlympiad ? "១៥" : "៦"} លំហាត់`)}
            </h2>
            <p>
              {ui(lang, "5 easiest + 5 difficulty 2–4 + 5 questions in your chosen format. Questions never repeat.", "លំហាត់ងាយបំផុត ៥ + កម្រិត ២–៤ ចំនួន ៥ + ទម្រង់ដែលអ្នកជ្រើស ៥។ លំហាត់មិនស្ទួនទេ។")}
            </p>
          </div>
        </div>
        <div className="generator-actions">
          {isMathOlympiad && (
            <label>
              {ui(lang, "Final 5", "៥ ចុងក្រោយ")}
              <select
                value={lastType}
                onChange={(e) =>
                  setLastType(e.target.value as "open_ended" | "qcm")
                }
              >
                <option value="open_ended">{ui(lang, "Open-ended", "ចម្លើយបើក")}</option>
                <option value="qcm">QCM</option>
              </select>
            </label>
          )}
          <button className="primary" onClick={generate}>
            <RefreshCw />
            {ui(lang, "Build set", "បង្កើតសំណុំ")}
          </button>
        </div>
        {message && <p className="generator-message">{message}</p>}
      </section>}
      <div className="library-tools">
        <div className="tag-filter">
          <Filter />
          {["All", ...TOPICS.map((x) => x[0])].map((x) => (
            <button
              className={topic === x ? "active" : ""}
              onClick={() => setTopic(x)}
              key={x}
            >
              {x === "All" ? ui(lang, "All", "ទាំងអស់") : topicLabel(x, lang)}
            </button>
          ))}
        </div>
        <div className="library-actions">
          {canExportExam && (
            <button
              className="exam-export-button"
              disabled={preparingPdf}
              onClick={() => void downloadExamPdf()}
            >
              <FileDown />
              {preparingPdf
                ? ui(lang, "Preparing PDF…", "កំពុងរៀបចំ PDF…")
                : ui(lang, "Download exam PDF", "ទាញយក PDF ប្រឡង")}
            </button>
          )}
          {isMathOlympiad && (
            <>
              <button onClick={() => setGenerated(randomize(base))}>
                <Shuffle />
                {ui(lang, "Shuffle", "ច្របល់")}
              </button>
              {generated && (
                <button
                  onClick={() => {
                    setGenerated(null);
                    setMessage("");
                  }}
                >
                  {ui(lang, "Show all, easy to hard", "បង្ហាញទាំងអស់ពីងាយទៅពិបាក")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {loading ? (
        <BankState
          icon={<Clock3 />}
          title={ui(lang, "Loading problems", "កំពុងផ្ទុកលំហាត់")}
          text={ui(lang, "Reading this category.", "កំពុងអានប្រភេទនេះ។")}
        />
      ) : error ? (
        <BankState
          icon={<CircleHelp />}
          title={ui(lang, "Problems unavailable", "មិនអាចផ្ទុកលំហាត់បាន")}
          text={error}
        />
      ) : !visible.length ? (
        <BankState
          icon={<FilePlus2 />}
          title={ui(lang, "No published problems", "មិនទាន់មានលំហាត់ដែលបានផ្សព្វផ្សាយ")}
          text={ui(lang, "No problems match this selection yet.", "មិនទាន់មានលំហាត់ត្រូវនឹងការជ្រើសរើសនេះទេ។")}
        />
      ) : (
        <>
          <div className="set-summary">
            <b>
              {generated
                ? ui(lang, "Custom practice set", "សំណុំអនុវត្តផ្ទាល់ខ្លួន")
                : isNationalOlympiad
                  ? `${competition.short_code} ${selectedYear} · ${
                      selectedDay === 0
                        ? ui(lang, "Day unassigned", "មិនទាន់កំណត់ថ្ងៃ")
                        : ui(
                            lang,
                            `Day ${selectedDay}`,
                            `ថ្ងៃទី ${selectedDay}`,
                          )
                    }`
                  : ui(lang, "All problems", "លំហាត់ទាំងអស់")}
            </b>
            <span>
              {visible.length} {ui(lang, "questions", "លំហាត់")} ·{" "}
              {generated
                ? ui(lang, "Unique randomized selection", "ការជ្រើសរើសចៃដន្យមិនស្ទួន")
                : isNationalOlympiad
                  ? ui(lang, "Official contest order", "លំដាប់ប្រកួតផ្លូវការ")
                  : ui(lang, "Sorted easiest to hardest", "រៀបពីងាយទៅពិបាក")}
            </span>
          </div>
          <div className="problem-list">
            {visible.map((p, index) => (
              <button key={p.id} onClick={() => onPractice(p)}>
                <span className="problem-index">
                  {isNationalOlympiad && generated
                    ? index + 1
                    : (p.problem_number ?? index + 1)}
                </span>
                <div>
                  <div className="problem-list-meta">
                    <span>{p.content_language === "km" ? "ខ្មែរ" : "EN"}</span>
                    <span>
                      {TOPICS.find((x) => x[0] === p.topic)?.[1] ?? p.topic}
                    </span>
                    <span>
                      {p.problem_type === "study"
                        ? ui(lang, "Solution study", "សិក្សាដំណោះស្រាយ")
                        : p.problem_type === "open_ended"
                          ? ui(lang, "Open answer", "ចម្លើយបើក")
                          : "QCM"}
                    </span>
                    <span>
                      {p.problem_type === "study"
                        ? ui(lang, "Official problem", "លំហាត់ផ្លូវការ")
                        : localizedTimeLabel(p.time_limit_seconds, lang)}
                    </span>
                    {isNationalOlympiad && generated && p.year && (
                      <span>{p.year}</span>
                    )}
                  </div>
                  <MathContent
                    as="div"
                    className={`problem-list-statement ${p.content_language === "km" ? "problem-text-khmer" : ""}`}
                    lang={p.content_language}
                  >
                    {problemText(p, "statement")}
                  </MathContent>
                  {p.diagram_url && (
                    <figure className="problem-list-diagram">
                      <img
                        src={p.diagram_url}
                        alt={
                          p.diagram_alt ??
                          ui(
                            lang,
                            "Diagram for this problem",
                            "ដ្យាក្រាមសម្រាប់លំហាត់នេះ",
                          )
                        }
                        loading="lazy"
                      />
                    </figure>
                  )}
                  <Bulbs value={p.difficulty_scale} lang={lang} />
                </div>
                <ArrowRight />
              </button>
            ))}
          </div>
        </>
      )}
      </>
      )}
    </main>
  );
}

function ExamPrintSheet({
  competition,
  year,
  day,
  problems,
  lang,
}: {
  competition: CompetitionRecord;
  year: number;
  day: 1 | 2;
  problems: ProblemRecord[];
  lang: Language;
}) {
  const totalPoints = problems.reduce((sum, problem) => sum + problem.points, 0);
  return createPortal(
    <article className="exam-print-sheet" lang={lang} aria-hidden="true">
      <header className="exam-print-header">
        <div className="exam-print-brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>lumhat</strong>
            <span>{ui(lang, "MATHEMATICS OLYMPIAD", "អូឡាំព្យាដគណិតវិទ្យា")}</span>
          </div>
        </div>
        <div className="exam-print-code">
          <span>{competition.short_code}</span>
          <strong>{year}</strong>
        </div>
      </header>

      <section className="exam-print-title">
        <span>{ui(lang, "OFFICIAL PRACTICE EXAM", "វិញ្ញាសាអនុវត្តផ្លូវការ")}</span>
        <h1>{localText(lang, competition.name_en, competition.name_km)}</h1>
        <p>
          {ui(lang, `Contest year ${year} · Day ${day}`, `ឆ្នាំប្រកួត ${year} · ថ្ងៃទី ${day}`)}
        </p>
      </section>

      <section className="exam-print-student">
        <label>{ui(lang, "Student name", "ឈ្មោះសិស្ស")}<i /></label>
        <label>{ui(lang, "Date", "កាលបរិច្ឆេទ")}<i /></label>
        <label>{ui(lang, "Score", "ពិន្ទុ")}<i /><b>/ {totalPoints}</b></label>
      </section>

      <section className="exam-print-instructions">
        <strong>{ui(lang, "Instructions", "សេចក្តីណែនាំ")}</strong>
        <p>
          {ui(
            lang,
            `Answer all ${problems.length} problems. Show your reasoning clearly. Diagrams are not necessarily drawn to scale.`,
            `ឆ្លើយលំហាត់ទាំង ${problems.length}។ បង្ហាញវិធីដោះស្រាយឱ្យបានច្បាស់។ ដ្យាក្រាមអាចមិនត្រូវបានគូរតាមមាត្រដ្ឋាន។`,
          )}
        </p>
      </section>

      <div className="exam-print-problems">
        {problems.map((problem, index) => {
          const choices = problemChoices(problem);
          return (
            <section className="exam-print-problem" key={problem.id}>
              <div className="exam-print-number">
                <strong>{problem.problem_number ?? index + 1}</strong>
                <span>
                  {problem.points} {ui(lang, problem.points === 1 ? "point" : "points", "ពិន្ទុ")}
                </span>
              </div>
              <div className="exam-print-question">
                <MathContent lang={problem.content_language}>
                  {problemText(problem, "statement")}
                </MathContent>
                {problem.diagram_url && (
                  <figure>
                    <img
                      src={problem.diagram_url}
                      alt={problem.diagram_alt ?? ""}
                    />
                  </figure>
                )}
                {choices.length > 0 && (
                  <ol className="exam-print-choices">
                    {choices.map((choice, choiceIndex) => (
                      <li key={`${problem.id}-${choiceIndex}`}>
                        <b>{String.fromCharCode(65 + choiceIndex)}</b>
                        <MathContent as="span" lang={problem.content_language}>
                          {choice}
                        </MathContent>
                      </li>
                    ))}
                  </ol>
                )}
                {choices.length === 0 && <div className="exam-print-answer-space" />}
              </div>
            </section>
          );
        })}
      </div>

      <footer>
        <span>{competition.short_code} {year} · {ui(lang, `Day ${day}`, `ថ្ងៃទី ${day}`)}</span>
        <span>lumhat · lumhat.org</span>
      </footer>
    </article>,
    document.body,
  );
}

type Leader = { rank: number; display_name: string; elapsed_seconds: number };
export function DatabasePractice({
  lang,
  user,
  problem,
  onBack,
  onLogin,
}: {
  lang: Language;
  user: AuthUser | null;
  problem: ProblemRecord;
  onBack: () => void;
  onLogin: () => void;
}) {
  const isStudy =
      problem.tags?.includes("NMO9") || problem.tags?.includes("NMO12"),
    isMathOlympiad = problem.tags?.includes("MO") ?? false,
    isOpen = problem.problem_type === "open_ended",
    qcm =
      problem.answer?.type === "qcm" ||
      problem.answer?.type === "multiple_choice"
        ? problem.answer
        : null;
  const choices = problemChoices(problem);
  const [started, rawSetStarted] = useState(false),
    [startedAt, setStartedAt] = useState(0),
    [seconds, setSeconds] = useState(0),
    [choice, setChoice] = useState<number | null>(null),
    [response, setResponse] = useState(""),
    [tries, setTries] = useState(0),
    [result, setResult] = useState<"correct" | "incorrect" | "">(""),
    [solution, setSolution] = useState(false),
    [hint, setHint] = useState(false),
    [save, setSave] = useState(""),
    [favorite, setFavorite] = useState(false),
    [favoriteBusy, setFavoriteBusy] = useState(false),
    [leaders, setLeaders] = useState<Leader[]>([]);
  const expired = started && seconds >= problem.time_limit_seconds,
    locked = isOpen && (tries >= 3 || expired),
    hasSolution = Boolean(
      problemText(problem, "solution") || problem.solution_image_url,
    );
  const timerKey = `lumhat-problem-start:${user?.id ?? "guest"}:${problem.id}`;
  const setStarted = (value: boolean) => {
    if (value && !startedAt) {
      const stored = Number(localStorage.getItem(timerKey)),
        start = stored || Date.now();
      localStorage.setItem(timerKey, String(start));
      setStartedAt(start);
    }
    rawSetStarted(value);
  };
  useEffect(() => {
    if (!started || !startedAt || result === "correct" || locked) return;
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [started, startedAt, result, locked]);
  useEffect(() => {
    if (!isOpen || !user || !supabase) return;
    supabase
      .from("attempts")
      .select("is_correct")
      .eq("user_id", user.id)
      .eq("problem_id", problem.id)
      .then(({ data }) =>
        setTries(Math.min(3, (data ?? []).filter((x) => !x.is_correct).length)),
      );
  }, [isOpen, user, problem.id]);
  useEffect(() => {
    if (isOpen && supabase)
      supabase
        .rpc("get_problem_leaderboard", { target_problem: problem.id })
        .then(({ data }) => setLeaders((data ?? []) as Leader[]));
  }, [isOpen, problem.id, result]);
  useEffect(() => {
    setFavorite(false);
    if (!user || !supabase) return;
    let active = true;
    supabase
      .from("saved_problems")
      .select("problem_id")
      .eq("user_id", user.id)
      .eq("problem_id", problem.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setFavorite(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [user, problem.id]);
  const toggleFavorite = async () => {
    if (!user || !supabase) {
      onLogin();
      return;
    }
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const { error } = favorite
      ? await supabase
          .from("saved_problems")
          .delete()
          .eq("user_id", user.id)
          .eq("problem_id", problem.id)
      : await supabase.from("saved_problems").upsert({
          user_id: user.id,
          problem_id: problem.id,
        });
    if (!error) setFavorite((current) => !current);
    setFavoriteBusy(false);
  };
  const favoriteButton = (
    <button
      className={`favorite-problem ${favorite ? "active" : ""}`}
      onClick={toggleFavorite}
      disabled={favoriteBusy}
      aria-pressed={favorite}
      title={favorite ? ui(lang, "Remove from favorites", "ដកចេញពីចំណូលចិត្ត") : ui(lang, "Save to favorites", "រក្សាទុកជាចំណូលចិត្ត")}
    >
      <Heart fill={favorite ? "currentColor" : "none"} />
      {favorite ? ui(lang, "Favorited", "បានចូលចិត្ត") : ui(lang, "Favorite", "ចំណូលចិត្ត")}
    </button>
  );
  if (isStudy)
    return (
      <main className={`db-practice study-practice ${problem.content_language === "km" ? "problem-content-khmer" : ""}`}>
        <div className="db-practice-top">
          <button onClick={onBack}>
            <ArrowLeft />
            {ui(lang, "Category", "ប្រភេទ")}
          </button>
          <div className="db-practice-tools">
            {favoriteButton}
            <div>
              <span>{ui(lang, "National Olympiad study problem", "លំហាត់សិក្សាអូឡាំព្យាដថ្នាក់ជាតិ")}</span>
              <b>{ui(lang, "No submission required", "មិនត្រូវការដាក់ចម្លើយ")}</b>
            </div>
          </div>
        </div>
        <article>
          <div className="db-problem-meta">
            <span>{problem.tags?.[0]}</span>
            <span>{topicLabel(problem.topic, lang)}</span>
            <span>{problem.content_language === "km" ? "ខ្មែរ" : "EN"}</span>
            <span>{ui(lang, "Study with solution", "សិក្សាជាមួយដំណោះស្រាយ")}</span>
            <Bulbs value={problem.difficulty_scale} lang={lang} />
          </div>
          <MathContent className="db-statement" lang={problem.content_language}>
            {problemText(problem, "statement")}
          </MathContent>
          {problem.diagram_url && (
            <ProblemDiagram problem={problem} lang={lang} />
          )}
          <div className="db-actions study-actions">
            <button onClick={() => setHint(!hint)}>
              <Lightbulb />
              {hint ? ui(lang, "Hide hint", "លាក់គន្លឹះ") : ui(lang, "Show hint", "បង្ហាញគន្លឹះ")}
            </button>
            <button
              className="primary"
              disabled={!hasSolution}
              onClick={() => setSolution(!solution)}
            >
              <Eye />
              {solution ? ui(lang, "Hide solution", "លាក់ដំណោះស្រាយ") : ui(lang, "Reveal solution", "បង្ហាញដំណោះស្រាយ")}
            </button>
          </div>
          {hint && (
            <div className="db-explanation">
              <b>{ui(lang, "Hint", "គន្លឹះ")}</b>
              <MathContent
                className="explanation-copy"
                lang={problem.content_language}
              >
                {problemText(problem, "hint") || ui(lang, "No hint was provided.", "មិនមានគន្លឹះទេ។")}
              </MathContent>
            </div>
          )}
          {solution && (
            <div className="db-explanation solution">
              <b>{ui(lang, "Solution", "ដំណោះស្រាយ")}</b>
              {problemText(problem, "solution") && (
                <MathContent
                  className="explanation-copy"
                  lang={problem.content_language}
                >
                  {problemText(problem, "solution")}
                </MathContent>
              )}
              {problem.solution_image_url && (
                <SolutionImage problem={problem} lang={lang} />
              )}
            </div>
          )}
        </article>
      </main>
    );
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const begin = () => {
    const stored = Number(localStorage.getItem(timerKey)),
      start = stored || Date.now();
    localStorage.setItem(timerKey, String(start));
    setStartedAt(start);
    setStarted(true);
  };
  const submit = async () => {
    if (locked || result === "correct") return;
    const attempt = tries + 1,
      accepted =
        problem.answer?.type === "open_ended"
          ? [
              ...problem.answer.accepted_answers,
              ...(problem.answer.accepted_answers_km ?? []),
            ]
          : [];
    const correct = isOpen
      ? accepted.some((x) => normalize(x) === normalize(response))
      : choice === qcm?.correct_index;
    if (isOpen) setTries(attempt);
    setResult(correct ? "correct" : "incorrect");
    if (correct) localStorage.removeItem(timerKey);
    if (!user || !supabase) {
      setSave(ui(lang, "Sign in to save attempts and join the leaderboard.", "ចូលគណនីដើម្បីរក្សាទុកការឆ្លើយ និងចូលតារាងពិន្ទុ។"));
      return;
    }
    const { error } = await supabase.from("attempts").insert({
      user_id: user.id,
      problem_id: problem.id,
      response: isOpen
        ? {
            answer: response,
            attempt_number: attempt,
            statement: problemText(problem, "statement"),
            topic: problem.topic,
          }
        : {
            choice,
            statement: problemText(problem, "statement"),
            topic: problem.topic,
          },
      is_correct: correct,
      elapsed_seconds: isOpen && correct ? seconds : null,
    });
    setSave(
      error
        ? ui(lang, "This attempt could not be saved.", "មិនអាចរក្សាទុកការឆ្លើយនេះបានទេ។")
        : correct && isOpen
          ? ui(lang, "Your time is on the leaderboard.", "ពេលវេលារបស់អ្នកបានចូលក្នុងតារាងពិន្ទុ។")
          : ui(lang, "Attempt saved.", "បានរក្សាទុកការឆ្លើយ។"),
    );
  };
  return (
    <main className={`db-practice ${problem.content_language === "km" ? "problem-content-khmer" : ""}`}>
      <div className="db-practice-top">
        <button onClick={onBack}>
          <ArrowLeft />
          {ui(lang, "Competition", "ការប្រកួត")}
        </button>
        <div className="db-practice-tools">
          {favoriteButton}
          <div>
            <span>
              {started
                ? expired
                  ? ui(lang, "Time limit reached", "ដល់ពេលកំណត់")
                  : ui(lang, `${timeLabel(problem.time_limit_seconds)} limit`, `កំណត់ ${localizedTimeLabel(problem.time_limit_seconds, lang)}`)
                : ui(lang, "Timer starts with the problem", "ម៉ោងចាប់ផ្តើមជាមួយលំហាត់")}
            </span>
            <b>{clock(Math.min(seconds, problem.time_limit_seconds))}</b>
          </div>
        </div>
      </div>
      <article
        className={!started ? `prestart${isMathOlympiad ? " problem-visible" : ""}` : ""}
      >
        <div className="db-problem-meta">
          <span>{topicLabel(problem.topic, lang)}</span>
          <span>{problem.content_language === "km" ? "ខ្មែរ" : "EN"}</span>
          <span>
            {isOpen ? ui(lang, "Open answer · 3 tries", "ចម្លើយបើក · ៣ ដង") : ui(lang, "QCM · unranked time", "QCM · មិនចាត់ចំណាត់ថ្នាក់ពេលវេលា")}
          </span>
          <Bulbs value={problem.difficulty_scale} lang={lang} />
        </div>
        {!started ? (
          <>
            {isMathOlympiad ? (
              <>
                <MathContent
                  className="db-statement"
                  lang={problem.content_language}
                >
                  {problemText(problem, "statement")}
                </MathContent>
                {problem.diagram_url && (
                  <ProblemDiagram problem={problem} lang={lang} />
                )}
              </>
            ) : (
              <div className="blurred-problem" aria-hidden="true">
                <div />
                <div />
                <div />
                <div />
              </div>
            )}
            <div className="start-panel">
              <Timer />
              <h2>{ui(lang, "Ready to solve?", "ត្រៀមដោះស្រាយហើយឬនៅ?")}</h2>
              <p>
                {isMathOlympiad
                  ? ui(
                      lang,
                      `Read the problem, then start the ${timeLabel(problem.time_limit_seconds)} timer when you are ready.`,
                      `អានលំហាត់ រួចចាប់ផ្តើមម៉ោង ${localizedTimeLabel(problem.time_limit_seconds, lang)} នៅពេលអ្នករួចរាល់។`,
                    )
                  : ui(lang, `You will have ${timeLabel(problem.time_limit_seconds)}. The question and timer begin together.`, `អ្នកមានពេល ${localizedTimeLabel(problem.time_limit_seconds, lang)}។ លំហាត់ និងម៉ោងចាប់ផ្តើមជាមួយគ្នា។`)}
              </p>
              {!user && isOpen && (
                <p className="login-note">
                  {ui(lang, "Sign in first to record a leaderboard time.", "ចូលគណនីជាមុន ដើម្បីកត់ត្រាពេលវេលាក្នុងតារាងពិន្ទុ។")}
                </p>
              )}
              <button className="primary" onClick={() => setStarted(true)}>
                {ui(lang, "Start problem", "ចាប់ផ្តើមលំហាត់")}
                <ArrowRight />
              </button>
            </div>
          </>
        ) : (
          <>
            <MathContent
              className="db-statement"
              lang={problem.content_language}
            >
              {problemText(problem, "statement")}
            </MathContent>
            {problem.diagram_url && (
              <ProblemDiagram problem={problem} lang={lang} />
            )}
            <div className="db-tags">
              {problem.tags
                ?.filter((x) => ["MO", "NMO9", "NMO12"].includes(x))
                .map((x) => (
                <span key={x}>
                  <Tags />
                  {x}
                </span>
                ))}
            </div>
            {isOpen ? (
              <div className="open-response">
                <label>
                  <span>{ui(lang, "Your answer", "ចម្លើយរបស់អ្នក")}</span>
                  <input
                    disabled={locked || result === "correct"}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder={ui(lang, "Enter the final answer", "បញ្ចូលចម្លើយចុងក្រោយ")}
                  />
                </label>
                <div className="try-dots">
                  <span>{Math.max(0, 3 - tries)} {ui(lang, "attempts remaining", "ដងនៅសល់")}</span>
                  {[1, 2, 3].map((n) => (
                    <i className={n <= tries ? "used" : ""} key={n} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="db-choices">
                {choices.map((x, i) => (
                  <button
                    disabled={Boolean(result)}
                    className={`${choice === i ? "selected" : ""} ${result && i === qcm?.correct_index ? "correct" : ""} ${result === "incorrect" && choice === i ? "incorrect" : ""}`}
                    onClick={() => setChoice(i)}
                    key={i}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    <MathContent as="span" lang={problem.content_language}>
                      {x}
                    </MathContent>
                    {result && i === qcm?.correct_index && <CheckCircle2 />}
                  </button>
                ))}
              </div>
            )}
            {result && (
              <div
                className={
                  result === "correct"
                    ? "answer-result good"
                    : "answer-result bad"
                }
              >
                {result === "correct" ? <CheckCircle2 /> : <CircleHelp />}
                <div>
                  <b>{result === "correct" ? ui(lang, "Correct", "ត្រឹមត្រូវ") : ui(lang, "Not quite", "មិនទាន់ត្រឹមត្រូវ")}</b>
                  <span>{save || ui(lang, "Checking your record…", "កំពុងពិនិត្យកំណត់ត្រា…")}</span>
                </div>
              </div>
            )}
            {locked && result !== "correct" && (
              <div className="attempts-over">
                <Clock3 />
                <div>
                  <b>{expired ? ui(lang, "Time is up", "អស់ពេល") : ui(lang, "All 3 attempts used", "បានប្រើទាំង ៣ ដង")}</b>
                  <span>
                    {ui(lang, "You can now reveal the official answer and solution.", "ឥឡូវអ្នកអាចបង្ហាញចម្លើយ និងដំណោះស្រាយផ្លូវការ។")}
                  </span>
                </div>
              </div>
            )}
            <div className="db-actions">
              <button onClick={() => setHint(!hint)}>
                <Lightbulb />
                {hint ? ui(lang, "Hide hint", "លាក់គន្លឹះ") : ui(lang, "Show hint", "បង្ហាញគន្លឹះ")}
              </button>
              {result === "incorrect" && isOpen && !locked ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setResult("");
                    setResponse("");
                  }}
                >
                  {ui(lang, "Try again", "ព្យាយាមម្តងទៀត")}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={
                    locked ||
                    result === "correct" ||
                    (isOpen ? !response.trim() : choice === null)
                  }
                  onClick={submit}
                >
                  {ui(lang, "Submit answer", "ដាក់ចម្លើយ")}
                </button>
              )}
            </div>
            {!user && (
              <button className="save-signin" onClick={onLogin}>
                <LockKeyhole />
                {ui(lang, "Sign in to save your result", "ចូលគណនីដើម្បីរក្សាទុកលទ្ធផល")}
              </button>
            )}
            {hint && (
              <div className="db-explanation">
                <b>{ui(lang, "Hint", "គន្លឹះ")}</b>
                <MathContent
                  className="explanation-copy"
                  lang={problem.content_language}
                >
                  {problemText(problem, "hint") || ui(lang, "No hint was provided.", "មិនមានគន្លឹះទេ។")}
                </MathContent>
              </div>
            )}
            {((isOpen && locked) ||
              result === "correct" ||
              (!isOpen && result)) &&
              hasSolution && (
                <button
                  className="solution-toggle"
                  onClick={() => setSolution(!solution)}
                >
                  <Eye />
                  {solution ? ui(lang, "Hide solution", "លាក់ដំណោះស្រាយ") : ui(lang, "Reveal solution", "បង្ហាញដំណោះស្រាយ")}
                </button>
              )}
            {solution && (
              <div className="db-explanation solution">
                {problem.answer?.type === "open_ended" && (
                  <>
                    <b>{ui(lang, "Answer", "ចម្លើយ")}</b>
                    <MathContent
                      className={problem.content_language === "km" ? "explanation-copy khmer" : "explanation-copy"}
                      lang={problem.content_language}
                    >
                      {problem.content_language === "km"
                        ? problem.answer.display_answer_km || problem.answer.display_answer
                        : problem.answer.display_answer || problem.answer.display_answer_km}
                    </MathContent>
                  </>
                )}
                <b>{ui(lang, "Solution", "ដំណោះស្រាយ")}</b>
                {problemText(problem, "solution") && (
                  <MathContent
                    className="explanation-copy"
                    lang={problem.content_language}
                  >
                    {problemText(problem, "solution")}
                  </MathContent>
                )}
                {problem.solution_image_url && (
                  <SolutionImage problem={problem} lang={lang} />
                )}
              </div>
            )}
          </>
        )}
      </article>
      {isOpen && (
        <section className="problem-leaderboard">
          <div>
            <Medal />
            <div>
              <span>{ui(lang, "FASTEST CORRECT SOLVERS", "អ្នកដោះស្រាយត្រឹមត្រូវលឿនបំផុត")}</span>
              <h2>{ui(lang, "Problem leaderboard", "តារាងពិន្ទុលំហាត់")}</h2>
            </div>
          </div>
          {!leaders.length ? (
            <p>{ui(lang, "No recorded correct solutions yet. Be the first.", "មិនទាន់មានចម្លើយត្រឹមត្រូវដែលបានកត់ត្រាទេ។ សូមក្លាយជាអ្នកដំបូង។")}</p>
          ) : (
            <ol>
              {leaders.map((x) => (
                <li key={`${x.rank}-${x.display_name}`}>
                  <b>#{x.rank}</b>
                  <span>{x.display_name}</span>
                  <strong>{clock(x.elapsed_seconds)}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}

function ProblemDiagram({ problem, lang }: { problem: ProblemRecord; lang: Language }) {
  return (
    <figure className="problem-diagram">
      <img
        src={problem.diagram_url ?? ""}
        alt={problem.diagram_alt ?? ui(lang, "Diagram for this problem", "ដ្យាក្រាមសម្រាប់លំហាត់នេះ")}
      />
      <figcaption>{ui(lang, "Problem diagram", "ដ្យាក្រាមលំហាត់")}</figcaption>
    </figure>
  );
}

function SolutionImage({ problem, lang }: { problem: ProblemRecord; lang: Language }) {
  return (
    <figure className="problem-diagram solution-image">
      <img
        src={problem.solution_image_url ?? ""}
        alt={
          problem.solution_image_alt ??
          ui(lang, "Image of the solution", "រូបភាពនៃដំណោះស្រាយ")
        }
      />
      <figcaption>{ui(lang, "Solution image", "រូបភាពដំណោះស្រាយ")}</figcaption>
    </figure>
  );
}

function DiagramPreview({
  file,
  url,
  alt,
}: {
  file: File | null;
  url: string;
  alt: string;
}) {
  const [previewUrl, setPreviewUrl] = useState(url);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(url);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, url]);
  return (
    <div className="diagram-preview">
      <img src={previewUrl} alt={alt || "Diagram preview"} />
      <span>{file?.name ?? "Current uploaded diagram"}</span>
    </div>
  );
}

const PROBLEM_DIAGRAM_BUCKET = "problem-diagrams";
const PROBLEM_DIAGRAM_MAX_BYTES = 5 * 1024 * 1024;
const PROBLEM_DIAGRAM_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function diagramUploadErrorMessage(error: { message: string }) {
  if (/bucket\s+not\s+found/i.test(error.message)) {
    return (
      "Diagram storage has not been set up. Run " +
      "supabase/problem_diagrams_migration.sql in the Supabase SQL Editor, then try again."
    );
  }
  return `The diagram could not be uploaded: ${error.message}`;
}

function validateDiagramFile(file: File) {
  if (!PROBLEM_DIAGRAM_MIME_TYPES.has(file.type)) {
    return "Choose a PNG, JPG, or WebP diagram.";
  }
  if (file.size > PROBLEM_DIAGRAM_MAX_BYTES) {
    return "The diagram must be 5 MB or smaller.";
  }
  return null;
}

const blankProblem = {
  type: "qcm" as "qcm" | "open_ended",
  category: "NMO9" as string,
  language: "en" as ProblemLanguage,
  statementEn: "",
  statementKm: "",
  solutionEn: "",
  solutionKm: "",
  hintEn: "",
  hintKm: "",
  hasDiagram: false,
  diagramUrl: "",
  diagramAlt: "",
  hasSolutionImage: false,
  solutionImageUrl: "",
  solutionImageAlt: "",
  topic: "Number Theory",
  difficultyScale: 3,
  timeLimit: "600",
  year: "",
  contestDay: "1",
  problemNumber: "",
  points: "1",
  choices: ["", "", "", ""],
  choicesKm: ["", "", "", ""],
  correct: "0",
  openAnswer: "",
  openAnswerKm: "",
  alternateAnswers: "",
  alternateAnswersKm: "",
  status: "review",
};

const contributorDraftKey = (userId: string) =>
  `lumhat-contributor-draft:${userId}`;
const loadContributorDraft = (userId: string): typeof blankProblem => {
  try {
    const saved = localStorage.getItem(contributorDraftKey(userId));
    if (!saved) return { ...blankProblem };
    const parsed = JSON.parse(saved) as Partial<typeof blankProblem>;
    const primaryChoices =
      Array.isArray(parsed.choices) && parsed.choices.some((choice) => choice.trim())
        ? parsed.choices
        : parsed.choicesKm;
    return {
      ...blankProblem,
      ...parsed,
      language:
        parsed.language ??
        (!parsed.statementEn?.trim() && parsed.statementKm?.trim() ? "km" : "en"),
      statementEn: parsed.statementEn?.trim()
        ? parsed.statementEn
        : (parsed.statementKm ?? ""),
      solutionEn: parsed.solutionEn?.trim()
        ? parsed.solutionEn
        : (parsed.solutionKm ?? ""),
      hintEn: parsed.hintEn?.trim() ? parsed.hintEn : (parsed.hintKm ?? ""),
      openAnswer: parsed.openAnswer?.trim()
        ? parsed.openAnswer
        : (parsed.openAnswerKm ?? ""),
      alternateAnswers: parsed.alternateAnswers?.trim()
        ? parsed.alternateAnswers
        : (parsed.alternateAnswersKm ?? ""),
      choices:
        Array.isArray(primaryChoices) && primaryChoices.length === 4
          ? primaryChoices
          : [...blankProblem.choices],
      choicesKm:
        Array.isArray(parsed.choicesKm) && parsed.choicesKm.length === 4
          ? parsed.choicesKm
          : [...blankProblem.choicesKm],
    };
  } catch {
    return { ...blankProblem };
  }
};

const problemToForm = (problem: ProblemRecord): typeof blankProblem => {
  const qcm =
      problem.answer?.type === "qcm" ||
      problem.answer?.type === "multiple_choice"
        ? problem.answer
        : null,
    open = problem.answer?.type === "open_ended" ? problem.answer : null,
    choices = problemChoices(problem);

  return {
    ...blankProblem,
    type: problem.problem_type === "open_ended" ? "open_ended" : "qcm",
    category: (problem.tags?.[0] ?? "NMO9") as typeof blankProblem.category,
    language: problem.content_language,
    statementEn: problemText(problem, "statement"),
    solutionEn: problemText(problem, "solution"),
    hintEn: problemText(problem, "hint"),
    hasDiagram: Boolean(problem.diagram_url),
    diagramUrl: problem.diagram_url ?? "",
    diagramAlt: problem.diagram_alt ?? "",
    hasSolutionImage: Boolean(problem.solution_image_url),
    solutionImageUrl: problem.solution_image_url ?? "",
    solutionImageAlt: problem.solution_image_alt ?? "",
    topic: problem.topic,
    difficultyScale: problem.difficulty_scale,
    timeLimit: String(problem.time_limit_seconds),
    year: problem.year == null ? "" : String(problem.year),
    contestDay: String(problem.contest_day ?? 1),
    problemNumber:
      problem.problem_number == null ? "" : String(problem.problem_number),
    points: String(problem.points),
    choices: Array.from({ length: 4 }, (_, index) => choices[index] ?? ""),
    correct: String(qcm?.correct_index ?? 0),
    openAnswer:
      problem.content_language === "km"
        ? open?.display_answer_km || open?.display_answer || ""
        : open?.display_answer || open?.display_answer_km || "",
    alternateAnswers:
      (problem.content_language === "km" && open?.accepted_answers_km?.length
        ? open.accepted_answers_km
        : open?.accepted_answers)
        ?.filter((answer) => answer !== (problem.content_language === "km" ? open?.display_answer_km : open?.display_answer))
        .join(", ") ?? "",
    status: problem.status,
  };
};

export function AdminContribute({
  user,
  role,
  onExit,
}: {
  user: AuthUser;
  role: string;
  onExit: () => void;
}) {
  const admin = role === "admin";
  const [mode, setMode] = useState<"problem" | "review" | "manage">("problem"),
    [problem, setProblem] = useState(() => loadContributorDraft(user.id)),
    [categories, setCategories] = useState<CompetitionRecord[]>(PORTALS),
    [review, setReview] = useState<ProblemRecord[]>([]),
    [allProblems, setAllProblems] = useState<ProblemRecord[]>([]),
    [editingId, setEditingId] = useState<string | null>(null),
    [editingCompetitionId, setEditingCompetitionId] = useState<string | null>(
      null,
    ),
    [deleteTarget, setDeleteTarget] = useState<ProblemRecord | null>(null),
    [storageCompetition, setStorageCompetition] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [diagramFile, setDiagramFile] = useState<File | null>(null),
    [solutionImageFile, setSolutionImageFile] = useState<File | null>(null);
  useEffect(() => {
    if (editingId) return;
    try {
      localStorage.setItem(
        contributorDraftKey(user.id),
        JSON.stringify(problem),
      );
    } catch {
      // The form still works when browser storage is unavailable.
    }
  }, [editingId, problem, user.id]);
  const load = async () => {
    if (!supabase) return;
    if (admin) setRefreshing(true);
    let { data: collections, error: collectionError } = await supabase
      .from("competitions")
      .select(
        "id,slug,short_code,name_en,name_km,description_en,description_km,level",
      )
      .neq("short_code", "BANK")
      .order("created_at")
      .limit(100);
    if (collectionError) {
      setNotice(`Could not load the problem bank: ${collectionError.message}`);
    }
    if (!collections?.length && admin) {
      await supabase.from("competitions").upsert(
        {
          slug: "lumhat-problem-bank",
          short_code: "BANK",
          name_en: "Lumhat Problem Bank",
          description_en:
            "Internal storage for the three fixed practice portals.",
          level: "intermediate",
          status: "published",
          created_by: user.id,
        },
        { onConflict: "slug", ignoreDuplicates: true },
      );
      const result = await supabase
        .from("competitions")
        .select("id")
        .eq("slug", "lumhat-problem-bank")
        .maybeSingle();
      collections = result.data ? [result.data as any] : [];
    }
    const databaseCategories = (collections ?? []).filter(
      (collection) =>
        Boolean((collection as CompetitionRecord).short_code) &&
        (collection as CompetitionRecord).short_code !== "BANK",
    ) as CompetitionRecord[];
    const availableCategories = [
      ...databaseCategories,
      ...PORTALS.filter(
        (fallback) =>
          !databaseCategories.some(
            (category) =>
              category.short_code === fallback.short_code ||
              category.slug === `${categorySlug(fallback.short_code)}-category`,
          ),
      ),
    ];
    setCategories(availableCategories);
    if (
      !editingId &&
      !availableCategories.some(
        (category) => category.short_code === problem.category,
      )
    ) {
      setProblem((current) => ({
        ...current,
        category: availableCategories[0]?.short_code ?? current.category,
      }));
    }
    setStorageCompetition(databaseCategories[0]?.id ?? collections?.[0]?.id ?? "");
    if (admin) {
      const { data, error } = await supabase
        .from("problems")
        .select(
          "id,title_en,title_km,statement_en,statement_km,topic,tags,difficulty,status,year,problem_number,answer,creator:profiles!problems_created_by_fkey(display_name)",
        )
        .order("created_at", { ascending: false });
      if (error) {
        setNotice(`Could not load submissions: ${error.message}`);
        setRefreshing(false);
        return;
      }
      const normalized = (data ?? []).map(normalizeProblem);
      setAllProblems(
        normalized.sort((a, b) => {
          const aMissing =
            (a.tags?.includes("NMO9") || a.tags?.includes("NMO12")) &&
            (a.year == null || a.contest_day == null);
          const bMissing =
            (b.tags?.includes("NMO9") || b.tags?.includes("NMO12")) &&
            (b.year == null || b.contest_day == null);
          return Number(bMissing) - Number(aMissing);
        }),
      );
      setReview(
        normalized.filter(
          (item) =>
            (item as ProblemRecord & { status?: string }).status === "review",
        ),
      );
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void load();
  }, [admin]);
  useEffect(() => {
    if (!admin) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [admin]);
  const done = (message: string, error?: DatabaseError | null) => {
    setSaving(false);
    setNotice(error ? problemWriteErrorMessage(error) : message);
    if (!error) void load();
  };
  const saveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!storageCompetition && !editingId) {
      setNotice(
        "Create at least one published competition record in Supabase before saving problems.",
      );
      return;
    }
    const selectedCategory = categories.find(
      (category) => category.short_code === problem.category,
    );
    const studyCategory = problem.category !== "MO";
    const competitionId =
      selectedCategory && isDatabaseCategory(selectedCategory)
        ? selectedCategory.id
        : editingCompetitionId ?? storageCompetition;
    const contestYear = problem.year.trim() ? Number(problem.year) : null;
    const contestDay = Number(problem.contestDay);
    const problemNumber = problem.problemNumber.trim()
      ? Number(problem.problemNumber)
      : null;
    if (
      studyCategory &&
      ((contestYear !== null &&
        (!Number.isInteger(contestYear) ||
          contestYear < 1900 ||
          contestYear > 2100)) ||
        (problemNumber !== null &&
          (!Number.isInteger(problemNumber) || problemNumber < 1)))
    ) {
      setNotice(
        "If supplied, the contest year must be between 1900 and 2100 and the problem number must be a positive whole number.",
      );
      return;
    }
    if (!problem.statementEn.trim()) {
      setNotice("Type the problem statement before submitting.");
      return;
    }
    const latexFields: Array<[string, string]> = [
      ["statement", problem.statementEn],
      ["hint", problem.hintEn],
      ["solution", problem.solutionEn],
      ...problem.choices.map(
        (value, index) => [`choice ${String.fromCharCode(65 + index)}`, value] as [string, string],
      ),
      ["canonical answer", problem.openAnswer],
    ];
    const invalidLatex = latexFields
      .map(([label, value]) => ({ label, issue: validateLatex(value).issues[0] }))
      .find(({ issue }) => issue);
    if (invalidLatex?.issue) {
      setNotice(
        `Fix LaTeX in the ${invalidLatex.label}: ${invalidLatex.issue.message}`,
      );
      return;
    }
    setSaving(true);
    if (problem.hasDiagram && !problem.diagramUrl && !diagramFile) {
      setNotice("Choose a diagram image before saving this problem.");
      setSaving(false);
      return;
    }
    if (
      problem.hasSolutionImage &&
      !problem.solutionImageUrl &&
      !solutionImageFile
    ) {
      setNotice("Choose a solution image before saving this problem.");
      setSaving(false);
      return;
    }
    if (studyCategory && contestYear !== null && problemNumber !== null) {
      let duplicateQuery = supabase
        .from("problems")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("year", contestYear)
        .eq("contest_day", contestDay)
        .eq("problem_number", problemNumber)
        .contains("tags", [problem.category]);
      if (editingId) duplicateQuery = duplicateQuery.neq("id", editingId);
      const { data: duplicate, error: duplicateCheckError } =
        await duplicateQuery.limit(1);
      if (duplicateCheckError) {
        setNotice(
          `Could not check the problem number: ${duplicateCheckError.message}`,
        );
        setSaving(false);
        return;
      }
      if (duplicate?.length) {
        setNotice(
          "That category already has a problem with this contest year, day, and problem number. Edit the existing problem or choose a different number.",
        );
        setSaving(false);
        return;
      }
    }
    let diagramUrl = problem.hasDiagram ? problem.diagramUrl || null : null;
    if (problem.hasDiagram && diagramFile) {
      const validationError = validateDiagramFile(diagramFile);
      if (validationError) {
        setNotice(validationError);
        setSaving(false);
        return;
      }
      const extension = diagramFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PROBLEM_DIAGRAM_BUCKET)
        .upload(path, diagramFile, {
          contentType: diagramFile.type,
          upsert: false,
        });
      if (uploadError) {
        setNotice(diagramUploadErrorMessage(uploadError));
        setSaving(false);
        return;
      }
      diagramUrl = supabase.storage
        .from(PROBLEM_DIAGRAM_BUCKET)
        .getPublicUrl(path).data.publicUrl;
    }
    let solutionImageUrl = problem.hasSolutionImage
      ? problem.solutionImageUrl || null
      : null;
    if (problem.hasSolutionImage && solutionImageFile) {
      const validationError = validateDiagramFile(solutionImageFile);
      if (validationError) {
        setNotice(validationError.replace(/diagram/gi, "solution image"));
        setSaving(false);
        return;
      }
      const extension =
        solutionImageFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PROBLEM_DIAGRAM_BUCKET)
        .upload(path, solutionImageFile, {
          contentType: solutionImageFile.type,
          upsert: false,
        });
      if (uploadError) {
        setNotice(
          diagramUploadErrorMessage(uploadError).replace(/diagram/gi, "solution image"),
        );
        setSaving(false);
        return;
      }
      solutionImageUrl = supabase.storage
        .from(PROBLEM_DIAGRAM_BUCKET)
        .getPublicUrl(path).data.publicUrl;
    }
    const metadata = {
      language: problem.language,
      difficulty_scale: problem.difficultyScale,
      time_limit_seconds: Number(problem.timeLimit),
      category: problem.category,
      ...(problem.hasDiagram && diagramUrl
        ? {
            diagram_url: diagramUrl,
            diagram_alt:
              problem.diagramAlt.trim() || "Diagram for this problem",
          }
        : {}),
      ...(problem.category !== "MO"
        ? { contest_day: Number(problem.contestDay) }
        : {}),
      ...(problem.hasSolutionImage && solutionImageUrl
        ? {
            solution_image_url: solutionImageUrl,
            solution_image_alt:
              problem.solutionImageAlt.trim() || "Image of the solution",
          }
        : {}),
    };
    const answer = studyCategory
      ? { type: "study", ...metadata }
      : problem.type === "qcm"
        ? {
            type: "qcm",
            choices_en: problem.choices.map((x) =>
              normalizeMathText(x.trim()),
            ),
            correct_index: Number(problem.correct),
            ...metadata,
          }
        : {
            type: "open_ended",
            display_answer: normalizeMathText(problem.openAnswer.trim()),
            accepted_answers: [
              problem.openAnswer,
              ...problem.alternateAnswers.split(","),
            ]
              .map((x) => normalizeMathText(x.trim()))
              .filter(Boolean),
            ...metadata,
          };
    const difficulty =
      problem.difficultyScale <= 2
        ? "beginner"
        : problem.difficultyScale >= 4
          ? "advanced"
          : "intermediate";
    const values = {
      competition_id: competitionId,
      statement_en: normalizeMathText(problem.statementEn.trim()),
      statement_km: null,
      solution_en: normalizeMathText(problem.solutionEn.trim()),
      solution_km: null,
      hint_en: normalizeMathText(problem.hintEn) || null,
      hint_km: null,
      topic: problem.topic,
      tags: [problem.category],
      difficulty,
      year: studyCategory ? contestYear : Number(problem.year) || null,
      contest_day: studyCategory ? contestDay : null,
      problem_number: studyCategory ? problemNumber : null,
      points: Number(problem.points) || 1,
      status: admin ? problem.status : "review",
      answer,
    };
    const { error } = editingId
      ? await supabase
          .from("problems")
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq("id", editingId)
      : await supabase.from("problems").insert({
          ...values,
          // Kept only because older database schemas require this legacy column.
          title_en: "",
          title_km: null,
          created_by: user.id,
        });
    done(
      editingId
        ? "Problem updated successfully."
        : "Problem submitted to " + problem.category + ".",
      error,
    );
    if (!error) {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setEditingCompetitionId(null);
      setDiagramFile(null);
      setSolutionImageFile(null);
      if (wasEditing) {
        setProblem(loadContributorDraft(user.id));
      } else {
        try {
          localStorage.removeItem(contributorDraftKey(user.id));
        } catch {
          // Ignore unavailable browser storage after a successful save.
        }
        setProblem({
          ...blankProblem,
          type: problem.type,
          category: problem.category,
        });
      }
    }
  };
  const editProblem = async (id: string) => {
    if (!supabase || !admin) return;
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("problems")
      .select("*")
      .eq("id", id)
      .single();
    setSaving(false);
    if (error || !data) {
      setNotice(error?.message ?? "Problem could not be loaded.");
      return;
    }
    const formProblem = problemToForm(normalizeProblem(data));
    const assignedCategory = categories.find(
      (category) =>
        category.id === data.competition_id ||
        formProblem.category === category.short_code,
    );
    setProblem({
      ...formProblem,
      category: assignedCategory?.short_code ?? formProblem.category,
    });
    setDiagramFile(null);
    setSolutionImageFile(null);
    setEditingId(id);
    setEditingCompetitionId(data.competition_id);
    setMode("problem");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingCompetitionId(null);
    setDiagramFile(null);
    setSolutionImageFile(null);
    setProblem(loadContributorDraft(user.id));
    setNotice("");
  };
  const publish = async (id: string) => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase
      .from("problems")
      .update({ status: "published" })
      .eq("id", id);
    done("Problem published.", error);
  };
  const remove = async () => {
    if (!supabase || !deleteTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("problems")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleteTarget(null);
    done("Problem deleted.", error);
  };
  const heading =
      mode === "problem"
        ? editingId
          ? "Edit problem"
          : "Contribute a problem"
        : mode === "review"
          ? "Review submissions"
          : "Manage problems",
    description =
      mode === "problem"
        ? editingId
          ? "Update the problem details and visibility, then save your changes."
          : "Choose one of the three fixed categories, then add the complete problem details."
        : mode === "review"
          ? "Approve contributor problems for their assigned category."
          : "Edit existing problems, assign missing NMO contest years, or permanently delete content.";
  return (
    <main className="contribute-page">
      <header>
        <button className="contribute-brand" onClick={onExit}>
          <img src="/logo.png" alt="" />Lumhat
        </button>
        <div>
          <ShieldCheck />
          {admin ? "Admin" : "Contributor"} workspace
        </div>
        <button onClick={onExit}>
          Exit <X />
        </button>
      </header>
      <div className="contribute-shell">
        <aside>
          <span>CONTENT</span>
          <button
            className={mode === "problem" ? "active" : ""}
            onClick={() => {
              setMode("problem");
              if (editingId) cancelEdit();
            }}
          >
            <FilePlus2 />
            Add problem
          </button>
          {admin && (
            <>
              <button
                className={mode === "review" ? "active" : ""}
                onClick={() => {
                  setMode("review");
                  void load();
                }}
              >
                <ListChecks />
                Review submissions
              </button>
              <button
                className={mode === "manage" ? "active" : ""}
                onClick={() => {
                  setMode("manage");
                  void load();
                }}
              >
                <Trash2 />
                Manage problems
              </button>
            </>
          )}
          <div className="admin-identity">
            <span>{user.email?.[0].toUpperCase()}</span>
            <div>
              <b>{user.email}</b>
              <small>Verified {admin ? "administrator" : "contributor"}</small>
            </div>
          </div>
        </aside>
        <section>
          <div className="contribute-heading">
            <span className="kicker">
              {admin ? "CONTENT MANAGEMENT" : "COMMUNITY CONTRIBUTION"}
            </span>
            <h1>{heading}</h1>
            <p>{description}</p>
            {admin && mode !== "problem" && (
              <button
                type="button"
                className="review-refresh-button"
                disabled={refreshing}
                onClick={() => void load()}
              >
                <RefreshCw className={refreshing ? "spinning" : ""} />
                {refreshing ? "Refreshing…" : "Refresh submissions"}
              </button>
            )}
          </div>
          {notice && (
            <div
              className={
                /published|submitted|updated|deleted/.test(notice)
                  ? "contribute-notice success"
                  : "contribute-notice"
              }
            >
              {notice}
            </div>
          )}
          {mode === "problem" ? (
            <>
              {editingId && (
                <div className="editing-banner">
                  <span>
                    <Pencil /> Editing an existing problem
                  </span>
                  <button type="button" onClick={cancelEdit}>
                    Cancel edit
                  </button>
                </div>
              )}
              <ProblemForm
                problem={problem}
                setProblem={setProblem}
                categories={categories}
                diagramFile={diagramFile}
                setDiagramFile={setDiagramFile}
                solutionImageFile={solutionImageFile}
                setSolutionImageFile={setSolutionImageFile}
                saving={saving}
                admin={admin}
                submitLabel={editingId ? "Save changes" : "Save problem"}
                onSubmit={saveProblem}
              />
            </>
          ) : mode === "review" ? (
            <div className="review-list">
              {refreshing && review.length === 0 ? (
                <BankState
                  icon={<RefreshCw />}
                  title="Refreshing submissions"
                  text="Checking the latest contributor problems."
                />
              ) : review.length === 0 ? (
                <BankState
                  icon={<CheckCircle2 />}
                  title="Review queue is clear"
                  text="No contributor submissions are waiting."
                />
              ) : (
                review.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span>
                        {item.tags?.[0]} · {item.content_language === "km" ? "ខ្មែរ" : "English"} · {item.topic} ·{" "}
                        {item.problem_type === "study"
                          ? "Solution study"
                          : item.problem_type === "open_ended"
                            ? "Open-ended"
                            : "QCM"}
                        {item.problem_type === "study" &&
                          ` · ${item.year ?? "Year missing"} · ${item.contest_day ? `Day ${item.contest_day}` : "Day missing"}`}
                      </span>
                      <small className="submission-writer">
                        by {safeContributorName(item.creator)}
                      </small>
                      <MathContent
                        as="div"
                        className="review-problem-statement"
                        lang={item.content_language}
                      >
                        {problemText(item, "statement")}
                      </MathContent>
                      <Bulbs value={item.difficulty_scale} />
                    </div>
                    <div className="problem-row-actions">
                      <button
                        className="edit-button"
                        disabled={saving}
                        onClick={() => void editProblem(item.id)}
                      >
                        <Pencil />
                        Edit
                      </button>
                      <button
                        className="primary"
                        disabled={saving}
                        onClick={() => publish(item.id)}
                      >
                        <Check />
                        Publish
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="review-list manage-list">
              {allProblems.length === 0 ? (
                <BankState
                  icon={<BookOpen />}
                  title="No problems yet"
                  text="Created problems will appear here."
                />
              ) : (
                allProblems.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span>
                        {item.tags?.[0] ?? "Uncategorized"} · {item.content_language === "km" ? "ខ្មែរ" : "English"} · {item.topic} ·{" "}
                        {item.problem_type === "study"
                          ? "Solution study"
                          : item.problem_type === "open_ended"
                            ? "Open-ended"
                            : "QCM"}
                      </span>
                      {(item.tags?.includes("NMO9") ||
                        item.tags?.includes("NMO12")) && (
                        <div
                          className={`archive-year-status ${item.year == null || item.contest_day == null ? "missing" : ""}`}
                        >
                          <CalendarDays />
                          {item.year == null
                            ? "Year missing — edit this problem"
                            : item.contest_day == null
                              ? `${item.year} · Day missing — edit this problem`
                              : `${item.year} · Day ${item.contest_day}${item.problem_number ? ` · Problem ${item.problem_number}` : ""}`}
                        </div>
                      )}
                      <MathContent
                        as="div"
                        className="review-problem-statement"
                        lang={item.content_language}
                      >
                        {problemText(item, "statement")}
                      </MathContent>
                      <Bulbs value={item.difficulty_scale} />
                    </div>
                    <div className="problem-row-actions">
                      <button
                        className="edit-button"
                        disabled={saving}
                        onClick={() => void editProblem(item.id)}
                      >
                        <Pencil />
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 />
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </div>
      {deleteTarget && (
        <div
          className="delete-dialog-backdrop"
          onMouseDown={() => setDeleteTarget(null)}
        >
          <div
            className="delete-dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span>
              <Trash2 />
            </span>
            <h2>Delete this problem?</h2>
            <p>
              This problem and all of its saved attempts will be permanently deleted.
              This cannot be undone.
            </p>
            <div>
              <button onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="danger-button"
                disabled={saving}
                onClick={remove}
              >
                {saving ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ProblemForm({
  problem,
  setProblem,
  categories,
  diagramFile,
  setDiagramFile,
  solutionImageFile,
  setSolutionImageFile,
  saving,
  admin,
  submitLabel,
  onSubmit,
}: {
  problem: typeof blankProblem;
  setProblem: (p: typeof blankProblem) => void;
  categories: CompetitionRecord[];
  diagramFile: File | null;
  setDiagramFile: (file: File | null) => void;
  solutionImageFile: File | null;
  setSolutionImageFile: (file: File | null) => void;
  saving: boolean;
  admin: boolean;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const studyCategory = problem.category !== "MO";
  const setChoice = (i: number, v: string) =>
    setProblem({
      ...problem,
      choices: problem.choices.map((x, n) => (n === i ? v : x)),
    });
  return (
    <form
      className={`contribute-form ${problem.language === "km" ? "problem-content-khmer" : ""}`}
      onSubmit={onSubmit}
    >
      {!studyCategory && (
        <div className="problem-type-picker">
          <button
            type="button"
            className={problem.type === "qcm" ? "active" : ""}
            onClick={() => setProblem({ ...problem, type: "qcm" })}
          >
            <ListChecks />
            <b>QCM</b>
            <span>Multiple-choice answer (A, B, C…)</span>
          </button>
          <button
            type="button"
            className={problem.type === "open_ended" ? "active" : ""}
            onClick={() => setProblem({ ...problem, type: "open_ended" })}
          >
            <BookOpen />
            <b>Open-ended</b>
            <span>Written answer and optional solution</span>
          </button>
        </div>
      )}
      <FormSection title="Classification">
        <SelectField
          label="Problem language"
          value={problem.language}
          options={["en", "km"]}
          labels={["English", "ខ្មែរ"]}
          onChange={(language) =>
            setProblem({ ...problem, language: language as ProblemLanguage })
          }
        />
        <SelectField
          label="Competition category"
          value={problem.category}
          options={categories.map((x) => x.short_code)}
          labels={categories.map((x) => `${x.short_code} — ${x.name_en}`)}
          onChange={(category) =>
            setProblem({
              ...problem,
              category: category as typeof problem.category,
            })
          }
        />
        <SelectField
          label="Topic"
          value={problem.topic}
          options={TOPICS.map((x) => x[0]) as unknown as string[]}
          labels={TOPICS.map((x) => `${x[1]} — ${x[0]}`)}
          onChange={(topic) => setProblem({ ...problem, topic })}
        />
        {studyCategory && (
          <>
            <Field
              label="Contest year"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 2026"
              value={problem.year}
              onChange={(year) => setProblem({ ...problem, year })}
            />
            <SelectField
              label="Contest day"
              value={problem.contestDay}
              options={["1", "2"]}
              labels={["Day 1", "Day 2"]}
              onChange={(contestDay) =>
                setProblem({ ...problem, contestDay })
              }
            />
            <Field
              label="Problem number"
              type="number"
              value={problem.problemNumber}
              onChange={(problemNumber) =>
                setProblem({ ...problem, problemNumber })
              }
            />
          </>
        )}
        <label className="difficulty-field">
          <span>
            Difficulty
          </span>
          <Bulbs
            interactive
            value={problem.difficultyScale}
            onChange={(difficultyScale) =>
              setProblem({ ...problem, difficultyScale })
            }
          />
        </label>
        {!studyCategory && (
          <SelectField
            label="Time limit"
            value={problem.timeLimit}
            options={TIMES.map(String)}
            labels={TIMES.map(timeLabel)}
            onChange={(timeLimit) => setProblem({ ...problem, timeLimit })}
          />
        )}
      </FormSection>
      <FormSection
        title={`Problem text · ${problem.language === "km" ? "ខ្មែរ" : "English"}`}
      >
        <p className="single-language-note wide">
          The problem statement must be typed. A hint is optional.
        </p>
        <TextArea
          label="Problem statement"
          required
          math
          value={problem.statementEn}
          onChange={(statementEn) => setProblem({ ...problem, statementEn })}
        />
        <TextArea
          label="Hint"
          math
          value={problem.hintEn}
          onChange={(hintEn) => setProblem({ ...problem, hintEn })}
        />
      </FormSection>
      <FormSection title="Optional problem diagram">
        <label className="diagram-toggle wide">
          <input
            type="checkbox"
            checked={problem.hasDiagram}
            onChange={(event) => {
              setProblem({ ...problem, hasDiagram: event.target.checked });
              if (!event.target.checked) setDiagramFile(null);
            }}
          />
          <span>
            <ImageIcon />
            <b>Attach a supporting diagram</b>
            <small>
              Add an image only when learners need it to understand or solve the
              typed problem statement.
            </small>
          </span>
        </label>
        {problem.hasDiagram && (
          <div className="diagram-upload wide">
            <label>
              <span>Problem diagram</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required={!problem.diagramUrl}
                onChange={(event) => setDiagramFile(event.target.files?.[0] ?? null)}
              />
              <small>PNG, JPG, or WebP; maximum 5 MB.</small>
            </label>
            <Field
              label="Picture description"
              value={problem.diagramAlt}
              placeholder="Example: Triangle ABC with altitude AD"
              onChange={(diagramAlt) => setProblem({ ...problem, diagramAlt })}
            />
            {(diagramFile || problem.diagramUrl) && (
              <DiagramPreview
                file={diagramFile}
                url={problem.diagramUrl}
                alt={problem.diagramAlt}
              />
            )}
          </div>
        )}
      </FormSection>
      {!studyCategory &&
        (problem.type === "qcm" ? (
          <FormSection title="Answer choices">
            {problem.choices.map((x, i) => (
              <Field
                key={i}
                label={`Choice ${String.fromCharCode(65 + i)}`}
                math
                value={x}
                onChange={(v) => setChoice(i, v)}
              />
            ))}
            <SelectField
              label="Correct choice"
              value={problem.correct}
              options={["0", "1", "2", "3"]}
              labels={["A", "B", "C", "D"]}
              onChange={(correct) => setProblem({ ...problem, correct })}
            />
          </FormSection>
        ) : (
          <FormSection title="Optional answer">
            <Field
              label="Canonical answer"
              math
              value={problem.openAnswer}
              onChange={(openAnswer) => setProblem({ ...problem, openAnswer })}
            />
            <Field
              label="Alternate accepted answers"
              value={problem.alternateAnswers}
              onChange={(alternateAnswers) =>
                setProblem({ ...problem, alternateAnswers })
              }
            />
          </FormSection>
        ))}
      <FormSection title="Optional solution">
        <p className="single-language-note wide">
          Add a typed solution, a clear picture of the solution, or both.
        </p>
        <TextArea
          label="Typed solution"
          math
          value={problem.solutionEn}
          onChange={(solutionEn) => setProblem({ ...problem, solutionEn })}
        />
        <label className="diagram-toggle wide">
          <input
            type="checkbox"
            checked={problem.hasSolutionImage}
            onChange={(event) => {
              setProblem({ ...problem, hasSolutionImage: event.target.checked });
              if (!event.target.checked) setSolutionImageFile(null);
            }}
          />
          <span>
            <ImageIcon />
            <b>Upload the solution as a picture</b>
            <small>Use a clear photo or screenshot of the worked solution.</small>
          </span>
        </label>
        {problem.hasSolutionImage && (
          <div className="diagram-upload wide">
            <label>
              <span>Solution picture</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required={!problem.solutionImageUrl}
                onChange={(event) =>
                  setSolutionImageFile(event.target.files?.[0] ?? null)
                }
              />
              <small>PNG, JPG, or WebP; maximum 5 MB.</small>
            </label>
            <Field
              label="Picture description"
              value={problem.solutionImageAlt}
              placeholder="Example: Handwritten proof using similar triangles"
              onChange={(solutionImageAlt) =>
                setProblem({ ...problem, solutionImageAlt })
              }
            />
            {(solutionImageFile || problem.solutionImageUrl) && (
              <DiagramPreview
                file={solutionImageFile}
                url={problem.solutionImageUrl}
                alt={problem.solutionImageAlt}
              />
            )}
          </div>
        )}
      </FormSection>
      {admin ? (
        <PublishBar
          status={problem.status}
          setStatus={(status) => setProblem({ ...problem, status })}
          saving={saving}
          label={submitLabel}
        />
      ) : (
        <SaveBar saving={saving} label="Submit for review" />
      )}
    </form>
  );
}
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="contribute-fields">{children}</div>
    </fieldset>
  );
}
function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  math = false,
  wide = false,
  placeholder,
  inputMode,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  math?: boolean;
  wide?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}) {
  return (
    <label className={wide ? "wide" : undefined}>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      <input
        required={required}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {math && value.trim() && (
        <LatexPreview value={value} />
      )}
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
  required = false,
  math = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  math?: boolean;
}) {
  return (
    <label className="wide">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      <textarea
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {math && value.trim() && <LatexPreview value={value} />}
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  labels,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: readonly string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((x, i) => (
          <option value={x} key={x}>
            {labels?.[i] ?? titleCase(x)}
          </option>
        ))}
      </select>
    </label>
  );
}
function SaveBar({ saving, label }: { saving: boolean; label: string }) {
  return (
    <div className="publish-bar">
      <span>Your unfinished draft is saved automatically on this device.</span>
      <button className="primary" disabled={saving}>
        {saving ? "Saving…" : label}
        <Check />
      </button>
    </div>
  );
}
function PublishBar({
  status,
  setStatus,
  saving,
  label,
}: {
  status: string;
  setStatus: (v: string) => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="publish-bar">
      <div>
        <span>Visibility</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">Draft — admin only</option>
          <option value="review">In review — admin only</option>
          <option value="published">Published — visible to learners</option>
        </select>
      </div>
      <button className="primary" disabled={saving}>
        {saving ? "Saving…" : label}
        <Check />
      </button>
    </div>
  );
}
