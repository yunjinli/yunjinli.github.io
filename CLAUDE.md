# yunjinli.github.io

Personal academic site (Jekyll, al-folio theme). Original theme README moved to
`README_Orig.md` — this file is the working reference for maintaining content
and the custom terminal widget on the about page.

## Adding a news item

Create a new file in `_news/`, e.g. `_news/announcement_6.md`:

```yaml
---
layout: post
date: 2026-07-12 12:00:00-0000
inline: true
related_posts: false
---

Short announcement text, emoji ok :tada:
```

- `inline: true` renders it as a one-liner in the news list (typical case).
- Omit `inline` and add a `title:` for a full post instead.
- Sorted by `date` automatically, newest first.

**Where it shows up:**
- About page's own News section and the terminal's `1:news` tab / `/latest_news`
  preview both read from the same `_news/` collection — no other file needs editing.
- `_config.yml`'s `announcements.limit` (currently `5`) caps the about page's
  plain News section.
- The terminal's `1:news` tab (ctrl+b 1) always shows **every** news item
  (reads the unfiltered `#about-news-full` container in `_layouts/about.liquid`).
- Typed `/latest_news` shows a short preview, capped by `"previewCount"` on the
  `/latest_news` entry in the terminal's command list — see
  [Terminal command list](#terminal-command-list-_pagesaboutmd) below.

## Adding a publication

Add a BibTeX entry to `_bibliography/papers.bib`:

```bibtex
@article{lastname2026key,
  title={Paper Title},
  author={Last, First and Other, Author},
  journal={Venue Name YYYY},
  year={2026},
  html={https://yunjinli.github.io/project-page/},
  arxiv={2601.xxxxx},
  selected={true},
  github={yunjinli/repo-name},
  preview={paper-preview.gif}
}
```

- `selected={true}` — **required** to appear on the about page / terminal.
  There's only one publications list (no separate "show all" tab like news/projects) —
  it's whatever's marked `selected`.
- `html={URL}` — the canonical link used for the title and the globe-icon
  "Project" button. The terminal always prefers this over `arxiv`/`github` when
  making the title clickable, so set it to whatever you want readers to land on.
- `preview={filename}` — image/gif, must already exist under
  `assets/img/publication_preview/` (or pass a full `://` URL instead).
- `arxiv`, `github` — optional extra link buttons.
- Full list of recognized-but-hidden bibtex keys (won't leak into rendered
  text): see `filtered_bibtex_keywords` in `_config.yml`.

**Where it shows up:** about page's Publications section, terminal's
`2:publications` tab, and typed `/publications` — all the same selected set,
via `#about-publications` (built by `_includes/selected_papers.liquid`).

## Adding a project

Create a new file in `_projects/`, e.g. `_projects/7_project.md`:

```yaml
---
layout: page
title: Project Title
description: One-line description shown under the title
img: assets/img/project-preview.gif   # or use `video: assets/video/x.mp4`
redirect: https://project-page-or-notion-link.example    # or use `url:` for an in-site project page instead
importance: 7       # lower number = higher up the list
category: work
github: yunjinli/repo-name
selected: true       # required to appear as a "selected" project
---

Full project page body (only matters if you don't set `redirect`).
```

- `selected: true` — controls the **selected-only** views: the about page's
  Projects section and typed `/projects` in the terminal.
- `3:projects` tab (ctrl+b 3) is the one exception — it always shows **every**
  project regardless of `selected`, via the unfiltered `#about-projects-full`
  container (`_includes/projects_list_full.liquid`), mirroring the news split above.
- `importance` sets sort order (ascending) in both the selected and full lists.
- Use `redirect` for an external/Notion/paper page; use `url` (default, page's
  own permalink) to let the project have its own page on this site.

## Terminal command list (`_pages/about.md`)

Near the top of `_pages/about.md` there's a `<script type="application/json"
id="fetch-terminal-commands">` block — a JSON array of command objects read by
`assets/js/fetch-terminal.js`. Relevant fields per entry:

| field | meaning |
|---|---|
| `cmd` | the typed command, e.g. `"/projects"` |
| `window` | tmux window id it opens when clicked as a tab (or via `ctrl+b <key>`) |
| `key` | number key for `ctrl+b <key>` |
| `print` | which `#about-<print>`[`-full`] container the **window/tab** view renders |
| `text` | if set, typing this command renders the same rich preview inline (appended, not replacing prior output) instead of switching tabs |
| `previewCount` | (news only, so far) how many items the **typed** command shows before pointing to the full tab |
| `desc` | shown in `/help` |

To add a brand-new typed command, add an entry here and a matching branch in
`run()` in `assets/js/fetch-terminal.js`.

## Other configurable parameters (`_config.yml`)

- `announcements.limit` — how many news items show on the plain about page (blank = all).
- `latest_posts.enabled` / `latest_posts.limit` — blog post preview on about page.
- `cv_url` / `cv_preview_url` — Google Drive share link / embeddable `/preview`
  link, used by the navbar and the terminal's `/cv`.
- `tum_vcard_url` — TUM Online business card link.
- `contact_note` — text shown below the about page (footer/social area).
- `footer_text` — site-wide copyright text; also what the terminal's `/info`
  command prints (via the `fetch_terminal_info_text` capture block near the
  top of `_pages/about.md`).
- `max_author_limit` — cap authors shown per publication before "click to expand".
- `scholar.style` — citation style (apa, etc.) for rendered bibliography entries.

## Verifying changes

`bundle exec jekyll build` (or `bundle exec jekyll serve -P 4321`) to check for
build errors. For terminal JS/behavior changes, the established test method
this session used headless Chrome via raw CDP (no puppeteer/playwright in this
environment): launch `google-chrome --headless --disable-gpu
--remote-debugging-port=9222 --no-sandbox`, then drive it with a small Python
script over the `websockets` + `requests` libraries (navigate, dispatch
synthetic input/keydown events into `#fetch-terminal-input`, inspect the DOM via
`Runtime.evaluate`). Clean up the Chrome process and any stray screenshots
afterward.
