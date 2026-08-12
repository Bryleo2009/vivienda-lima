#!/usr/bin/env python3
"""Actualización diaria del dashboard.

- Verifica cambios en fuentes bancarias/inmobiliarias.
- Intenta descubrir publicaciones nuevas mediante JSON-LD estructurado.
- Nunca reemplaza reglas bancarias curadas por texto inferido automáticamente.
- Si un portal bloquea el acceso, conserva los datos válidos anteriores.
"""
from __future__ import annotations
import hashlib, json, pathlib, re
from datetime import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'dashboard.json'
STATE=ROOT/'data'/'source_state.json'
MARKET=ROOT/'data'/'market_sources.json'
HEADERS={'User-Agent':'Mozilla/5.0 (compatible; PlanCasaPersonal/1.0) AppleWebKit/537.36'}


def normalized_text(html:str)->str:
    text=BeautifulSoup(html,'html.parser').get_text(' ',strip=True)
    return re.sub(r'\s+',' ',text)


def text_hash(html:str)->str:
    return hashlib.sha256(normalized_text(html)[:250000].encode()).hexdigest()


def scalar(v):
    if isinstance(v,dict):
        return v.get('value') or v.get('name')
    return v


def number(v):
    v=scalar(v)
    if v is None:return None
    m=re.search(r'[\d.,]+',str(v))
    if not m:return None
    raw=m.group(0).replace(',','')
    try:return float(raw)
    except:return None


def walk(obj):
    if isinstance(obj,dict):
        yield obj
        for v in obj.values():yield from walk(v)
    elif isinstance(obj,list):
        for v in obj:yield from walk(v)


def infer_bedrooms(item,name):
    for k in ('numberOfBedrooms','numberOfRooms','numberOfBedroomsTotal'):
        if k in item:
            n=number(item[k])
            if n:return int(n)
    m=re.search(r'(\d+)\s*(?:dorm|habitacion)',name.lower())
    return int(m.group(1)) if m else None


def infer_price(item):
    offers=item.get('offers')
    if isinstance(offers,list): offers=offers[0] if offers else None
    if isinstance(offers,dict):
        for k in ('price','lowPrice'):
            n=number(offers.get(k))
            if n:return int(n)
    for k in ('price','lowPrice'):
        n=number(item.get(k))
        if n:return int(n)
    return None


def infer_area(item,name):
    for k in ('floorSize','area','size'):
        n=number(item.get(k))
        if n:return int(n)
    m=re.search(r'(\d{2,4})\s*m[²2]',name.lower())
    return int(m.group(1)) if m else None


def structured_candidates(html,base_url,source):
    soup=BeautifulSoup(html,'html.parser'); seen=set(); out=[]
    for tag in soup.find_all('script',{'type':'application/ld+json'}):
        try: payload=json.loads(tag.string or tag.get_text())
        except Exception: continue
        for item in walk(payload):
            typ=str(item.get('@type','')).lower()
            name=str(item.get('name') or item.get('headline') or '').strip()
            url=item.get('url')
            if not name or not url: continue
            if not any(x in typ for x in ('product','apartment','house','residence','offer','listitem')) and not re.search(r'(departamento|d[uú]plex|casa)',name,re.I):
                continue
            url=urljoin(base_url,str(url)); price=infer_price(item)
            beds=infer_bedrooms(item,name); area=infer_area(item,name)
            if not price or price<100000 or price>650000 or (beds is not None and beds<3): continue
            key=(url,price)
            if key in seen:continue
            seen.add(key)
            out.append({
                'title':name[:95], 'district':source['district'], 'category':source['category'],
                'type':'Auto detectado', 'price':price, 'bedrooms':beds or 3, 'area_m2':area or 0,
                'parking':False, 'multifamily':source['category']=='Casa', 'score':3,
                'why':'Detectado automáticamente. Verificar distribución, documentación, precio y vigencia antes de considerarlo.',
                'source':url, 'auto':True
            })
    return out[:8]


def fetch(url):
    r=requests.get(url,headers=HEADERS,timeout=25)
    r.raise_for_status(); return r


def main():
    data=json.loads(DATA.read_text(encoding='utf-8'))
    old=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    sources=data.get('sources',[])
    state={'checked_at':datetime.now().astimezone().isoformat(timespec='seconds'),'sources':{}}
    changed=[]
    for src in sources:
        url=src['url']; info={'ok':False,'status':None,'hash':None}
        try:
            r=fetch(url); info.update(ok=True,status=r.status_code,hash=text_hash(r.text))
            prev=old.get('sources',{}).get(url,{}).get('hash')
            if prev and prev!=info['hash']: changed.append(src['label'])
        except Exception as exc: info['error']=str(exc)[:180]
        state['sources'][url]=info

    auto=[]
    for src in json.loads(MARKET.read_text(encoding='utf-8')):
        try:auto.extend(structured_candidates(fetch(src['url']).text,src['url'],src))
        except Exception:pass
    dedup={}
    for p in auto:
        key=(p['source'],p['price']); dedup[key]=p
    auto=sorted(dedup.values(),key=lambda x:(-x['score'],x['price']))[:24]
    if auto:
        data['auto_properties']=auto
    else:
        data.setdefault('auto_properties',[])

    state['changed_sources']=changed
    state['auto_candidates_found']=len(auto)
    STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    data['updated_at']=datetime.now().astimezone().strftime('%d/%m/%Y')
    data['source_changes']=changed
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Revisadas {len(state["sources"])} fuentes; {len(auto)} candidatos estructurados; {len(changed)} cambios.')

if __name__=='__main__': main()
