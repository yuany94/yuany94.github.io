# Yuan Yuan — personal website

Static personal research website at https://www.yuan-yy.com/, hosted with GitHub Pages.

## Edit

- `index.html`: profile, research interests, background, and contact information.
- `data/publications.json`: bibliography, organized by research venue and context.
- `css/site.css`: responsive layout and visual style.
- `public/og.png`: social preview card.

After editing publication data, run `python3 scripts/update_publications.py` and include the resulting `index.html` change. The rendered bibliography works without JavaScript or a build step on GitHub Pages.

Each publication's `url` should point to its official publisher or report page when available. Include that destination as a clearly labeled link in `links`, followed by any PDF, preprint, or alternate-version links. Working papers use their SSRN or arXiv record until an official publication is available.

Publication categories use a native accordion: only one category is open at a time. The main publication heading always remains visible. `scripts/publications.js` opens categories as readers reach them while scrolling, uses short height and opacity transitions, preserves the heading position when switching, and respects manual toggles and reduced-motion preferences. Without JavaScript, categories can still be opened manually.

To preview locally, run `python3 -m http.server 8765 --bind 127.0.0.1` and visit http://127.0.0.1:8765/.

The current homepage uses its own stylesheet and has no build dependencies. Obsolete CV PDFs, local manuscripts, legacy pages, and unused Bootstrap theme assets have been removed. Paper links point to publishers or public preprint repositories.

## Publishing

GitHub Pages publishes the `master` branch to the custom domain in `CNAME`. Preview changes locally before publishing. After deployment, verify the homepage, local assets, and retired document URLs.

Removing a file from the current site makes its live URL unavailable after deployment. It does not erase older Git commits, third-party forks, caches, or downloaded copies.

## Credits

The original site was based on Start Bootstrap Resume, distributed under the MIT license. See `LICENSE`.
