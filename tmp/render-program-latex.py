import re,json,html,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
src=(ROOT/'tmp/build-program-fungsi.py').read_text(encoding='utf8')
prof=json.loads((ROOT/'tmp/attendance-source.json').read_text(encoding='utf8'))['profile'][0]
transformasi='--transformasi' in sys.argv
extra='barisan' if '--barisan' in sys.argv else ('lingkaran' if '--lingkaran' in sys.argv else None)
teacher='Nurmadinah, S.Pd.' if transformasi else 'Imran, S.Si.'
teacher_nip='199402222020122022' if transformasi else '199309082019031013'
material='Transformasi Fungsi' if transformasi else 'Fungsi'
if extra:material='Barisan dan Deret' if extra=='barisan' else 'Lingkaran'
target=ROOT/('tmp/pdfs/transformasi-latex' if transformasi else 'tmp/pdfs/fungsi-latex');target.mkdir(parents=True,exist_ok=True)
if extra:target=ROOT/('tmp/pdfs/'+extra+'-latex');target.mkdir(parents=True,exist_ok=True)
shutil.copyfile(ROOT/'tmp/logo-sekolah.png',target/'logo.png')

# Explicit LaTeX markup for every mathematical expression in the source.
equations={}
def eq(text,tex=None):equations[text]=tex if tex is not None else text
for text,tex in [
 ('P(n) = 160(3/4)ⁿ',r'P(n)=160\left(\frac{3}{4}\right)^n'),
 ('Q(n) = 160(3/4)ⁿ⁺¹',r'Q(n)=160\left(\frac{3}{4}\right)^{n+1}'),
 ('P(n) = 80(1/2)ⁿ',r'P(n)=80\left(\frac{1}{2}\right)^n'),
 ('E(n) = 160(0,75)ⁿ',r'E(n)=160(0{,}75)^n'),
 ('3[(x + 6)/3] - 6 = x',r'3\left[\frac{x+6}{3}\right]-6=x'),
 ('2[(x - 5)/2] + 5 = x',r'2\left[\frac{x-5}{2}\right]+5=x'),
 ('f(f⁻¹(x)) = 4[(x + 8)/4] - 8 = x',r'f\bigl(f^{-1}(x)\bigr)=4\left[\frac{x+8}{4}\right]-8=x'),
 ('f⁻¹(x) = (x + 6)/3',r'f^{-1}(x)=\frac{x+6}{3}'),
 ('f⁻¹(x) = (x - 5)/2',r'f^{-1}(x)=\frac{x-5}{2}'),
 ('f⁻¹(x) = (x + 8)/4',r'f^{-1}(x)=\frac{x+8}{4}'),
 ('A⁻¹(y) = (y + 20.000)/0,8',r'A^{-1}(y)=\frac{y+20\,000}{0{,}8}'),
 ('B⁻¹(y) = (y + 16.000)/0,8',r'B^{-1}(y)=\frac{y+16\,000}{0{,}8}'),
 ('y = 3x - 6 → x = (y + 6)/3',r'y=3x-6\;\Longrightarrow\;x=\frac{y+6}{3}'),
 ('g(f(x)) = (2x + 1)² = 4x² + 4x + 1',r'g\bigl(f(x)\bigr)=(2x+1)^2=4x^2+4x+1'),
 ('f(g(x)) = 2x² + 1',r'f\bigl(g(x)\bigr)=2x^2+1'),
 ('x → f(x) → g(f(x))',r'x\;\longmapsto\;f(x)\;\longmapsto\;g\bigl(f(x)\bigr)'),
 ('x → x + 2 → 3(x + 2)',r'x\;\longmapsto\;x+2\;\longmapsto\;3(x+2)'),
 ('4 → f(4) = 3 → g(3) = 9',r'4\;\longmapsto\;f(4)=3\;\longmapsto\;g(3)=9'),
 ('P(2) = 90 ≥ 80',r'P(2)=90\geq80'),('P(3) = 67,5 < 80',r'P(3)=67{,}5<80'),
 ('Q(n) = P(n + 1) = 0,75P(n)',r'Q(n)=P(n+1)=0{,}75P(n)'),
 ('Q(n) = 0,75P(n)',r'Q(n)=0{,}75P(n)'),
 ('B(x) - A(x) = 4.000',r'B(x)-A(x)=4\,000'),
 ('q(-2) = q(2) = 4',r'q(-2)=q(2)=4'),
 ('q⁻¹(x) = √x',r'q^{-1}(x)=\sqrt{x}'),
 ('(g ∘ f)(x)',r'(g\circ f)(x)'),('(f ∘ g)(x)',r'(f\circ g)(x)'),
 ('f(f⁻¹(x))',r'f\bigl(f^{-1}(x)\bigr)'),
 ('f⁻¹(x)',r'f^{-1}(x)'),('A⁻¹(y)',r'A^{-1}(y)'),('B⁻¹(y)',r'B^{-1}(y)'),
 ('f⁻¹',r'f^{-1}'),('√x',r'\sqrt{x}'),('1/2',r'\frac{1}{2}'),('∘',r'\circ'),
 ('(x,y)',r'(x,y)'),('(y,x)',r'(y,x)'),
 ('g(f(4)) = 9',r'g\bigl(f(4)\bigr)=9'),('f(g(4)) = 14',r'f\bigl(g(4)\bigr)=14'),
 ]:eq(text,tex)

