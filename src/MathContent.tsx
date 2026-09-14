import { useEffect, useMemo, useRef } from "react";
import katex from "katex";
import renderMathInElement from "katex/contrib/auto-render";

type MathContentProps = {
  children: string | null | undefined;
  as?: "div" | "span";
  className?: string;
  lang?: "en" | "km";
};

type LatexIssue = {
  expression: string;
  message: string;
};

const isEscaped = (text: string, index: number) => {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
};

const findToken = (text: string, token: string, from: number) => {
  let index = text.indexOf(token, from);
  while (index >= 0 && isEscaped(text, index))
    index = text.indexOf(token, index + token.length);
  return index;
};

/** Removes an accidental escaped closing dollar produced by copied JSON/Markdown. */
export function normalizeMathText(text: string) {
  return text.replace(/\\{2}(?=\$)/g, "");
}

export function validateLatex(value: string) {
  const text = normalizeMathText(value);
  const issues: LatexIssue[] = [];
  let formulaCount = 0;
  let cursor = 0;
  const delimiters = [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
    { left: "$", right: "$", display: false },
  ];

  while (cursor < text.length) {
    const next = delimiters
      .map((delimiter) => ({
        ...delimiter,
        index: findToken(text, delimiter.left, cursor),
      }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index || b.left.length - a.left.length)[0];

    if (!next) break;
    const contentStart = next.index + next.left.length;
    const close = findToken(text, next.right, contentStart);
    if (close < 0) {
      issues.push({
        expression: text.slice(next.index),
        message: `Missing closing delimiter ${next.right}`,
      });
      break;
    }

    const expression = text.slice(contentStart, close).trim();
    formulaCount++;
    if (!expression) {
      issues.push({ expression: next.left + next.right, message: "The formula is empty." });
    } else {
      try {
        katex.renderToString(expression, {
          displayMode: next.display,
          throwOnError: true,
          strict: "error",
          trust: false,
        });
      } catch (error) {
        issues.push({
          expression,
          message: error instanceof Error
            ? error.message.replace(/^KaTeX parse error:\s*/i, "")
            : "Invalid LaTeX expression.",
        });
      }
    }
    cursor = close + next.right.length;
  }

  return { issues, formulaCount };
}

/**
 * Renders ordinary prose with LaTeX wherever a supported delimiter appears.
 * Inline: $...$ or \(...\). Display: $$...$$ or \[...\].
 */
export function MathContent({
  children,
  as: Tag = "div",
  className = "",
  lang,
}: MathContentProps) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);
  const text = normalizeMathText(children ?? "");

  useEffect(() => {
    if (!ref.current) return;
    renderMathInElement(ref.current, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      strict: false,
      trust: false,
    });
  }, [text]);

  return (
    <Tag ref={ref} className={`math-content ${className}`.trim()} lang={lang}>
      {text}
    </Tag>
  );
}

export function LatexPreview({ value }: { value: string }) {
  const validation = useMemo(() => validateLatex(value), [value]);
  return (
    <div className={`latex-preview ${validation.issues.length ? "has-error" : ""}`.trim()}>
      <div className="latex-preview-heading">
        <small>Live preview</small>
        {validation.issues.length > 0 && (
          <span>
            {`${validation.issues.length} formatting ${validation.issues.length === 1 ? "issue" : "issues"}`}
          </span>
        )}
      </div>
      <MathContent>{value}</MathContent>
      {validation.issues.length > 0 && (
        <ul className="latex-errors">
          {validation.issues.map((issue, index) => (
            <li key={`${issue.expression}-${index}`}>
              <code>{issue.expression}</code>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
