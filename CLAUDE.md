# Website maintenance guide

This repository is Jim's academic website: Jekyll with a custom portfolio
homepage on the al-folio theme. This guide describes the maintained site;
`README_Orig.md`, `INSTALL.md`, `CUSTOMIZE.md`, `FAQ.md` and `CONTRIBUTING.md`
are inherited theme references. Start with the [edit map in README.md](README.md).

## Homepage content and settings

Edit `_pages/about.md` for the biography (Markdown below the closing `---`)
and these front matter fields:

| Field                                                       | Purpose                                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `eyebrow`                                                   | Short research tagline above the name                                                           |
| `profile.image`                                             | Portrait filename inside `assets/img/`                                                          |
| `profile.alt`                                               | Accessible description of the portrait                                                          |
| `profile.caption`                                           | Role and affiliation below the portrait                                                         |
| `news`, `selected_papers`, `projects`                       | Show or hide the corresponding section; Research and Projects navigation follows these switches |
| `contact.eyebrow`, `contact.heading`, `contact.description` | Student and collaborator contact copy, as plain text                                            |
| `contact.topics_url`                                        | Open research topics destination; omit to hide this link                                        |

Keep `layout: about`, `permalink: /` and `portfolio: true` for the homepage.
YAML indentation matters. Use `>-` for multiline plain text, following the
existing contact description. The biography supports Markdown links and emphasis.

Edit `_config.yml` for:

- `first_name`, `middle_name`, `last_name`: displayed name. The main heading
  emphasizes the first and last names; the navigation uses those two only.
- `email`, `github_username`, `scholar_userid`, `linkedin_username`: contact
  and profile links. Use the profile ID/username, not the full URL.
- `cv_url`: CV destination; leave blank to hide the navigation link.
- `description`: site description for search and link metadata.
- `announcements.enabled` and `announcements.limit`: show news and set the
  number of items visible before expanding.
- `enable_publication_badges.google_scholar`: show Scholar links and counts.
- `enable_darkmode`: show the theme switch. The existing theme script remembers
  visitor preferences and uses a time-of-day default.
- `scholar.first_name` and `scholar.last_name`: author names to highlight in
  publications. These match the BibTeX author, independently of the display name.
- `max_author_limit` and `scholar.style`: bibliography presentation.
- `icon`: favicon filename in `assets/img/` (currently `favicon.svg`).
- `last_updated`, `impressum_path`: optional footer information.
- `footer_text`: footer copy on article/archive pages. Homepage credits use
  `_includes/portfolio-footer.liquid`.

Affiliation logos come from `_data/affiliations.yml`, in file order. Each item
has `name` (also the image description), `url`, `logo` (asset path) and `height`
in pixels. `wide: true` allows a wider logo, as used for MCML. To add or change
an affiliation, edit this list and put any new logo in `assets/img/`.

## Adding a publication

Add an entry with a unique BibTeX key to `_bibliography/papers.bib`:

```bibtex
@article{lastname2026key,
  title={Paper Title},
  author={Last, First and Other, Author},
  journal={Venue Name},
  year={2026},
  abstract={A short description of the paper.},
  selected={true},
  html={https://example.com/project/},
  preview={paper-preview.gif},
  google_scholar={https://scholar.google.com/citations?view_op=view_citation&user=PROFILE_ID&citation_for_view=PROFILE_ID:ARTICLE_ID},
  github={owner/repository},
  hf-dataset={https://huggingface.co/datasets/owner/dataset}
}
```

Replace the example values; omit fields you do not need. In particular, paste
the actual Scholar article URL rather than the placeholder IDs above.

| Optional field       | Effect                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selected={true}`    | Show in the initial Selected research list                                                                               |
| `html`               | Project button and clickable paper title                                                                                 |
| `preview`            | Image filename in `assets/img/publication_preview/`, or a full URL                                                       |
| `abstract`           | Expandable Abs button                                                                                                    |
| `google_scholar`     | Full Google Scholar article URL for both the citation link and automatic count matching                                  |
| `google_scholar_id`  | Alternative: article ID only, paired with `_config.yml`'s `scholar_userid`; a full `google_scholar` URL takes precedence |
| `github`             | `owner/repository` or `https://github.com/owner/repository`, without a trailing slash                                    |
| `hf-dataset`         | `owner/dataset` or `https://huggingface.co/datasets/owner/dataset`, without a trailing slash                             |
| `arxiv`              | arXiv identifier, without a URL prefix                                                                                   |
| `pdf`                | Filename in `assets/pdf/`, or a full URL                                                                                 |
| `bibtex_show={true}` | Show the Bib button                                                                                                      |

