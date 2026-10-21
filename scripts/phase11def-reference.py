import json, sys
from fractions import Fraction
studies = json.load(open(sys.argv[1], encoding='utf-8'))
results = []
def nearest(value):
    magnitude = abs(value)
    whole = magnitude.numerator // magnitude.denominator
    if magnitude - whole >= Fraction(1, 2):
        whole += 1
    return -whole if value < 0 else whole
for study in studies:
    width, height, source, options = study['width'], study['height'], study['pixels'], study['options']
    frames = []
    for step in range(1, options['frames']+1):
        dx = nearest(Fraction(options['dx'] * step, options['frames']))
        dy = nearest(Fraction(options['dy'] * step, options['frames']))
        output = [0] * (width*height*4)
        for y in range(height):
            for x in range(width):
                if 0 <= x+dx < width and 0 <= y+dy < height:
                    a, b = (y*width+x)*4, ((y+dy)*width+x+dx)*4
                    output[b:b+4] = source[a:a+4]
        frames.append(output)
    results.append(frames)
print(json.dumps(results))
