"""Packed, relightable glTF materials. All texture pixels are generated from seeded
mineral, grain and joint fields. Images tile over a known metric repeat."""
from pathlib import Path
import bpy
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

SIZE = 1024


def smooth_noise(rng, wavelength):
    n = max(2, round(SIZE / wavelength))
    grid = rng.normal(size=(n,n))
    ij = np.indices((SIZE,SIZE), dtype='f') * (n / SIZE)
    return map_coordinates(grid, ij, order=3, mode='grid-wrap')


def rgb_image(directory, name, values, linear_data=False):
    path = directory / (name + '.png')
    Image.fromarray(np.uint8(np.clip(values, 0, 1)*255 + 0.5)).save(path)
    image = bpy.data.images.load(str(path))
    if linear_data:
        image.colorspace_settings.name = 'Non-Color'
    image.pack()
    return image


def build_maps(directory, name, kind, palette, repeat, grid=None):
    """Rows run top-to-bottom in PNG. For normal maps, tangent V points up."""
    rng = np.random.default_rng({'limestone':1923, 'slab':1932, 'paving':2003,'road':1988}[kind])
    row, col = np.indices((SIZE, SIZE))
    coarse = smooth_noise(rng, 146)
    mid = smooth_noise(rng, 34)
    small = smooth_noise(rng, 6.5)
    grit = rng.normal(size=(SIZE,SIZE))
    tone = 0.065*coarse + 0.055*mid + 0.034*small + 0.047*grit
    relief = (0.0009*mid + 0.00055*small + 0.00023*grit)
    base = np.ones((SIZE, SIZE, 3))*np.array(palette)
    rough = 0.55 + 0.08*mid
    if kind == 'limestone':
        # Spalled bedding, hairline calcite and granular crystals, independent of lighting.
        field = smooth_noise(rng, 142) + 0.26*mid + 0.06*small
        calcite = np.exp(-(field/0.052)**2)*np.clip(0.62+0.32*coarse,0,1)
        fracture = np.exp(-((field-0.16)/0.038)**2)
        tone += 0.16*calcite - 0.09*fracture + 0.043*mid + 0.027*small
        relief += 0.0022*mid + 0.0013*small + 0.0016*calcite - 0.002*fracture
        rough = 0.76 + 0.08*small - 0.13*calcite
    elif kind == 'road':
        tone = 0.025*coarse + 0.025*mid + 0.05*small + 0.065*grit
        relief += 0.0007*small
        rough = 0.84 + 0.035*coarse
    else:
        nx, ny = grid
        ix, iy = (col*nx)//SIZE, (row*ny)//SIZE
        slabs = rng.normal(size=(ny,nx,2))[iy,ix]
        variation = 0.014 if nx > 20 else 0.068
        base *= (1+variation*slabs[:,:,0,None])
        base += slabs[:,:,1,None]*np.array([0.014,0.006,-0.012])
        def edge(coords, count):
            phase = (coords+0.5)*count/SIZE
            return abs(phase - np.round(phase))*repeat/count
        joint_dist = np.minimum(edge(col,nx),edge(row,ny))
        seam = np.exp(-(joint_dist/0.0048)**2)
        relief -= 0.0035*seam
        tone -= (0.14 if nx>20 else 0.34)*seam
        rough += 0.23*seam
        if kind == 'paving':
            rough += 0.13
    rgb = base*(1+tone[:,:,None])
    dx = (np.roll(relief,-1,1)-np.roll(relief,1,1)) * SIZE/(2*repeat)
    dy = (np.roll(relief,-1,0)-np.roll(relief,1,0)) * SIZE/(2*repeat)
    n = np.stack([-dx,dy,np.ones_like(dx)],axis=2)
    n /= np.linalg.norm(n,axis=2,keepdims=True)
    orm = np.stack([np.ones_like(rough), np.clip(rough,0.15,0.99), np.zeros_like(rough)],axis=2)
    return (rgb_image(directory,name+'.albedo',rgb),rgb_image(directory,name+'.normal',n*0.5+0.5,True),
            rgb_image(directory,name+'.orm',orm,True))


def apply_maps(mat, images, repeat, vertex=False):
    nt = mat.node_tree
    bs = nt.nodes.get('Principled BSDF')
    uv = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1/repeat,1/repeat,1)
    nt.links.new(uv.outputs['UV'],mapping.inputs['Vector'])
    def sample(im):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = im
        nt.links.new(mapping.outputs[0], t.inputs[0])
        return t.outputs['Color']
    col = sample(images[0])
    if vertex:
        attr = nt.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Lithology'
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        nt.links.new(col,mix.inputs[1])
        nt.links.new(attr.outputs[0],mix.inputs[2])
        col = mix.outputs[0]
    nt.links.new(col,bs.inputs['Base Color'])
    normal = nt.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = 0.26 if vertex else 0.37
    nt.links.new(sample(images[1]),normal.inputs['Color'])
    nt.links.new(normal.outputs[0],bs.inputs['Normal'])
    separate = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(sample(images[2]),separate.inputs[0])
    nt.links.new(separate.outputs['Green'],bs.inputs['Roughness'])
    nt.links.new(separate.outputs['Blue'],bs.inputs['Metallic'])


def lithology(vertices):
    p = vertices - vertices.min(axis=0)
    rng = np.random.default_rng(1066)
    def sample(scale):
        grid = rng.uniform(-1,1,tuple((p.max(axis=0)/scale).astype(int)+5))
        return map_coordinates(grid,(p/scale+1).T,order=3)
    large, medium, small, grit = [sample(s) for s in (1.1,0.35,0.12,0.047)]
    x,y,z = p.T
    vein = np.abs(large + 0.35*medium + 0.08*small + 0.09*z - 0.12*x)
    cross = np.abs(medium + 0.19*small + 0.10*y)
    white = np.maximum(np.exp(-(vein/0.045)**2), 0.52*np.exp(-(cross/0.053)**2))
    strike = z + 0.29*x - 0.13*y + 0.17*large + 0.065*medium
    distances = [np.abs(strike-h) for h in (0.67,1.26,1.68,1.735,2.26,2.98,3.43,4.11,4.19)]
    seams = np.exp(-(np.min(distances,axis=0)/0.018)**2)*np.clip(0.72+0.44*medium,0,1)
    white = np.maximum(white,seams)
    # Ochre concentrates at the west end and low on the feet, visible in jiaoxuelou.
    stain = np.clip(0.55 - 0.24*x + 0.47*large + 0.22*medium + 0.46*np.exp(-z/0.35),0,1)
    grey = np.array([0.39,0.385,0.374]) + (0.078*large+0.038*medium+0.033*small+0.023*grit)[:,None]
    rgb = grey * (1-stain[:,None]) + np.array([0.61,0.42,0.227])*stain[:,None]
    rgb += white[:,None]*np.array([0.28,0.275,0.24])
    return np.clip(rgb,0.09,0.97)
