"""Independent exact rational layer mask/effect/compositing oracle."""
import json, sys
from fractions import Fraction as F

def byte(v):
    v=F(v)
    return max(0,min(255,(2*v.numerator+v.denominator)//(2*v.denominator)))

def effects(node,w,h):
    p=node['pixels'][:]
    for e in node['effects']:
        if not e['enabled']: continue
        out=p[:]; a=e['amount']; kind=e['kind']
        for y in range(h):
            for x in range(w):
                i=(y*w+x)*4
                if kind=='mosaic':
                    j=((y//a)*a*w+(x//a)*a)*4
                    out[i:i+4]=p[j:j+4]; continue
                if kind=='blur':
                    indices=[(yy*w+xx)*4 for yy in range(max(0,y-a),min(h,y+a+1)) for xx in range(max(0,x-a),min(w,x+a+1))]
                    alpha=sum(p[j+3] for j in indices)
                    out[i+3]=byte(F(alpha,len(indices)))
                    out[i:i+3]=[byte(F(sum(p[j+k]*p[j+3] for j in indices),alpha)) if alpha else 0 for k in range(3)]
                    continue
                if kind=='alpha': out[i+3]=byte(F(p[i+3]*a,100)); continue
                gray=byte(F(54*p[i]+183*p[i+1]+19*p[i+2],256))
                for k in range(3):
                    v=p[i+k]
                    out[i+k]=255-v if kind=='invert' else gray if kind=='grayscale' else byte(v+a) if kind=='brightness' else byte((F(v)-F(255,2))*F(100+a,100-a)+F(255,2)) if kind=='contrast' else byte(F(byte(F(v*(a-1),255))*255,a-1))
        p=out
    if node['maskEnabled']:
        for i,v in enumerate(node['mask']): p[i*4+3]=byte(F(p[i*4+3]*v,255))
    return p

def blend(b,s,m):
    if m=='normal': return s
    if m=='multiply': return b*s
    if m=='screen': return b+s-b*s
    if m=='overlay': return 2*b*s if b<=F(1,2) else 1-2*(1-b)*(1-s)
    if m=='darken': return min(b,s)
    if m=='lighten': return max(b,s)
    if m=='difference': return abs(b-s)
    if m=='exclusion': return b+s-2*b*s

def render(nodes,i,w,h):
    dst=[F(0)]*4
    for n in nodes:
        if not n['visible']: continue
        if 'children' in n:
            src=[v*F(n['opacity'],255) for v in render(n['children'],i,w,h)];mode='normal'
        else:
            p=n['rendered']; a=F(p[i+3]*n['opacity'],255*255)
            src=[F(v,255)*a for v in p[i:i+3]]+[a];mode=n['mode']
        a,b=dst[3],src[3]
        rgb=[(1-b)*dst[k]+(1-a)*src[k]+(a*b*blend(dst[k]/a,src[k]/b,mode) if a and b else 0) for k in range(3)]
        dst=rgb+[b+a*(1-b)]
    return dst

outputs=[]
for case in json.load(sys.stdin):
    w,h=case['width'],case['height']
    def prepare(nodes):
        for n in nodes:
            if 'children' in n: prepare(n['children'])
            else: n['rendered']=effects(n,w,h)
    prepare(case['nodes']);out=[]
    for i in range(0,w*h*4,4):
        p=render(case['nodes'],i,w,h)
        out.extend([byte(v/p[3]*255) for v in p[:3]]+[byte(p[3]*255)] if p[3] else [0]*4)
    outputs.append(out)
json.dump(outputs,sys.stdout)
