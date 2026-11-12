import openpyxl, datetime, json, sys, re, collections
src = sys.argv[1]; out = sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)
ws = wb['INPUT HERE Planning 2027']
rows = list(ws.iter_rows(values_only=True))
H = rows[0]
def col(name, nth=0):
    idx = [i for i,h in enumerate(H) if isinstance(h,str) and h.strip().lower().startswith(name.lower())]
    return idx[nth]
C = dict(
  new=col('New / Old'), name=col('Name'), web=col('Website'), start=col('Start'), end=col('End'),
  region=col('Region'), country=col('Country'), loc=col('Location'), type=col('Type of Event'), focus=col('Focus'),
  tierPrev=col('TIER To Date'), avg=col("Avg. Ragting"), std=col("Std. Dev"), med=col("Median '27"), tier=col("TIER '27"),
  hist=col('Plan /Activity in 2026'), aud=col('Audience Size'), cost=col('Cost Attending'), spons=col('Cost Sponsorship'),
  notes=col('Notes'), comment=col('COMMENTS URAITZ'))
C['size'] = C['aud']+1
rr = [col('Re-rated: Crypto HNWIs'), col('Re-rated: TradFi'), col('Re-rated: FO'), col('Re-rated: Crypto treasury'), col('Re-rated: Funds')]
raters = list(range(col('Andrej'), col('???')+1))
print('raters', [H[i] for i in raters], file=sys.stderr)
print('cols', C, rr, file=sys.stderr)

def s(v):
    if v is None: return None
    if isinstance(v, float):
        return v
    t = str(v).strip()
    return t or None
EMAIL=re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE=re.compile(r"\+\d[\d\s()/-]{7,}\d")
def clean(t):
    if not isinstance(t,str): return t
    t=EMAIL.sub("[contact in masterlist]",t); t=PHONE.sub("",t)
    return re.sub(r"\s+,", ",", re.sub(r"\s{2,}"," ",t)).strip(" ,")
def num(v):
    try: return round(float(v),2)
    except: return None

events=[]; section=None; suggestions=[]
for r in rows[1:]:
    name = s(r[C['name']])
    if not name:
        if r[C['new']]: section = str(r[C['new']]).strip()
        continue
    if name.startswith('I am missing'):
        suggestions.append(name); continue
    st, en = r[C['start']], r[C['end']]
    datemode='exact'; label=None
    manual = name=='Web Summit Conference' or name.startswith('Prestel') or name in ('European Single Family Office Symposium','Nordic Fund Selection Forum','CFO Nordic')
    if section=='TBD' and not manual:
        datemode='tbd'; st=en=None
    elif isinstance(st, datetime.datetime) and st.year>=2026 and not manual:
        if st==en and st.day==2: datemode='month'
    else:
        # manual fixes for free-text dates
        if name=='Web Summit Conference': st,en=datetime.datetime(2026,11,9),datetime.datetime(2026,11,12)
        elif name.startswith('Prestel'): st,en=datetime.datetime(2027,7,1),datetime.datetime(2027,7,2)
        elif name=='European Single Family Office Symposium': st=en=datetime.datetime(2027,6,2); datemode='month'; label='usually June'
        elif name=='Nordic Fund Selection Forum': st=en=datetime.datetime(2027,4,2); datemode='month'; label='usually April'
        elif name=='CFO Nordic': st=en=datetime.datetime(2027,4,2); datemode='month'; label='April/May'
        else:
            print('UNHANDLED DATE', name, st, en, file=sys.stderr); datemode='tbd'; st=en=None
    if isinstance(en, datetime.datetime) and isinstance(st, datetime.datetime) and (en<st or (en-st).days>21): en=st
    dist=[0]*5; n=0
    for i in raters:
        v=r[i]
        if isinstance(v,(int,float)) and 1<=v<=5:
            dist[int(round(v))-1]+=1; n+=1
    tier = r[C['tier']]
    tier = int(tier) if isinstance(tier,(int,float)) else None
    tp = r[C['tierPrev']]; tp = int(tp) if isinstance(tp,(int,float)) else None
    fit = [int(r[i]) if isinstance(r[i],(int,float)) else None for i in rr]
    reg = s(r[C['region']]) or 'TBA'
    cty = s(r[C['country']]) or 'TBA'
    if cty=='USA': cty='US'
    aud = r[C['aud']]
    if isinstance(aud,float): aud=int(aud)
    hist = s(r[C['hist']])
    if isinstance(hist,(int,float)): hist=str(int(hist))
    events.append(dict(
        n=name, nw=(str(r[C['new']]).strip().lower()=='new'), url=s(r[C['web']]),
        s=st.strftime('%Y-%m-%d') if st else None, e=en.strftime('%Y-%m-%d') if en else None, dm=datemode, dl=label,
        rg=reg, c=cty, l=s(r[C['loc']]), t=s(r[C['type']]), f=s(r[C['focus']]),
        tier=tier, tp=tp, avg=num(r[C['avg']]), sd=num(r[C['std']]), med=num(r[C['med']]), dist=dist, nr=n,
        h=clean(hist), a=clean(str(aud)) if aud is not None else None, sz=s(r[C['size']]), ca=clean(s(r[C['cost']])), cs=clean(s(r[C['spons']])),
        nt=clean(s(r[C['notes']])), cm=clean(s(r[C['comment']])), fit=fit))
for i,e in enumerate(events): e['id']=i+1
json.dump(dict(events=events, suggestions=suggestions), open(out,'w'), ensure_ascii=False)
print('events', len(events), 'suggestions', len(suggestions), file=sys.stderr)
print(collections.Counter(e['dm'] for e in events), file=sys.stderr)
print('no tier', [e['n'] for e in events if e['tier'] is None], file=sys.stderr)
print('fit none', sum(1 for e in events if None in e['fit']), file=sys.stderr)
print('sizes', collections.Counter(e['sz'] for e in events), file=sys.stderr)
