"""Centenary Terminalia study. It inherits the photo-traced scaffold and branch-growth
seed. The welded forks, fluted root toes, bark, leaf surfaces and unobserved crown
are editable interpretations. Generate together with forecourt_atelier.py."""
import math
from pathlib import Path
import bpy
import numpy as np
from scipy.ndimage import map_coordinates
from scipy.spatial import cKDTree
from mathutils import Vector
import b_trees
import nature
import kit
from atelier_materials import apply_maps, rgb_image, smooth_noise


def obj(coll,name,verts,faces,mat,basis,smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts,[],faces)
    me.update()
    if smooth:
        me.shade_smooth()
    me.materials.append(kit.get_material(mat))
    ob = bpy.data.objects.new(name,me)
    coll.objects.link(ob)
    ob['haiz_tag'] = 'photo-derived/estimated'
    ob['haiz_basis'] = basis
    return ob


def trunk_surface(coll,L):
    rng = np.random.default_rng(323)
    spines = [nature._catmull(limb['pts'],0.066) for limb in L['limbs']]
    # Broad, low lateral toes sink below ground at their tips.
    tx,ty = L['trunk_xy']
    base = L['ground_z']
    for i in range(7):
        a = i*math.tau/7 + rng.uniform(-0.24,0.24)
        length = rng.uniform(1.08,1.96)
        bend = rng.uniform(-0.35,0.35)
        pts = []
        for t,r,h in ((0,0.31,0.44),(0.23,0.27,0.21),(0.57,0.17,0.065),(0.82,0.092,0.02),(1,0.025,-0.018)):
            angle = a + bend*t
            reach = 0.17+length*t
            pts.append((tx+reach*math.cos(angle), ty+reach*math.sin(angle),base+h,r))
        spines.append(nature._catmull(pts,0.07))
    verts,faces=[],[]
    arc,normals,binormals,tangents=[],[],[],[]
    for i,S in enumerate(spines):
        sides = 36 if S[:,3].max()>0.13 else 16
        v,f = nature.tube(S,sides=sides,seed=i,cap=True)
        radial = v.reshape(len(S),sides,3)-S[:,None,:3]
        tangent = np.gradient(S[:,:3],axis=0)
        tangent /= np.linalg.norm(tangent,axis=1)[:,None]
        distances = np.r_[0,np.cumsum(np.linalg.norm(np.diff(S[:,:3],axis=0),axis=1))]
        a = np.arange(sides)*math.tau/sides
        variation = (0.039*np.sin(5*a[None,:]+0.39*distances[:,None]+i)+
                     0.021*np.cos(9*a[None,:]-0.51*distances[:,None]+i))
        if i==0:
            height = np.maximum(S[:,2]-base,0)
            variation += 0.29*np.exp(-height[:,None]/0.63)*np.cos(3.5*a[None,:]+i)**4
        ring = S[:,None,:3]+radial*(1+variation[:,:,None])
        offset=len(verts)
        verts.extend(ring.reshape(-1,3).tolist())
        faces.extend(tuple(offset+j for j in face) for face in f)
        faces.append(tuple(offset+j for j in reversed(range(sides))))
        u = radial[:,0,:]
        u = u/np.linalg.norm(u,axis=1)[:,None]
        normals.append(u); binormals.append(np.cross(tangent,u)); arc.append(distances)
        tangents.append(tangent)
    ob=obj(coll,'lanren.scaffold',verts,faces,'atelier.bark',L['basis']+' Fork unions and roots are sculpted estimates.')
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    ob.data.remesh_voxel_size=0.039
    bpy.ops.object.voxel_remesh()
    mod=ob.modifiers.new('Smooth branch collars','SMOOTH')
    mod.factor=0.63;mod.iterations=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me=ob.data
    me.shade_smooth()
    p=np.empty(len(me.vertices)*3,'f')
    me.vertices.foreach_get('co',p);p=p.reshape(-1,3)
    S=np.vstack(spines)
    which=cKDTree(S[:,:3]).query(p)[1]
    d=p-S[which,:3]
    u=np.einsum('ij,ij->i',d,np.vstack(normals)[which])
    v=np.einsum('ij,ij->i',d,np.vstack(binormals)[which])
    phase=np.arctan2(v,u)
    radius=S[which,3]
    along=np.concatenate(arc)[which]+np.einsum('ij,ij->i',d,np.vstack(tangents)[which])
    # Low longitudinal fluting in the solid; fine fissures in the tangent-space map.
    n=np.empty(p.size,'f');me.vertices.foreach_get('normal',n);n=n.reshape(-1,3)
    relief=(0.007*np.sin(phase*17+along*1.3)+0.004*np.sin(phase*31-along*1.8))
    p+=n*relief[:,None]*np.clip(radius/0.23,0.2,1)[:,None]
    me.vertices.foreach_set('co',p.ravel());me.update()
    loop=np.empty(len(me.loops),'i');me.loops.foreach_get('vertex_index',loop)
    uv=np.column_stack((phase*radius,along))[loop].astype('f')
    # Correct cylindrical seam only within a face so a wrap never stretches across its width.
    start=np.empty(len(me.polygons),'i');me.polygons.foreach_get('loop_start',start)
    count=np.diff(np.r_[start,len(loop)])
    anchor=np.repeat(phase[loop[start]],count)
    delta=(phase[loop]-anchor+np.pi)%(2*np.pi)-np.pi
    uv[:,0]=(anchor+delta)*radius[loop]
    me.uv_layers.new(name='bark.metres').data.foreach_set('uv',uv.ravel())
    return ob


