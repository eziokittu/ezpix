"""Independent exact rational compositor for text, adjustments, isolated filters and references."""
import json,sys,base64
from fractions import Fraction as F
def byte(v):
    v=F(v);return max(0,min(255,(2*v.numerator+v.denominator)//(2*v.denominator)))
def to_bytes(p):
    out=[]
    for i in range(0,len(p),4):
        a=p[i+3];out.extend([byte(p[i+k]/a*255) for k in range(3)]+[byte(a*255)] if a else [0]*4)
    return out
def premult(p):
    out=[]
    for i in range(0,len(p),4):
        a=F(p[i+3],255);out.extend([F(p[i+k],255)*a for k in range(3)]+[a])
    return out
def effect(p,w,h,stack):
    p=p[:]
    for e in stack:
        if not e['enabled']:continue
        kind,a=e['kind'],e['amount'];out=p[:]
        for y in range(h):
            for x in range(w):
                i=(y*w+x)*4
                if kind=='mosaic':j=((y//a)*a*w+(x//a)*a)*4;out[i:i+4]=p[j:j+4];continue
                if kind=='blur':
                    indices=[(yy*w+xx)*4 for yy in range(max(0,y-a),min(h,y+a+1)) for xx in range(max(0,x-a),min(w,x+a+1))];alpha=sum(p[j+3] for j in indices)
                    out[i:i+3]=[byte(F(sum(p[j+k]*p[j+3] for j in indices),alpha)) if alpha else 0 for k in range(3)];out[i+3]=byte(F(alpha,len(indices)));continue
                if kind=='alpha':out[i+3]=byte(F(p[i+3]*a,100));continue
                gray=byte(F(54*p[i]+183*p[i+1]+19*p[i+2],256))
                for k in range(3):
                    v=p[i+k]
                    out[i+k]=255-v if kind=='invert' else gray if kind=='grayscale' else byte(v+a) if kind=='brightness' else (255 if v>127.5 else 0) if kind=='contrast' and a==100 else byte((F(v)-F(255,2))*F(100+a,100-a)+F(255,2)) if kind=='contrast' else byte(F(byte(F(v*(a-1),255))*255,a-1))
        p=out
    return p
def blend(b,s,m):
    if m=='normal':return s
    if m=='multiply':return b*s
    if m=='screen':return b+s-b*s
    if m=='overlay':return 2*b*s if b<=F(1,2) else 1-2*(1-b)*(1-s)
    if m=='darken':return min(b,s)
    if m=='lighten':return max(b,s)
    if m=='difference':return abs(b-s)
    return b+s-2*b*s
def evaluate(d):
    w,h=d['width'],d['height'];length=w*h*4;layers=d['layers'];groups=d['groups'];frame=d['activeFrameId']
    def raw(l):
        if 'text' in l:
            t=l['text'];p=[0]*length;ox,oy=t['x'],t['y'];x,y=ox,oy
            patterns={'A':'010101111101101','B':'110101110101110'}
            for c in t['text'].upper():
                if c=='\n':x=ox;y+=6*t['scale'];continue
                for i,b in enumerate(patterns.get(c,'0'*15)):
                    if b!='1':continue
                    for dy in range(t['scale']):
                        for dx in range(t['scale']):
                            xx=x+i%3*t['scale']+dx;yy=y+i//3*t['scale']+dy
                            if 0<=xx<w and 0<=yy<h:p[(yy*w+xx)*4:(yy*w+xx)*4+4]=t['color']
                x+=(3+t['spacing'])*t['scale']
            return p
        cel=next(c for c in l['cels'] if c['frameId']==frame)
        if 'link' in cel:cel=next(c for c in l['cels'] if c['frameId']==cel['link'])
        return [0]*length if cel.get('empty') else list(base64.b64decode(cel['rgba']))
    def first(g):return min(i for i,l in enumerate(layers) if l['groupId']==g['id'] or l['groupId'] in descendants(g['id']))
    def descendants(gid):return [g['id'] for g in groups if g['parentId']==gid]+[v for g in groups if g['parentId']==gid for v in descendants(g['id'])]
    def render(parent):
        dst=[F(0)]*length;nodes=[(i,False,l) for i,l in enumerate(layers) if l['groupId']==parent]+[(first(g),True,g) for g in groups if g['parentId']==parent]
        for _,group,l in sorted(nodes,key=lambda n:n[0]):
            if not l['visible'] or not l['opacity']:continue
            mask=list(base64.b64decode(l['mask']['gray'])) if l.get('mask',{}).get('enabled') else [255]*(w*h)
            if l.get('adjustment'):
                filtered=premult(effect(to_bytes(dst),w,h,l.get('effects',[])))
                for i in range(0,length,4):
                    t=F(l['opacity']*mask[i//4],255*255)
                    for k in range(4):dst[i+k]=dst[i+k]*(1-t)+filtered[i+k]*t
                continue
            if group:
                src=render(l['id'])
                if any(e['enabled'] for e in l.get('effects',[])):src=premult(effect(to_bytes(src),w,h,l['effects']))
            else:
                p=effect(raw(l),w,h,l.get('effects',[]))
                for i in range(0,length,4):p[i+3]=byte(F(p[i+3]*mask[i//4],255))
                src=premult(p)
            for i in range(0,length,4):
                scaled=[src[i+k]*F(l['opacity'],255) for k in range(4)];a,b=dst[i+3],scaled[3];mode='normal' if group else l['blendMode']
                for k in range(3):dst[i+k]=(1-b)*dst[i+k]+(1-a)*scaled[k]+(a*b*blend(dst[i+k]/a,scaled[k]/b,mode) if a and b else 0)
                dst[i+3]=b+a*(1-b)
        return dst
    return to_bytes(render(None))
json.dump([evaluate(d) for d in json.load(sys.stdin)],sys.stdout)
