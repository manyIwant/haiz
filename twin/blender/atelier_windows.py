"""Front windows for the forecourt study. The photo shows dark sliding lights below
a fixed transom, silver tracks, and some sashes left open against a shaded room."""
import math
from kit import Geo, MATERIALS


def unit(w, h, cols, state, ground=False, guard=False):
    g = Geo()
    frame = 'atelier.sash.bronze' if ground else 'atelier.sash.charcoal'
    for key,col,r,m in [
        ('atelier.sash.bronze',(0.34,0.20,0.14),0.38,0.46),
        ('atelier.sash.charcoal',(0.20,0.255,0.25),0.37,0.48),
        ('atelier.glass.sea',(0.25,0.42,0.45),0.17,0.32),
        ('atelier.glass.sky',(0.33,0.47,0.53),0.15,0.29),
        ('atelier.glass.shadow',(0.20,0.32,0.34),0.20,0.32),
        ('atelier.linen',(0.46,0.50,0.44),0.91,0),
    ]:
        MATERIALS[key] = (col,r,m,{})
    tr = h*0.73
    for x in (0,w-0.045):
        g.box(frame,(x,0.085,0),(x+0.045,0.21,h))
    for z in (0,tr,h-0.046):
        g.box(frame,(0,0.085,z),(w,0.19,z+0.046))
    g.box('stone.granite.grey',(-0.065,-0.095,-0.060),(w+0.065,0.19,0))
    g.box('trim.white',(-0.045,-0.105,h),(w+0.045,0.055,h+0.035))
    # Recessed head, side returns and a shaded background remain visible through openings.
    g.polyn('interior.dark',[(0,1.28,0),(w,1.28,0),(w,1.28,h),(0,1.28,h)],(0,-1,0))
    for x in (0,w):
        g.box('interior.ceiling',(x-0.015,0.2,0),(x+0.015,1.28,h))
    for z in (0,h):
        g.box('interior.ceiling',(0,0.2,z-0.012),(w,1.28,z+0.012))
    lights = ('atelier.glass.sea','atelier.glass.sky','atelier.glass.shadow')
    pitch = (w-0.09)/cols
    for i in range(cols):
        left = 0.045+i*pitch
        a,b = left, left+pitch
        g.box(frame,(a-0.019,0.095,tr),(a+0.019,0.17,h))
        g.polyn(lights[(state+i//2)%3],[(a,0.15,tr),(b,0.15,tr),(b,0.15,h),(a,0.15,h)],(0,-1,0))
        # Alternate leaves run on separate tracks. A slid leaf overlaps its neighbour.
        yy = 0.102 if i%2 else 0.172
        if i == 1 and state > 0:
            a += pitch*(0.42 if state == 1 else 0.79)
            b += pitch*(0.42 if state == 1 else 0.79)
        for x in (a,b-0.034):
            g.box(frame,(x,yy,0.035),(x+0.034,yy+0.038,tr))
        for z in (0.025,tr-0.04):
            g.box(frame,(a,yy,z),(b,yy+0.038,z+0.035))
        g.polyn(lights[(i+state)%3],[(a,yy+0.02,0.04),(b,yy+0.02,0.04),
                                     (b,yy+0.02,tr),(a,yy+0.02,tr)],(0,-1,0))
    if state:
        start = 0.05+pitch
        for i in range(12):
            a = start+i*pitch/24
            b = a+pitch/24
            ya,yb = 0.56+0.04*math.cos(i*1.6),0.56+0.04*math.cos((i+1)*1.6)
            g.polyn('atelier.linen',[(a,ya,0.13),(b,yb,0.15),(b,yb,h-0.10),(a,ya,h-0.10)],(0,-1,0))
    if guard:
        for z in (0.12,0.81):
            g.box(frame,(0.04,-0.12,z),(w-0.04,-0.085,z+0.031))
        for i in range(1,int(w/0.14)):
            x = i*w/int(w/0.14)
            g.box(frame,(x,-0.11,0.12),(x+0.014,-0.095,0.83))
    return g


def dress(out, building):
    types = {
        'w_side': (2.4,1.8,3),
        'w_pav': (1.6,1.5,2),
        'w_tower': (1.4,1.6,2),
        'w_rear': (2.4,1.6,3),
        'w_up': (building.WW,building.WH,3),
        'w_f1': (building.WW,2.5,3),
        'w_f2': (building.WW, min(building.WH, building.lvl(3)+0.1-building.ENT_H-0.15 -
                               (building.lvl(2)+building.WSILL)),3),
        'w_wide': (building.CW['w'],building.CW['h'],5),
        'w_wide_top': (building.CW['w'],building.CW['top_storey']['h'],5),
        'w_wide_bars': (building.CW['w'],building.CW['h'],5),
    }
    for i,(proto,transform,part) in enumerate(out.inst):
        if proto not in types:
            continue
        state = (i*7+i//4)%5
        state = 0 if state<2 else (1 if state<4 else 2)
        if types[proto][2] == 2:
            state = 0  # A two-light unit has no third bay to receive the sliding leaf.
        key = f'{proto}.track{state}'
        if key not in out.protos:
            out.protos[key] = unit(*types[proto],state,ground=proto=='w_f1',guard=proto=='w_wide_bars')
        out.inst[i] = (key, transform, part)