for v in [
 'C(t) = 5.000t + 10.000','f(x) = 2x + 1','g(x) = x²','f(x) = 3x - 6',
 'y = x²','y = (x - 2)² + 3','f(x) = 2x + 3','f(x) = x + 2','g(x) = 3x',
 'f(x) = 2x + 5','q(x) = x²','p(x) = x²','h(x) = (x + 1)² - 4',
 'C(n) = 4.000n + 6.000','f(x) = x - 1','g(x) = 2x + 3','f(x) = 4x - 8',
 'h(x) = -(x - 3)² + 2','D(x) = 0,8x','V(x) = x - 20.000',
 'A(x) = V(D(x))','B(x) = D(V(x))','S(n) = 20.000 + 5.000n',
 'f(-1) = 1','f(0) = 3','f(1) = 5','g(f(x)) = 3x + 6',
 'h(-2) = -3','h(-1) = -4','h(0) = -3','g(f(x)) = 2x + 1','f(g(x)) = 2x + 2',
 'h(2) = 1','h(3) = 2','h(4) = 1','E(2) = 90','A(x) = 0,8x - 20.000','B(x) = 0,8x - 16.000',
 'x ≥ 25.000','x ≥ 0','y ≥ 0','y ≥ 4.000','x = 100.000','x = -1, 0, 1','x = 4',
 'n = 0, 1, 2, 3','n = 0, 1, 2, ...','n = 1, 2, 3','t = 1, 2, 3','n = 3',
 '(-1, -4)','(2, 3)','(3, 2)',
 'C(2)','C(3)','S(n)','S(4)','E(n)','P(n)','Q(n)','P(0)','P(1)','P(2)','P(3)',
 'h(-2)','h(-1)','h(0)','h(2)','h(3)','h(4)','f(g(4))','g(f(4))','g(f(x))','f(g(x))',
 ]:
 tex=v.replace('²','^2').replace('≥',r'\geq ').replace('... ',r'\ldots ')
 tex=re.sub(r'(\d)\.(?=\d{3}(?:\D|$))',r'\1\\,',tex)
 tex=re.sub(r'(\d),(\d)',r'\1{,}\2',tex)
 tex=tex.replace('...',r'\ldots')
 eq(v,tex)

# Numeric sets stay in math mode, with braces rendered as set delimiters.
for v in ['{1, 2, 3}','{15.000, 20.000, 25.000}','{0, 1, 2, 3, 4}','{-1, 0, 1}','{1, 3, 5}','{10.000, 14.000, 18.000}','{0, 1, 2, 3}']:
 inner=re.sub(r'(\d)\.(?=\d{3}(?:\D|$))',r'\1\\,',v[1:-1]);eq(v,r'\{'+inner+r'\}')