All publications expands the full bibliography in place. There is no separate
publication list to maintain. Website-only fields are hidden from the displayed
BibTeX by `filtered_bibtex_keywords` in `_config.yml`.

### Citation links and automatic updates

Open your Google Scholar profile, click a paper's title, and copy the article
page URL into that entry's `google_scholar` field. It must include
`citation_for_view=PROFILE_ID:ARTICLE_ID`. A profile URL or a Cited by results
URL does not identify the paper for this integration.

`_plugins/scholar-profile.rb` matches the stable article ID, so changing a
paper's title or BibTeX key does not require an alias or code update. BibTeX is
the source of publication references; fetched counts live in the build cache.
There is no separate per-paper YAML mapping or manually maintained count.

The plugin requests each referenced author profile as needed, reusing successful
snapshots for 24 hours and throttling failed attempts for one hour. With
`SEARCHAPI_API_KEY` present, it uses
[SearchApi's Google Scholar Author API](https://www.searchapi.io/docs/google-scholar-author).
SearchApi (`searchapi.io`) is different from SerpApi. Without the key, local
builds try Scholar directly, which may be blocked; this does not stop the build.

- A known count renders as **Cited by N**, with its check date in the tooltip.
- A missing count leaves a working link to the configured Scholar article.
- A missing or invalid article reference falls back to a title search, without
  fetching a count. Unknown counts are never presented as zero.
- Failed refreshes retain the last successful snapshot when available. A cold
  cache has no count until a fetch succeeds. Clearing the Jekyll cache or
  changing `_config.yml` can invalidate the local snapshot.

Counts are build-time snapshots. The daily deployment at **04:23 UTC** refreshes
eligible snapshots; visits to the website do not make SearchApi requests.
GitHub may delay scheduled runs. To request a rebuild after changing content or
credentials, use Actions → Deploy site → Run workflow on `master`; fresh
snapshots still obey the 24-hour cache window.

Set the secret under repository Settings → Secrets and variables → Actions,
using the exact name `SEARCHAPI_API_KEY`. Never put it in BibTeX, `_config.yml`,
JavaScript, docs or committed files. A local API key is optional and unnecessary
for ordinary content edits.

CI supplies the secret only during production builds for pushes, scheduled and
manual runs, never pull requests. Requests use a Bearer header. Only article
IDs, counts and check timestamps are cached. CI restores/saves the parsed
Scholar cache between deployments and verifies the key is absent from generated
files before publishing. Pull requests do not restore or save that cache.

### GitHub stars and Hugging Face downloads

The browser reads these public APIs via `assets/js/portfolio.js`:

- `github` adds a GitHub button that shows repository stars when available.
  Counts are cached for one hour in session storage. A failed fetch leaves a
  working GitHub link.
- `hf-dataset` adds a button with the local official Hugging Face icon
  (`assets/img/huggingface.svg`). The request uses `downloadsAllTime`, not the
  monthly `downloads` field. Counts are cached for one hour in session storage;
  failures retain a cached total or leave a working Dataset link. No key is needed.

These browser metrics update independently of the daily citation rebuild.
Without JavaScript, the buttons still link to their destinations.

## Adding news

Create a file in `_news/` with a unique name, for example `announcement_8.md`:

```yaml
---
layout: post
date: 2026-10-04 12:00:00+0200
inline: true
related_posts: false
---
Short announcement text, with Markdown links and emoji if desired.
```

`inline: true` displays the announcement body in the list. Otherwise add a
`title` and write the body as a separate post. The homepage shows the newest
items first, using `announcements.limit`; All news expands the complete list.

## Adding a project

Create a uniquely named Markdown file in `_projects/`:

```yaml
---
layout: page
title: Project Title
description: One-line description
img: assets/img/project-preview.gif
# Alternatively: video: assets/video/demo.mp4
redirect: https://example.com/project/
importance: 7
category: work
github: owner/repository
selected: true
---
Project description, if using an internal project page.
```

- `selected: true` shows the project initially; All projects reveals the rest.
- Lower `importance` values sort first.
- Use `img` or `video` for the preview, with a real asset path.
- `redirect` links to an external page. Omit it to use the generated project
  page and Markdown body.
- `github` accepts an owner/repository pair or a full URL; omit if unavailable.

## Preview and validation

Run commands from the repository root. CI uses Ruby **3.2.3**, Node.js **22**,
Bundler and ImageMagick (`convert`). Install those tools, then:

```sh
bundle install
npm ci
npm run dev
```

Open <http://localhost:4321/>. The preview reloads content edits. Restart it after
editing `_config.yml`, Ruby plugins or dependencies. Stop it with Ctrl+C.
Notebook pages also require Python 3 and `nbconvert`; CI installs
`nbconvert==7.17.1`. Install that version in your Python environment if working
with notebook content. Keep generated output and preview screenshots out of Git.

Before pushing, run:

```sh
npm run format:check
npm test
npm run build
```

`npm run format` applies the pinned formatter if needed. `npm test` checks
homepage JavaScript syntax, citation identity/cache/failure behavior, API key
handling and stylesheet cache invalidation. `npm run build` makes the production
site in `_site/` and purges unused CSS, using the same command as deployment.
For a different destination, run:

```sh
JEKYLL_ENV=production bundle exec jekyll build --lsi --destination /tmp/jim-site
npm run css:purge -- /tmp/jim-site
```

CI also checks generated links and image paths with the pinned Lychee version
in `bin/install-lychee.sh`. If Lychee is installed locally:

```sh
lychee --offline --root-dir "$PWD/_site" --no-progress '_site/**/*.html'
```

After visual changes, inspect desktop and mobile layouts, light/dark themes,
list expansion, abstracts, keyboard navigation, reduced motion and visibility
without JavaScript. Keep preview screenshots outside the repository and stop
temporary browser processes after checking.

## Publishing and troubleshooting

The default branch is **`master`**. Push changes there to trigger deployment, or
open a pull request for CI validation. The Deploy site workflow installs the
locked Ruby/Node dependencies and ImageMagick, runs tests, builds the site,
checks local links/assets, and publishes to `gh-pages` after those checks pass.
Scheduled and manual runs use the same path. Deployment runs are serialized.

The follow-up site link workflow checks the exact uploaded production artifact;
it does not rebuild a different revision. Source link checks cover the maintained
README, this guide, biography, news and projects. Inherited theme docs and excluded
sample pages are reference material.

| Symptom                          | Where to look                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edits missing from the live site | Actions → Deploy site for your commit, then the Pages deployment; confirm the commit was pushed to `master`                                                         |
| Formatting check fails           | Run `npm run format`, review and commit the result                                                                                                                  |
| Build fails after a content edit | Check YAML indentation, BibTeX braces/commas, duplicate BibTeX keys and preview file paths                                                                          |
| Citation count missing           | Confirm the article URL has `citation_for_view`, inspect the Google Scholar build log, and check the secret name/account quota; cached failures retry after an hour |
| Old citation count remains       | Check the badge tooltip date and last successful daily run; cached counts intentionally survive fetch failures                                                      |
| Dataset or star count missing    | Confirm the public dataset/repo identifier; browser API limits or blocked requests leave the link usable                                                            |
| New styles missing               | Run a production build as well as preview; dynamic classes may need the safelist in `purgecss.config.js`                                                            |

## Code map for layout changes

Routine content edits use the files above. Presentation changes use:

- `_layouts/about.liquid`: homepage structure, rendering biography, portrait,
  affiliations, research, projects and contact content.
- `_includes/portfolio-header.liquid`, `_includes/portfolio-footer.liquid`:
  navigation and homepage footer.
- `_layouts/bib.liquid` and `_includes/publication-citations.liquid`:
  publication cards, controls and citation badge.
- `_includes/portfolio-projects.liquid`: project cards.
- `_sass/_portfolio.scss`: scoped styles, responsive layout and motion.
- `assets/js/portfolio.js`: navigation, inline expansion, abstract toggles,
  scroll entrances, public API badges and video previews.
- `_plugins/scholar-profile.rb`: Scholar reference parsing, API fetch and cache.
- `_plugins/cache-bust.rb`: asset cache keys, including Sass source changes.
- `.github/workflows/deploy.yml`: daily schedule, validation and deployment.

All news / All publications / All projects expand inline and show only when
there are additional items. Without JavaScript, complete lists remain visible.
The hashes `#all-news`, `#all-publications` and `#all-projects` open full lists;
the old archive routes redirect to them through `_layouts/portfolio-redirect.liquid`.

Cards fade upward on entering the viewport and replay after leaving it fully.
Reduced motion, keyboard focus and no-JS viewing keep content accessible.
Hover video previews respect reduced motion; touch users retain native controls.
Animated GIFs retain their original format; responsive WebP variants are emitted
only for configured image formats. Keep these behaviors when changing the layout.

`portfolio: true` selects the homepage navigation, footer, styles and script.
`_sass/_terminal.scss` and `assets/js/fetch-terminal.js` are legacy sources and
are not loaded by the current homepage.