def surface_maps(directory):
    rng=np.random.default_rng(19238)
    size=1024
    row,col=np.indices((size,size),dtype='f')/size
    coarse=smooth_noise(rng,115); fleck=smooth_noise(rng,5); small=smooth_noise(rng,19)
    warp=0.010*coarse+0.0038*small
    # Anisotropic, tileable periderm plates with broken transverse seams.
    grid=rng.normal(size=(9,63))
    field=map_coordinates(grid,[row*9,(col+warp)*63],order=3,mode='grid-wrap')
    split=np.exp(-((field+0.18)/0.22)**2)*np.clip(0.65+0.38*small,0,1)
    patches=np.clip((coarse*0.65+small*0.35-0.52)*1.8,0,1)
    tone=0.031*field+0.027*small+0.023*fleck-0.123*split
    color=np.array([0.37,0.293,0.224])+tone[:,:,None]+patches[:,:,None]*[0.085,0.105,0.084]
    h=0.003*field-0.006*split+0.0015*small+0.00065*fleck
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*size/2
    dy=(np.roll(h,-1,0)-np.roll(h,1,0))*size/2
    normal=np.stack([-dx,dy,np.ones_like(dx)],axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    orm=np.stack([np.ones_like(h),np.clip(0.78+0.07*fleck+0.08*split,0,1),np.zeros_like(h)],axis=-1)
    images=(rgb_image(directory,'terminalia.bark',color),rgb_image(directory,'terminalia.bark.normal',normal*0.5+0.5,True),rgb_image(directory,'terminalia.bark.orm',orm,True))
    apply_maps(kit.get_material('atelier.bark'),images,1)
    # One obovate lamina in UV space. The mesh defines the edge; the texture supplies
    # midrib, arching lateral veins and a quieter network of fine connecting veins.
    row,col=np.indices((512,256),dtype='f')
    t=1-row/511; side=abs(col/255-0.5)*2
    midrib=np.exp(-(side/(0.018+0.025*(1-t)))**2)
    level=t-0.27*side**1.3+0.042*side**2
    lateral=np.exp(-(np.sin(level*np.pi*7)/(0.076+0.08*(1-side)))**2)*(1-side*0.6)
    grain=rng.normal(0,0.009,t.shape)
    green=(np.array([0.37,0.53,0.235])+ (0.039*np.sin(t*4+side*1.7)+grain-0.045*side)[:,:,None]+
           (0.16*midrib+0.09*lateral)[:,:,None]*[1.1,0.88,0.45])
    leaf=rgb_image(directory,'terminalia.leaf',green)
    for key,mult in [('mature',(0.60,0.79,0.58)),('fresh',(0.91,1.0,0.71)),('bronze',(1.18,0.57,0.31))]:
        mat=kit.get_material('atelier.leaf.'+key)
        nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=leaf
        # Bake each pigment into its image so even a plain glTF viewer can relight the crown.
        if key!='fresh':
            tex.image=rgb_image(directory,'terminalia.leaf.'+key,green*np.array(mult))
        nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value=0.50
        bs.inputs['Subsurface Weight'].default_value=0.065
        bs.inputs['Subsurface Radius'].default_value=(0.012,0.018,0.008)
        mat.use_backface_culling=False


def crown(coll,L):
    env=L['envelope']
    envelope=nature.Envelope(env['poly'],env['z_bottom'],env['z_top_centre'],env['z_top_edge'],centre=env.get('centre'))
    tree=nature.BroadleafTree(L['limbs'],envelope,seed=1923,habit='tiered',spacing=0.9,twig_spacing=0.26,
                              rosette_step=0.16,min_spawn_z=2.4,sec_max=6.0,wiggle=0.6).grow()
    verts=[];faces=[];twig_uv=[]
    for S,level in tree.branches:
        if level<=1:continue
        S=S.copy()
        S[:2,3] *= [1.20,1.07]
        v,f=nature.tube(S,sides=6,cap=True)
        distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(S[:,:3],axis=0),axis=1))]
        for face in f:
            sectors=[j%6 for j in face]
            crosses=0 in sectors and 5 in sectors
            for j,sector in zip(face,sectors):
                ring=j//6
                u=(6 if crosses and sector==0 else sector)*math.tau/6*S[ring,3]
                twig_uv.append((u,distance[ring]))
        start=len(verts);verts.extend(v.tolist())
        faces.extend(tuple(start+i for i in q) for q in f)
    twig=obj(coll,'lanren.twigwood',verts,faces,'atelier.bark','Secondary and terminal shoots use the phase-two seed and crown envelope.')
    twig.data.uv_layers.new(name='bark.metres').data.foreach_set('uv',np.array(twig_uv,'f').ravel())
    rng=np.random.default_rng(19234)
    pts=np.asarray(tree.leaf_pts)
    normals=np.asarray(tree.leaf_up)
    # Retain sky gaps between the tiers. Keep a rosette of leaves per selected tip;
    # they share a petiole origin, with a similar range of pigment on each shoot.
    keep=rng.random(len(pts))<0.50
    pts,normals=pts[keep],normals[keep]
    centres=np.repeat(pts,6,axis=0)
    up=np.repeat(normals,6,axis=0); up/=np.linalg.norm(up,axis=1)[:,None]
    angle=np.repeat(rng.uniform(0,math.tau,len(pts)),6)+np.tile(np.arange(6)*math.tau/6,len(pts))+rng.uniform(-0.24,0.24,len(centres))
    along=np.stack([np.cos(angle),np.sin(angle),rng.uniform(-0.35,0.74,len(angle))],axis=1)
    along/=np.linalg.norm(along,axis=1)[:,None]
    across=np.cross(up,along);across/=np.linalg.norm(across,axis=1)[:,None]
    above=np.cross(along,across)
    length=rng.uniform(0.16,0.29,len(centres))
    width=length*rng.uniform(0.46,0.62,len(centres))
    # Curved midrib and camber; the broader distal third gives Terminalia its shape.
    profile=np.array([(0,0),(0.27,-0.27),(0.27,0),(0.27,0.27),
                      (0.67,-0.50),(0.67,0),(0.67,0.50),(0.87,-0.42),(0.87,0.42),(1,0)])
    t,w=profile.T
    coords=(centres[:,None,:]+along[:,None,:]*(length[:,None]*t)[...,None]
            +across[:,None,:]*(width[:,None]*w)[...,None]
            +above[:,None,:]*(length[:,None]*(0.13*np.sin(t*np.pi)-0.14*t**3-0.12*abs(w)))[...,None])
    face_template=[(0,2,1),(0,3,2),(1,2,5,4),(2,3,6,5),(4,5,9,7),(5,6,8,9)]
    face_template=[tuple(reversed(f)) for f in face_template]
    faces=[tuple(i*len(t)+j for j in f) for i in range(len(coords)) for f in face_template]
    ob=obj(coll,'lanren.terminalia.leaves',coords.reshape(-1,3).tolist(),faces,'atelier.leaf.mature',
           'Obovate leaves in terminal rosettes. Clustering, tier density, venation, colour mix and seasonal state inferred.')
    me=ob.data
    for name in ('fresh','bronze'):
        me.materials.append(kit.get_material('atelier.leaf.'+name))
    pigments=np.repeat(rng.choice(3,len(pts),p=[0.72,0.24,0.04]),6)
    me.polygons.foreach_set('material_index',np.repeat(pigments,len(face_template)).astype('i'))
    uv=np.array([(0.5+w[j],t[j]) for f in face_template for j in f],'f')
    me.uv_layers.new(name='lamina').data.foreach_set('uv',np.tile(uv,(len(coords),1)).ravel())