pattern=re.compile('|'.join(re.escape(k) for k in sorted(equations,key=len,reverse=True)))
def escape(t):
 return ''.join({'\\':r'\textbackslash{}','&':r'\&','%':r'\%','$':r'\$','#':r'\#','_':r'\_','{':r'\{','}':r'\}','~':r'\textasciitilde{}','^':r'\textasciicircum{}'}.get(c,c) for c in str(t))
missed=[]
def fmt(t):
 t=str(t)
 if not t.strip():return r'\rule{0pt}{8mm}' if '\n' in t else ''
 if '$' in t:
  parts=re.split(r'(\$[^$]+\$)',t)
  return ''.join(r'\('+part[1:-1]+r'\)' if part.startswith('$') and part.endswith('$') else escape(part) for part in parts).replace('\n',r'\newline ')
 result=[];pos=0
 for m in pattern.finditer(t):
  plain=t[pos:m.start()]
  if re.search(r'[²ⁿ√∘→≥]|[A-Za-z]\([^)]*\)\s*=',plain):missed.append(plain)
  result.extend([escape(plain),r'\('+equations[m[0]]+r'\)']);pos=m.end()
 plain=t[pos:]
 if re.search(r'[²ⁿ√∘→≥]|[A-Za-z]\([^)]*\)\s*=',plain):missed.append(plain)
 result.append(escape(plain));return ''.join(result).replace('\n',r'\newline ')

story=[];mm=2.83464567;styles={'SmallID':None};pagecount=0
def para(t,style='BodyID'):
 f=fmt(t)
 if style=='CenterID':story.append(r'\begin{center}'+f+r'\end{center}')
 elif style=='SmallID':story.append(r'{\small '+f+r'\par}\medskip')
 else:story.append(f+r'\par\medskip')
def page(t):
 global pagecount
 if pagecount:story.append(r'\clearpage')
 if pagecount==0:
  t='PROGRAM REMEDIAL DAN PENGAYAAN\nMATEMATIKA FASE F KELAS XI - MATERI FUNGSI' if not transformasi else 'PROGRAM REMEDIAL DAN PENGAYAAN\nMATEMATIKA FASE F KELAS XI\nMATERI TRANSFORMASI FUNGSI'
  if extra:t='PROGRAM REMEDIAL DAN PENGAYAAN\nMATEMATIKA FASE F KELAS XI\nMATERI '+material.upper()
 heading=fmt(t).replace(r'\newline ',r'\\[2pt] ')
 pagecount+=1;story.append(r'\begin{center}\bfseries\large '+heading+r'\end{center}\medskip')
def sub(t):story.append(r'\par\medskip\noindent\textbf{'+fmt(t)+r'}\par\smallskip')
def table(head,rows,widths):
 # Widths include cell padding and rules within the same printable width.
 count=len(widths);columnsum=178-4*count-0.15*(count+1)
 spec='|'+'|'.join(r'>{\raggedright\arraybackslash}p{'+f'{columnsum*w/sum(widths):.3f}mm'+'}' for w in widths)+'|'
 story.append(r'{\small\setlength{\tabcolsep}{2mm}\renewcommand{\arraystretch}{1.35}\begin{longtable}{'+spec+'}\hline')
 if head:
  heading=' & '.join(r'\textbf{'+fmt(v)+'}' for v in head)+r'\\ \hline'
  story.extend([r'\rowcolor{gray!10}'+heading,r'\endfirsthead',r'\rowcolor{gray!10}'+heading,r'\endhead'])
 for row in rows:story.append(' & '.join(fmt(v) for v in row)+r'\\ \hline')
 story.append(r'\end{longtable}}\medskip')
def question(no,text,space=6):story.append(r'\noindent\textbf{'+escape(no)+r'.} '+fmt(text)+r'\par\vspace{'+str(space)+r'mm}')
def ident():para('Nama: __________________________________  Kelas: __________','SmallID')
def sig():
 story.append(r'\vspace{8mm}\noindent\begin{minipage}[t]{.61\linewidth}Mengetahui,\\Kepala Madrasah,\\[22mm]'+fmt(prof['kepala_sekolah_nama'])+r'\\NIP '+escape(prof['kepala_sekolah_nip'])+r'\end{minipage}\hfill\begin{minipage}[t]{.35\linewidth}Gowa, 13 Juli 2026\\Guru Mata Pelajaran,\\[22mm]\textbf{'+fmt(teacher)+r'}\\NIP '+teacher_nip+r'\end{minipage}')
