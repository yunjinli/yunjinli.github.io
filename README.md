# yunjinli.github.io

[Jim's academic website](https://yunjinli.github.io/), built with Jekyll and
[al-folio](https://github.com/alshedivat/al-folio). The homepage has a short bio,
research and project cards, and subtle scroll animations.

## Where to edit

| Change                                                                         | File                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Bio, research tagline, portrait, student contact text and research topics link | [`_pages/about.md`](_pages/about.md)                   |
| Name, email, profile links, CV, site description and settings                  | [`_config.yml`](_config.yml)                           |
| Affiliation logos and links                                                    | [`_data/affiliations.yml`](_data/affiliations.yml)     |
| Publications, abstracts, Scholar links, GitHub repos and HF datasets           | [`_bibliography/papers.bib`](_bibliography/papers.bib) |
| News                                                                           | New Markdown file in [`_news/`](_news/)                |
| Projects                                                                       | New Markdown file in [`_projects/`](_projects/)        |
| Colors, spacing and animations                                                 | [`_sass/_portfolio.scss`](_sass/_portfolio.scss)       |

Routine content updates do not require editing templates or JavaScript.
For copyable examples, field descriptions, metric updates and deployment
troubleshooting, see the [maintenance guide](CLAUDE.md).

## Preview and publish

With Ruby 3.2.3, Bundler, Node.js 22 and ImageMagick installed:

```sh
bundle install
npm ci
npm run dev
```

Open <http://localhost:4321/>. Restart the preview after changing `_config.yml`
or Ruby plugins. See the guide for the optional notebook dependency used by CI.

Before pushing:

```sh
npm run format:check
npm test
npm run build
```

Push to `master` to deploy. GitHub Actions also rebuilds daily at **04:23 UTC**
to refresh citation snapshots. The `SEARCHAPI_API_KEY` belongs only in the
repository's Actions secrets; publication links belong in BibTeX.
For an immediate citation refresh, use Actions → Deploy site → Run workflow.
Scheduled and manual runs request fresh counts even when the cache is recent.

[`README_Orig.md`](README_Orig.md) and the other inherited theme guides are
upstream reference material. Follow [CLAUDE.md](CLAUDE.md) for this site's setup.