def tree(coll,directory):
    L=b_trees.T['lanren']
    trunk_surface(coll,L)
    crown(coll,L)
    surface_maps(directory)
    root_bed(coll,L)
    boulders(coll,L,directory)


def root_bed(coll,L):
    from shapely.geometry import Point, Polygon
    import build
    ring=next(z['geom']['poly'] for z in build.SITE['zones'] if z['id']=='lanren_bed')
    bed=Polygon(ring).buffer(-0.09)
    rng=np.random.default_rng(9311)
    verts,faces,materials=[],[],[]
    xmin,ymin,xmax,ymax=bed.bounds
    tx,ty=L['trunk_xy']
    z=L['ground_z']+0.008
    def blade(x,y,z,a,length,width,height,sag,mat):
        c,s=math.cos(a),math.sin(a)
        ids=[]
        for t,w in ((0,0.05),(0.32,0.70),(0.70,1.0),(1,0.05)):
            h=height*t-sag*t*t
            r=t*length
            ids.append(len(verts))
            verts.extend([(x+c*r-s*width*w,y+s*r+c*width*w,z+h),
                          (x+c*r,y+s*r,z+h+width*w*0.24),
                          (x+c*r+s*width*w,y+s*r-c*width*w,z+h)])
        for i,j in zip(ids,ids[1:]):
            faces.extend(((i,i+1,j+1,j),(i+1,i+2,j+2,j+1)))
            materials.extend((mat,mat))
    for _ in range(700):
        x,y=rng.uniform(xmin,xmax),rng.uniform(ymin,ymax)
        if not bed.contains(Point(x,y)) or math.hypot(x-tx,y-ty)<1.05: continue
        if math.sin(2*x)*math.cos(2.4*y)>0.2 and rng.random()<0.85: continue
        for _ in range(rng.integers(5,10)):
            size=rng.uniform(0.12,0.32)
            blade(x,y,z,rng.uniform(0,math.tau),size,rng.uniform(0.014,0.035),size*1.6,size*1.10,rng.integers(3))
    for _ in range(140):
        x,y=rng.uniform(xmin,xmax),rng.uniform(ymin,ymax)
        if bed.contains(Point(x,y)) and math.hypot(x-tx,y-ty)>0.65:
            blade(x,y,z+0.002,rng.uniform(0,math.tau),rng.uniform(0.13,0.24),rng.uniform(0.035,0.068),0.07,0.07,3)
    cols=[(0.21,0.34,0.14),(0.33,0.44,0.16),(0.44,0.49,0.21),(0.43,0.285,0.16)]
    names=[f'atelier.understory.{i}' for i in range(4)]
    for name,col in zip(names,cols): kit.MATERIALS[name]=(col,0.78,0,{})
    ob=obj(coll,'lanren.rootbed',verts,faces,names[0],'lanshu shows vegetation in the planting bed; tufts, curled litter and planting pattern inferred.',False)
    for name in names[1:]: ob.data.materials.append(kit.get_material(name))
    ob.data.polygons.foreach_set('material_index',np.array(materials,'i'))


