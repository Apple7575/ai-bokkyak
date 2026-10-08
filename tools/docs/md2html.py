# docs/*.md → 혼자 열리는 HTML 한 장. 사용: python tools/docs/md2html.py in.md out.html "제목"
import re, sys, html

src = open(sys.argv[1], encoding="utf-8").read().split("\n")
title = sys.argv[3] if len(sys.argv) > 3 else "문서"
out = []

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(https?://[^\s<)]+)", r'<a href="\1">\1</a>', s)
    s = s.replace("☐", '<span class="box">☐</span>').replace("☑", '<span class="box done">☑</span>')
    return s

i = 0; in_table = False; in_list = None; in_code = False; header = True
while i < len(src):
    line = src[i]
    if line.startswith("```"):
        out.append("</pre>" if in_code else "<pre>"); in_code = not in_code; i += 1; continue
    if in_code:
        out.append(html.escape(line, quote=False)); i += 1; continue
    if line.startswith("|"):
        if not in_table:
            out.append('<div class="tablewrap"><table>'); in_table = True; header = True
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r"-+", c) for c in cells):
            i += 1; continue
        tag = "th" if header else "td"
        out.append("<tr>" + "".join(f"<{tag}>{inline(c)}</{tag}>" for c in cells) + "</tr>")
        header = False; i += 1; continue
    elif in_table:
        out.append("</table></div>"); in_table = False
    m = re.match(r"^(#{1,4}) (.*)", line)
    if m:
        if in_list: out.append(f"</{in_list}>"); in_list = None
        lvl = len(m.group(1)); out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>"); i += 1; continue
    m = re.match(r"^(\d+)\. (.*)", line)
    if m:
        if in_list != "ol":
            if in_list: out.append(f"</{in_list}>")
            out.append("<ol>"); in_list = "ol"
        out.append(f"<li>{inline(m.group(2))}</li>"); i += 1; continue
    m = re.match(r"^- (.*)", line)
    if m:
        if in_list != "ul":
            if in_list: out.append(f"</{in_list}>")
            out.append("<ul>"); in_list = "ul"
        out.append(f"<li>{inline(m.group(1))}</li>"); i += 1; continue
    if in_list and line.strip() == "":
        out.append(f"</{in_list}>"); in_list = None; i += 1; continue
    if line.strip():
        out.append(f"<p>{inline(line)}</p>")
    i += 1
if in_table: out.append("</table></div>")
if in_list: out.append(f"</{in_list}>")

body = "\n".join(out)
page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Gowun+Batang:wght@700&display=swap">
<style>
:root{{--bg:#F6F8F7;--paper:#FFFFFF;--ink:#1D2A2E;--ink2:#4C5B61;--ink3:#7C8A90;--line:#DBE2E1;--accent:#2C6E8A;--accent-soft:#E3EEF3;--code:#EEF2F1;--warn:#C9612F;--ok:#1F7A5C}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#141A1C;--paper:#1C2426;--ink:#E8ECEA;--ink2:#B4BEC1;--ink3:#7F8B8F;--line:#2E3A3D;--accent:#7FB6CF;--accent-soft:#223842;--code:#242E31;--warn:#E8946B;--ok:#5FBF9A;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#141A1C;--paper:#1C2426;--ink:#E8ECEA;--ink2:#B4BEC1;--ink3:#7F8B8F;--line:#2E3A3D;--accent:#7FB6CF;--accent-soft:#223842;--code:#242E31;--warn:#E8946B;--ok:#5FBF9A;color-scheme:dark}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans KR","Pretendard","Malgun Gothic",sans-serif;font-size:16px;line-height:1.7}}
main{{max-width:1040px;margin:0 auto;padding:40px 24px 96px}}
h1{{font-family:"Gowun Batang",serif;font-size:32px;margin:0 0 8px;text-wrap:balance}}
h2{{font-family:"Gowun Batang",serif;font-size:24px;margin:48px 0 12px;padding-top:20px;border-top:1px solid var(--line)}}
h3{{font-size:19px;margin:28px 0 8px}}
h4{{font-size:16px;margin:22px 0 6px;color:var(--accent)}}
p{{margin:0 0 12px;max-width:80ch}} a{{color:var(--accent)}}
code{{font-family:Consolas,Menlo,monospace;font-size:13.5px;background:var(--code);padding:1px 5px;border-radius:4px}}
pre{{font-family:"Noto Sans KR",Consolas,monospace;font-size:14.5px;background:var(--code);padding:12px 14px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;border-left:4px solid var(--accent)}}
.tablewrap{{overflow-x:auto;border:1px solid var(--line);border-radius:8px;margin:10px 0 18px;background:var(--paper)}}
table{{border-collapse:collapse;width:100%;font-size:14px}}
th,td{{padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}}
th{{background:var(--code);font-weight:700;white-space:nowrap}}
tr:last-child td{{border-bottom:0}}
.box{{color:var(--accent);font-size:18px}} .box.done{{color:var(--ok)}}
ul,ol{{padding-left:22px;max-width:80ch}} li{{margin-bottom:6px}}
</style></head><body>
<main>
{body}
</main>
</body></html>
"""
open(sys.argv[2], "w", encoding="utf-8").write(page)
print("html ok", len(page))
