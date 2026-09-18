"""Render the bibliography into static HTML for GitHub Pages; no runtime JS required."""
from html import escape
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/publications.json').read_text())
lines=[]
for group in data:
    group_id=escape(group['id'], quote=True)
    lines.append(f'<details class="publication-group publication-disclosure" name="publications" id="{group_id}" aria-labelledby="{group_id}-title">')
    lines.append(f'<summary class="publication-summary"><h3 id="{group_id}-title">{escape(group["title"])}</h3><span class="publication-count">{len(group["papers"])}<span class="visually-hidden"> entries</span></span><span class="disclosure-icon" aria-hidden="true"></span></summary>')
    lines.append('<div class="publication-papers">')
    if group.get('note'):lines.append(f'<p class="group-note">{escape(group["note"])}</p>')
    for p in group['papers']:
        title=escape(p['title'])
        if p.get('url'):title=f'<a href="{escape(p["url"],quote=True)}">{title}</a>'
        authors=', '.join(escape(a).replace('Yuan Yuan', '<strong>Yuan Yuan</strong>') for a in p['authors'])
        lines.append(f'<article class="paper"><p class="paper-year">{escape(p["year"])}</p><div><h4>{title}</h4><p class="authors">{authors}</p><p class="venue">{escape(p["venue"])}</p>')
        if p.get('summary'):lines.append(f'<p class="paper-summary">{escape(p["summary"])}</p>')
        if p.get('links'):
            lines.append('<div class="paper-links">'+''.join(f'<a href="{escape(url,quote=True)}">{escape(label)} <span aria-hidden="true">↗</span></a>' for label,url in p['links'].items())+'</div>')
        lines.append('</div></article>')
    lines.append('</div></details>')
lines.append('<p class="pub-note">* Equal contribution. Conference versions are identified separately from their journal extensions.</p>')
path=ROOT/'index.html'
html=path.read_text()
start='<!-- PUBLICATIONS_START -->';end='<!-- PUBLICATIONS_END -->'
prefix,tail=html.split(start,1)
_,suffix=tail.split(end,1)
path.write_text(prefix+start+'\n'+'\n'.join(lines)+'\n'+end+suffix)
print(f'Rendered {sum(len(g["papers"]) for g in data)} entries in {len(data)} categories.')
