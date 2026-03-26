import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { marked } from "marked";

let cachedHtml: string | undefined;

function renderPrivacyPage(): string {
  if (cachedHtml) return cachedHtml;

  const md = readFileSync(
    resolve(process.cwd(), "docs", "privacy-policy.md"),
    "utf-8",
  );
  const content = marked.parse(md) as string;

  cachedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Hotdog Photo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.7;
      padding: 2rem 1rem;
    }
    .container { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.35rem; margin-top: 2.5rem; margin-bottom: 0.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid #ddd; }
    h3 { font-size: 1.1rem; margin-top: 1.75rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
    a { text-decoration: underline; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.35rem; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
    th { font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;

  return cachedHtml;
}

export function handlePrivacy(): Response {
  return new Response(renderPrivacyPage(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
