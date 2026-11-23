"""Teaching Block 2 in the forecourt edition. The two raised link heads and window
wall facing Block 1 are visible in aerial_campus. The opposite elevation is inferred."""
import json
import math
from pathlib import Path

from mathutils import Matrix
import arch
import b_yihao
import build
import kit

TWIN = Path(__file__).resolve().parents[1]
WALL = 'atelier.erhao.ceramic'
EDGE = 'atelier.erhao.coping'
SHADE = 'atelier.erhao.shade'


def build_block(coll):
    data = json.loads((TWIN/'data/campus.json').read_text())
    footprint = next(b for b in data['buildings'] if b['record']=='w1165596683@1')
    poly = footprint['poly'][:-1]
    west,east = min(x for x,y in poly), max(x for x,y in poly)
    # Follow the end points of the mapped northern edge; retain the entire polygon for the roof.
    north = sorted((x,y) for x,y in poly if y>-50)
    def front(x):
        t = (x-north[0][0])/(north[-1][0]-north[0][0])
        return north[0][1] + t*(north[-1][1]-north[0][1])
    rear = min(y for x,y in poly)
    for name,col,r in [(WALL,(0.70,0.675,0.63),0.75),(EDGE,(0.74,0.73,0.68),0.62),
                       (SHADE,(0.36,0.35,0.32),0.84),('atelier.ac',(0.64,0.64,0.57),0.62)]:
        kit.MATERIALS[name]=(col,r,0,{})
    out = b_yihao.Out()
    base = 1.05
    floors = [0,4,7.39,10.78,14.17,17.56]
    ztop = floors[-1]
    shell = out.geo('roof','public-map/estimated','Roof perimeter from OSM w1165596683@1. Flat dark roof, parapets and raised link heads visible on aerial_campus; dimensions inferred.')
    arch.flat_roof(shell,poly,ztop,parapet_h=0.57)
    out.protos['room'] = arch.window_unit(2.2,1.63,cols=3,frame_mat='frame.alu.grey',
        glass_mat='atelier.glass.shadow',bars=0.94,transom=0.72,frame=0.045,mull=0.028)
    out.protos['landing'] = arch.window_unit(1.24,1.85,cols=2,frame_mat='frame.alu.grey',
        glass_mat='atelier.glass.sea',transom=0.70)
    out.protos['service'] = arch.window_unit(1.5,1.45,cols=2,frame_mat='frame.alu.grey',
        glass_mat='atelier.glass.shadow')
    out.protos['door'] = arch.window_unit(1.45,2.25,cols=2,sill=0,frame_mat='frame.alu.grey',glass_mat='atelier.glass.shadow')
    out.geo('classrooms','photo-derived/estimated','aerial_campus shows the north window wall and dark flat roof; campus_erhao shows barred lights and wall-mounted condensers. Openings, unit count and spacing interpreted.')
    fittings = out.geo('cooling_and_drains','estimated','Wall-mounted condensers, grilles and vertical pipework visible in campus_erhao. Individual placements and equipment models inferred.')
    heads = b_yihao.SPEC['links']['x_centres']
    intervals = [(west,heads[0]-2.72),(heads[0]+2.72,heads[1]-2.72),(heads[1]+2.72,east)]
    for left,right in intervals:
        length = right-left
        count = round(length/4.0)
        spacing = length/count
        holes = []
        for i in range(count):
            x = (i+0.5)*spacing
            for level,z in enumerate(floors[:-1]):
                is_door = level == 0 and i%3 == 1
                if is_door:
                    holes.append((x-0.725,x+0.725,0,2.25,'door'))
                    door_x = right-x
                    y_front = front(door_x)
                    fittings.box(EDGE,(door_x-1.26,y_front,2.49),(door_x+1.26,y_front+0.91,2.64))
                    for j in range(5):
                        run = (5-j)*0.31
                        fittings.box(EDGE,(door_x-1.17,y_front,-0.90+j*0.18),
                                     (door_x+1.17,y_front+run,-0.72+j*0.18))
                else:
                    holes.append((x-1.1,x+1.1,z+0.85,z+2.48,'room'))
                if level > 0 and (i+level)%3:
                    cx,cy,cz = right-x+0.77,front(right-x)+0.22,z+0.49
                    fittings.box('atelier.ac',(cx-0.36,cy-0.21,cz-0.24),(cx+0.36,cy+0.17,cz+0.24))
                    for j in range(6):
                        fittings.box(SHADE,(cx-0.31,cy+0.17,cz-0.17+j*0.062),
                                     (cx+0.14,cy+0.185,cz-0.149+j*0.062))
        b_yihao.facade(out,'classrooms',(right,front(right)),(left,front(left)),0,ztop,holes,mat=WALL,t=0.28)
        for i in range(count+1):
            x=left+spacing*i
            if i%3==0 and i<count:
                fittings.cylinder('atelier.ac',(x+0.18,front(x)+0.065),0.050,0.14,ztop-0.18,seg=9)
        for z in floors[1:]:
            shell.box(EDGE,(left,front(right)-0.07,z-0.14),(right,front(left)+0.095,z+0.06))
    core = out.geo('link_heads','photo-derived/estimated','Twin raised heads and flat link roofs are visible in aerial_campus. The openings toward Block 1 match the inherited link centrelines; landing details estimated.')
    for xc in heads:
        a,b = xc-2.72,xc+2.72
        y = front(xc)+0.12
        # Passages are open on each bridge level. A landing light sits above the top deck.
        holes = [(1.24,4.20,z,z+2.70,None) for z in floors[:-1]]
        holes.append((2.10,3.34,ztop+0.21,ztop+2.06,'landing'))
        b_yihao.facade(out,'link_heads',(b,y),(a,y),0,ztop+2.44,holes,mat=WALL)
        for x in (a,b):
            core.box(WALL,(x-0.11,y-5.1,ztop),(x+0.11,y,ztop+2.44))
        core.box(WALL,(a,y-5.1,ztop),(b,y-4.86,ztop+2.44))
        core.box(EDGE,(a-0.13,y-5.20,ztop+2.44),(b+0.13,y+0.14,ztop+2.65))
    rearpart = 'rear_gallery'
    gallery = out.geo(rearpart,'invented','Open gallery on the south and side returns are plausible school-building completions. No matched rear photograph. campus_erhao shows a gallery on a perpendicular block.')
    for i,z in enumerate(floors[:-1]):
        gallery.box(EDGE,(west,rear,z-0.16),(east,rear+2.34,z))
        if i:
            gallery.box(WALL,(west,rear,z),(east,rear+0.14,z+0.91))
            gallery.box(EDGE,(west-0.02,rear-0.03,z+0.9),(east+0.02,rear+0.17,z+0.96))
        n = 17
        w = (east-west)/n
        holes = []
        for k in range(n):
            x = (k+0.5)*w
            holes.extend([(x-1.75,x-0.30,z,z+2.25,'door'),(x+0.02,x+1.52,z+0.88,z+2.33,'service')])
        b_yihao.facade(out,rearpart,(west,rear+2.34),(east,rear+2.34),z,floors[i+1],holes,mat=WALL)
    for i in range(18):
        cx = west+0.2+(east-west-0.4)*i/17
        gallery.box(WALL,(cx-0.15,rear+0.06,0),(cx+0.15,rear+0.42,ztop))
    for x in (west,east):
        start,end = (x,rear+2.34),(x,front(x))
        if x==west: start,end=end,start
        holes=[(3.0,4.5,z+0.88,z+2.33,'service') for z in floors[:-1]]
        b_yihao.facade(out,rearpart,start,end,0,ztop,holes,mat=WALL)
    shell.prism(SHADE,poly,-0.92,0)
    court = out.geo('court_surface','public-map/estimated','Court between the mapped bars and link centrelines, visible on aerial_campus. Pavement extents, joints and surface colour estimated.')
    court.polyn('atelier.court.paving',[(west,front(west),-0.895),(east,front(east),-0.895),
                (east,-10.62,-0.895),(west,-10.62,-0.895)],(0,0,1))
    build.instantiate('erhao',out,coll,Matrix.Translation((0,0,base)))