def boulders(coll,L,directory):
    from skimage.measure import marching_cubes
    from atelier_materials import build_maps
    mat=kit.get_material('atelier.supportstone')
    apply_maps(mat,build_maps(directory,'supportstone','limestone',(0.93,0.925,0.90),0.86),0.86,vertex=True)
    for i,spec in enumerate(L['boulders']):
        wx,wy,height=spec['size']
        step=min(0.017,min(wx,wy,height)/45)
        xs=np.arange(-0.83*wx,0.83*wx+step,step)
        ys=np.arange(-0.83*wy,0.83*wy+step,step)
        zs=np.arange(-0.08,height+0.12,step)
        x,y,z=np.meshgrid(xs,ys,zs,indexing='ij')
        t=z/height
        radius=np.interp(t,[-0.04,0,0.09,0.24,0.40,0.65,0.82,0.94,1,1.05],
                         [0.50,0.73,0.78,0.86,1,0.98,0.81,0.52,0.13,0.02])
        a=x/wx*2-0.13*np.sin(t*4+i)
        b=y/wy*2-0.13*t
        sdf=(np.power(abs(a)**2.45+abs(b)**2.45,1/2.45)-radius)*min(wx,wy)/2
        field=np.sin(8*a+2*b+3*t)*np.cos(5*b-2*t)+0.34*np.sin(17*a-8*t+4*b)
        sdf+=field*min(wx,wy)*0.025
        if i==0:
            # The front foot is undercut beneath the bulging shoulder. Its unseen
            # depth and the weathering grooves are inferred from the shaded photograph.
            recess=0.99-np.sqrt(((a+0.27+0.11*np.cos(t*12))/0.28)**2+((t-0.22)/0.22)**2+((b-0.75)/0.84)**2)
            sdf=np.maximum(sdf,recess*0.20)
            sdf+=0.021*np.exp(-(np.sin(7.3*a+2.1*t+0.4*field)/0.24)**2)*np.clip(b+0.45,0,1)
        sdf=np.maximum.reduce([sdf, -0.028-z, z-height])
        v,f,n,_=marching_cubes(sdf,level=0,spacing=(step,step,step),allow_degenerate=False)
        local=v+np.array([xs[0],ys[0],zs[0]])
        # +y is toward the photograph; local x follows the face in the image.
        unit=np.array([49.8-spec['xy'][0],22.7-spec['xy'][1]])
        unit/=np.linalg.norm(unit)
        right=np.array([unit[1],-unit[0]])
        coords=np.column_stack([spec['xy']+local[:,0,None]*right+local[:,1,None]*unit,local[:,2]+spec['z']])
        tri=coords[f]
        if np.sum(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])*(tri.mean(1)-coords.mean(0)))<0:f=f[:,::-1]
        ob=obj(coll,'lanren.supportstone.'+str(i),coords.tolist(),f.tolist(),mat.name,spec['basis']+' Surface, recess depths, weathering and unseen sides inferred.')
        me=ob.data
        axes=np.argmax(abs(np.cross(coords[f[:,1]]-coords[f[:,0]],coords[f[:,2]]-coords[f[:,0]])),axis=1)
        uv=np.empty((len(f),3,2),'f')
        for ax,coords2d in enumerate(((1,2),(0,2),(0,1))):
            uv[axes==ax]=coords[f[axes==ax]][:,:,list(coords2d)]
        me.uv_layers.new(name='metric').data.foreach_set('uv',uv.ravel())
        rng=np.random.default_rng(spec['seed'])
        p=(local-local.min(0))/0.14
        grid=rng.uniform(-1,1,tuple(p.max(0).astype(int)+5))
        cloud=map_coordinates(grid,(p+1).T,order=3)
        moss=np.clip(0.15+0.56*cloud+0.24*local[:,2]/height,0,0.86)
        rgb=np.array([0.47,0.393,0.295])+cloud[:,None]*0.065+moss[:,None]*[-0.07,0.025,-0.07]
        rgb-=0.07*np.exp(-np.maximum(local[:,2],0)/0.13)[:,None]
        attr=me.color_attributes.new('Lithology','BYTE_COLOR','POINT')
        attr.data.foreach_set('color_srgb',np.column_stack([rgb,np.ones(len(rgb))]).astype('f').ravel())
        me.color_attributes.active_color=attr