def Spacer(a,b):return r'\vspace{'+str(b)+r'pt}'
def Paragraph(t,style):
 m=re.search(r'href="([^"]+)"',t)
 return r'\href{'+html.unescape(m[1])+r'}{\small\textcolor{blue}{Buka sumber resmi}}\par' if m else fmt(re.sub('<[^>]*>','',t))

if extra:
 exec((ROOT/'tmp/content-extra-matematika.py').read_text(encoding='utf8'))
elif transformasi:
 exec((ROOT/'tmp/content-transformasi.py').read_text(encoding='utf8'))
else:
 body=src[src.index("\npage('PROGRAM")+1:src.index('\nlogo=ImageReader')]
 exec(body)
if missed:raise ValueError('Unconverted mathematical notation: '+repr(missed))

preamble=r'''\documentclass[11pt,a4paper]{article}
\usepackage[margin=16mm,top=49mm,bottom=19mm,headheight=34mm,headsep=5mm]{geometry}
\usepackage{fontspec}
\setmainfont{Times New Roman}
\usepackage{amsmath,amssymb}
\usepackage{graphicx,array,longtable}
\usepackage[table]{xcolor}
\usepackage{fancyhdr}
\usepackage[hidelinks]{hyperref}
\hypersetup{pdftitle={Program Remedial dan Pengayaan Matematika Fase F XI - Fungsi},pdfauthor={Imran, S.Si.}}
\setlength{\parindent}{0pt}
\setlength{\LTpre}{3pt}\setlength{\LTpost}{4pt}
\setlength{\emergencystretch}{2em}
\linespread{1.08}
\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\fancyhead[C]{\begin{minipage}{\textwidth}
\noindent\begin{minipage}[c]{23mm}
\centering\includegraphics[width=20mm,height=23mm,keepaspectratio]{logo.png}
\end{minipage}%
\begin{minipage}[c]{132mm}\centering
{\fontsize{10.2}{12}\selectfont\bfseries KEMENTERIAN AGAMA REPUBLIK INDONESIA\\
KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA}\\[2pt]
{\fontsize{13}{15}\selectfont\bfseries MAN INSAN CENDEKIA GOWA}\\[2pt]
{\fontsize{8.3}{10.5}\selectfont
\mbox{Jl. Pendidikan Desa Belapunrangan, Kec. Parangloe, Gowa, Sulawesi Selatan 92173}\\
\mbox{Telp. 085173279846 $\cdot$ Pos-el: insancendekiagowa@gmail.com $\cdot$ Laman: icgowa.sch.id}}
\end{minipage}%
\begin{minipage}[c]{23mm}\strut\end{minipage}
\par\vspace{2mm}\hrule height1.2pt\vspace{1.2pt}\hrule height.4pt
\end{minipage}}
\fancyfoot[L]{\fontsize{8}{10}\selectfont Program Remedial dan Pengayaan Matematika $|$ Imran, S.Si.}
\fancyfoot[R]{\fontsize{8}{10}\selectfont\thepage}
\begin{document}
'''
preamble=preamble.replace('pdfauthor={Imran, S.Si.}', 'pdfauthor={'+teacher+'}').replace('Matematika $|$ Imran, S.Si.','Matematika $|$ '+teacher)
if transformasi:preamble=preamble.replace('Fase F XI - Fungsi','Fase F XI - Transformasi Fungsi')
if extra:preamble=preamble.replace('Fase F XI - Fungsi','Fase F XI - '+material)
(target/'main.tex').write_text(preamble+'\n'.join(story)+'\n\\end{document}\n',encoding='utf8')
print('LaTeX source:',target/'main.tex');print('Equation patterns:',len(equations))
