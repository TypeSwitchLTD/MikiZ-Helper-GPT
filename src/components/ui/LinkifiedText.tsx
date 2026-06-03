import type { ReactNode } from "react";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[),.;:!?]+$/;

function splitUrl(value: string): { url: string; trailing: string } {
  const match = value.match(TRAILING_PUNCTUATION);
  if (!match) return { url: value, trailing: "" };
  const trailing = match[0];
  return { url: value.slice(0, -trailing.length), trailing };
}

function normalizeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    const { url, trailing } = splitUrl(raw);
    parts.push(
      <a
        key={`${url}-${index}`}
        href={normalizeHref(url)}
        target="_blank"
        rel="noreferrer"
        className="font-black text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900"
        onClick={(event) => event.stopPropagation()}
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <span className={className}>{parts}</span>;
}
