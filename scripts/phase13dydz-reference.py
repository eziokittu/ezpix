"""Independent rational oracle: overlap blend + source-over, rounded once."""
import json,sys
from fractions import Fraction as F
def blend(b,s,mode):
    if mode=='normal': return s
    if mode=='multiply': return b*s
    if mode=='screen': return 1-(1-b)*(1-s)
    if mode=='overlay': return 2*b*s if b<=F(1,2) else 1-2*(1-b)*(1-s)
    if mode=='darken': return min(b,s)
    if mode=='lighten': return max(b,s)
    if mode=='difference': return abs(b-s)
    if mode=='exclusion': return b*(1-s)+s*(1-b)
    raise ValueError(mode)
def render(nodes):
    result=[F(0)]*4
    for n in nodes:
        if not n['visible']: continue
        if 'children' in n:
            src=[v*F(n['opacity'],255) for v in render(n['children'])]
            mode='normal'
        else:
            alpha=F(n['pixels'][3]*n['opacity'],255*255)
            src=[F(c,255)*alpha for c in n['pixels'][:3]]+[alpha]
            mode=n['mode']
        ab,ass=result[3],src[3]
        for c in range(3):
            overlap=ab*ass*blend(result[c]/ab,src[c]/ass,mode) if ab and ass else 0
            result[c]=(1-ass)*result[c]+(1-ab)*src[c]+overlap
        result[3]=ass+ab*(1-ass)
    return result
def byte(v): return (v.numerator*2+v.denominator)//(2*v.denominator)
cases=json.load(sys.stdin)
outputs=[]
for nodes in cases:
    p=render(nodes)
    outputs.append([byte(v/p[3]*255) for v in p[:3]]+[byte(p[3]*255)] if p[3] else [0]*4)
json.dump(outputs,sys.stdout)
