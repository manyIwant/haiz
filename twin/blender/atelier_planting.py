"""Small-leaf shrubs along the two colonnades, using the measured-in-image planter locations."""
import math
import random

import bpy
from kit import Geo, MATERIALS, get_material


def hedges(coll, site):
    rng = random.Random(119)
    verts, polys, mats = [], [], []
    palette = [(0.18,0.28,0.105),(0.25,0.35,0.12),(0.31,0.42,0.14),
               (0.41,0.49,0.19),(0.50,0.53,0.22),(0.27,0.28,0.14)]
    bed = Geo()
    for h in site['hedges']:
        x0,y0,x1,y1 = h['box']
        z0 = site['levels'][h['level']]
        # Kerbs enclose the soil, so side-on views retain the planting depth.
        bed.box('kerb.granite',(x0,y0,z0),(x1,y1,z0+0.18))
        bed.box('ground.soil',(x0+0.055,y0+0.055,z0+0.18),(x1-0.055,y1-0.055,z0+0.192))
        for _ in range(int((x1-x0)*75)):
            x = rng.uniform(x0+0.09,x1-0.09)
            y = rng.uniform(y0+0.08,y1-0.08)
            arch = math.sin(math.pi*(y-y0)/(y1-y0))
            hgt = 0.24+0.17*arch+0.055*math.sin(x*2.7)+rng.uniform(-0.06,0.065)
            a = rng.uniform(0,math.tau)
            dx,dy = 0.12*math.cos(a),0.12*math.sin(a)
            z = z0+0.186
            # A tapered shoot shares its base and tip with the leaf stations.
            k = len(verts)
            for t, radius in ((0,0.008),(0.54,0.005),(1,0.0018)):
                for corner in range(3):
                    angle = a+corner*math.tau/3
                    verts.append((x+t*t*dx+radius*math.cos(angle),
                                  y+t*t*dy+radius*math.sin(angle),z+t*hgt))
            for ring in (0,3):
                for j in range(3):
                    q = (j+1)%3
                    polys.append((k+ring+j,k+ring+q,k+ring+3+q,k+ring+3+j))
                    mats.append(5)
            # Paired leaves on each shoot, cupped along the midrib.
            for tier in range(1,6):
                t = tier/5
                for sign in (-1,1):
                    angle = a + sign*1.15 + tier*2.21
                    c,s = math.cos(angle),math.sin(angle)
                    length = rng.uniform(0.055,0.114)*(1.12-0.23*t)
                    width = length*rng.uniform(0.24,0.38)
                    bx,by,bz = x+t*t*dx,y+t*t*dy,z+t*hgt
                    mx,my,mz = bx+c*length*0.56,by+s*length*0.56,bz+length*0.21
                    k = len(verts)
                    verts.extend([(bx,by,bz),(mx-s*width,my+c*width,mz),
                                  (mx,my,mz+width*0.30),(mx+s*width,my-c*width,mz),
                                  (bx+c*length,by+s*length,bz+length*(0.31 if t>0.7 else 0.08))])
                    polys.extend([(k,k+2,k+1),(k+1,k+2,k+4),(k,k+3,k+2),(k+2,k+3,k+4)])
                    tone = min(4,max(0,int(2*t+rng.gauss(0.9,1.0))))
                    mats.extend([5 if rng.random()<0.016 else tone]*4)
    planter = bed.to_object('forecourt.hedge.kerbs',coll)
    me = bpy.data.meshes.new('Opposite leaves')
    me.from_pydata(verts,[],polys)
    for i,color in enumerate(palette):
        key = f'atelier.hedge.{i}'
        MATERIALS[key] = (color,0.60,0,{})
        me.materials.append(get_material(key))
    me.polygons.foreach_set('material_index',mats)
    ob = bpy.data.objects.new('forecourt.hedge.foliage',me)
    coll.objects.link(ob)
    for part in (ob,planter):
        part['haiz_tag'] = 'photo-derived/estimated'
        part['haiz_basis'] = 'scenery_13 and jiaoxuelou show the low hedge under the colonnade. Beds follow site.json. Leaf form, shoots and kerb profile are inferred.'
