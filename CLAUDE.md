# yunjinli.github.io

Personal academic site (Jekyll, al-folio theme) with a custom portfolio homepage.
The original theme README is in `README_Orig.md`.

## Homepage

- `_pages/about.md`: short biography and homepage front matter. Set
  `profile.image` to a filename in `assets/img/` to change the portrait.
- `_layouts/about.liquid`: biography on the left, portrait on the right,
  affiliations, news, selected research, selected projects, and student contact.
  The bio and portrait stack on narrow screens.
- `_includes/portfolio-header.liquid`: standard section links, CV, and theme toggle.
- `_includes/portfolio-projects.liquid`: project cards; selected entries show in
  the initial view until the reader expands the list.
- `_includes/portfolio-footer.liquid`: homepage credits and contact information.
- `_sass/_portfolio.scss`: scoped homepage styles, breakpoints, and motion.
- `assets/js/portfolio.js`: active navigation, inline list expansion, individual card entrances on scroll, and
  video previews on hover. Native video controls remain available on touch
  devices. Reduced-motion preferences disable automatic animation and previews.
  Cards fade upward after entering the viewport, with a brief stagger within grid rows.
  They replay after leaving the screen completely; newly expanded cards follow
  the same behavior. Headings animate separately. Cards are prepared only after
  scroll observers are installed; reduced motion, keyboard focus, and no-JS
  viewing keep the content visible.

Without JavaScript, complete lists remain visible. All news / All projects /
All publications controls appear only when there are more entries to reveal.
News uses `announcements.limit`; publications and projects use `selected`.
The controls expand in place and change to Show less. Hashes `#all-news`,
`#all-publications`, and `#all-projects` open the complete corresponding list.
The old `/news/`, `/publications/`, and `/projects/` routes redirect to these
homepage hashes through `_layouts/portfolio-redirect.liquid`.

The homepage
uses `portfolio: true` to select its navigation, footer, styles, and script.
The former `_sass/_terminal.scss` and `assets/js/fetch-terminal.js` are retained
as legacy sources but are no longer loaded.

## Adding a news item

Create a file in `_news/`, for example `_news/announcement_8.md`:

```yaml
---
layout: post
date: 2026-10-03 12:00:00-0000
inline: true
related_posts: false
---
Short announcement text, emoji supported.
```

- `inline: true` shows the announcement body in the list. Otherwise add a
  `title` for a separate post.
- The homepage shows the newest items, limited by `_config.yml`'s
  `announcements.limit`. All news expands the complete list in place.

## Adding a publication

Add a BibTeX entry to `_bibliography/papers.bib`:

```bibtex
@article{lastname2026key,
  title={Paper Title},
  author={Last, First and Other, Author},
  journal={Venue Name},
  year={2026},
  html={https://yunjinli.github.io/project-page/},
  arxiv={2601.xxxxx},
  selected={true},
  github={yunjinli/repo-name},
  preview={paper-preview.gif}
}
```

- `selected={true}` includes the entry in the homepage's Selected research.
  All publications expands the full bibliography in place. The control is
  omitted when all publications are already selected and visible.
- `html` supplies the Project link and the clickable title on the homepage.
- `preview` is a filename in `assets/img/publication_preview/` or a full URL.
- `arxiv` and `github` are optional extra links.
- GitHub stars use the same button style as the other links. The browser reads
  the public GitHub API and caches counts for an hour in session storage;
  failures fall back to a plain GitHub link.
- `filtered_bibtex_keywords` in `_config.yml` controls which custom keys are
  hidden in rendered citations.

## Adding a project

Create a file in `_projects/`, for example `_projects/7_project.md`:

```yaml
---
layout: page
title: Project Title
description: One-line description
img: assets/img/project-preview.gif
# Alternatively: video: assets/video/demo.mp4
redirect: https://project-page.example
importance: 7
category: work
github: yunjinli/repo-name
selected: true
---
```

- `selected: true` includes the project in the homepage's initial view.
- All projects expands the remaining projects in place.
- Lower `importance` values sort first.
- `redirect` links to an external project page; omit it to use the project's
  generated page and Markdown body.
- `github` accepts an owner/repository pair or a complete URL.

## Google Scholar citation counts

`_plugins/scholar-profile.rb` reads the configured public Scholar profile once
per build, reusing successful responses for 24 hours. After failures, requests
are throttled for an hour. Each paper is matched by title, including aliases
for renamed papers such as SADG / TRASE. Cached values survive failed requests.

`_data/scholar_citations.yml` holds verified fallback values keyed by BibTeX ID.
For a new publication, add its Scholar title under `titles`. When supplying a
verified snapshot, fill in `citations` (an integer), `article_id` (the part after
the colon in Scholar's `citation_for_view` URL), and a quoted ISO 8601
`checked_at` timestamp. Leave unknown counts blank, never zero. Newer verified
snapshots take precedence over older cached responses.

The citation link renders as Cited by N when a count is known, with its date in
the tooltip; otherwise it links to a Google Scholar search for that paper.
These are build-time snapshots, not live browser requests. The existing
`enable_publication_badges.google_scholar` setting enables this feature.

Run the parser and cache checks with
`bundle exec ruby tests/scholar_profile_test.rb`.

## Other configuration

- `cv_url`: CV destination in navigation.
- `github_username`, `scholar_userid`, `linkedin_username`, and `email`:
  homepage profile and contact links.
- `enable_darkmode`: theme switch; `assets/js/theme.js` retains the existing
  time-of-day default and remembered visitor preference.
- `max_author_limit` and `scholar.style`: bibliography rendering.
- `footer_text`: footer on archive and article pages; homepage credits live in
  `_includes/portfolio-footer.liquid`.
- `last_updated` and `impressum_path`: optional footer information.

## Preview and verification

```sh
bundle exec jekyll serve --host 0.0.0.0 --port 4321 --livereload
```

Open `http://localhost:4321/`. For a build alone, run
`bundle exec jekyll build`. Check JavaScript syntax with
`node --check assets/js/portfolio.js`.

For visual and interaction checks, use installed headless Chrome with raw CDP
and Python's `websockets` and `requests` packages. Check desktop and mobile
layouts, photo placement, section navigation, publication controls, dark mode,
reduced motion, video previews, and content visibility without JavaScript.
Keep preview screenshots outside the repository and stop temporary browser
processes after checking.

## Deployment

The default branch is `master`; pushes build and publish to `gh-pages`.
`Deploy site` installs ImageMagick explicitly and uses `Gemfile.lock` and
`package-lock.json` for reproducible tools. Animated GIFs stay in their original
format; responsive WebP sources are emitted only for configured input formats.

Before deployment, CI runs the citation tests, builds with `JEKYLL_ENV=production`,
purges CSS, and checks local links and image sources in the generated HTML.
The follow-up site link workflow downloads this exact build artifact rather
than rebuilding a potentially different revision. Deployment runs are serialized.
CSS used by scroll animations and other dynamic states is retained during purging.
The stylesheet cache key includes `_sass` and `assets/css/main.scss`, so returning
visitors receive style changes. `bundle exec ruby tests/cache_bust_test.rb` checks it.

The source link check covers the maintained README, this guide, biography, news,
and project content. Archived upstream theme documentation and excluded sample
pages are reference material; Liquid routes are checked in the rendered site.

Run `npm ci` and `npm run format:check` before pushing. Use `npm run format`
to apply the pinned formatter, and `npm run css:purge` after a production build
to reproduce the CSS step. Both `_sass` and bibliography/plugin changes trigger
deployment, even without changes to a page.
