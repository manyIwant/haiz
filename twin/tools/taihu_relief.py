"""Work in metres on the inherited two-camera hull. Carve negative space from traced
polygons, then erode the solid along tilted bedding planes. No photograph is baked in.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter, label, map_coordinates, minimum_filter, zoom
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
import taihu_carve as hull

TWIN = Path(__file__).resolve().parents[1]


def noise(shape, rng, cells):
    grid = rng.uniform(-1, 1, np.maximum(3, cells).astype(int)).astype('f')
    return zoom(grid, np.array(shape) / grid.shape, order=3)


def surface():
    spec = json.loads((TWIN / 'evidence/calibration/taihu-silhouettes.json').read_text())
    relief = json.loads((TWIN / 'evidence/calibration/taihu-relief.json').read_text())
    # The new polygonal recesses replace the round drill marks of the earlier study.
    spec['views'][0]['pockets'] = []
    coarse, origin, step = hull.field(spec, res=0.045, crevice_w=0.022, crevice_depth=0.12)
    shape = (np.array(coarse.shape) - 1) * 2 + 1
    d = zoom(coarse, shape / coarse.shape, order=1)
    step /= 2
    rng = np.random.default_rng(192308)
    extent = shape * step
    x, y, z = [origin[i] + step * np.arange(n, dtype='f').reshape(
        tuple(n if k == i else 1 for k in range(3))) for i, n in enumerate(shape)]
    cam = hull.camera(spec['views'][0])
    # Work in a narrow band. Discarding remote air also bounds projection memory.
    idx = np.array(np.where(d < 0.22)).T
    points = origin + step * idx
    uv = cam.project(points)
    distance = np.linalg.norm(points - cam.C, axis=1)
    u, v = np.rint(uv).astype(int).T
    viewport = (1280, 1600)
    front = np.full(viewport, 100., 'f')
    inside = d[tuple(idx.T)] < 0
    np.minimum.at(front, (v[inside], u[inside]), distance[inside])
    front = minimum_filter(front, size=9)
    surface_depth = distance - front[v, u]
    offset = np.array(relief['crop_origin_px'])
    values = d[tuple(idx.T)]
    for cut in relief['cuts'] + relief['shelves']:
        mask = np.zeros(viewport, 'uint8')
        cv2.fillPoly(mask, [np.array(cut['ring'], 'int32') + offset], 1)
        sd = cv2.distanceTransform(mask, cv2.DIST_L2, 5) - cv2.distanceTransform(1-mask, cv2.DIST_L2, 5)
        width = map_coordinates(sd, [uv[:, 1], uv[:, 0]], order=1) * distance / cam.f
        if 'depth' in cut:
            # The mouth opens into a chamber behind the thin lip. The back tapers to a blind end.
            depth = cut['depth']
            throat = width + 0.018 + 0.055*np.sin(np.pi*np.clip(surface_depth/depth,0,1))
            cut_sdf = np.minimum(throat - np.maximum(0,surface_depth-depth*0.52)*0.13,
                                 depth-surface_depth)
        else:
            # A clipped planar fracture face. Centre each sloping plane on the traced patch.
            patch = width > 0
            visible = patch & (abs(surface_depth) < 0.09)
            cx,cz = np.median(points[visible][:,[0,2]],axis=0)
            plane = cut['front_y'] + cut['dx']*(points[:,0]-cx) + cut['dz']*(points[:,2]-cz)
            cut_sdf = np.minimum(width*0.87,points[:,1]-plane)
        values = np.maximum(values, cut_sdf)
    d[tuple(idx.T)] = values
    warp = noise(shape, rng, extent / 0.68)
    strata = z + 0.19*x - 0.12*y + 0.085*warp
    d += 0.061*warp + 0.032*noise(shape, rng, extent / 0.27)
    d += 0.013*noise(shape, rng, extent / 0.11)
    d += 0.019*np.exp(-np.square(np.sin(strata * 14.0) / 0.27))
    # Angular spalls across every side. Flatten cells in the bedding direction; only
    # some boundaries open into fissures, avoiding an all-over cellular grid.
    near = np.array(np.where(abs(d)<0.24)).T
    q = near*step
    q[:,2] = (q[:,2]+0.19*q[:,0]-0.12*q[:,1])*1.65
    q += (0.047*warp[tuple(near.T)])[:,None]*np.array([0.6,-1,0.53])
    seeds = rng.uniform(q.min(0)-0.6,q.max(0)+0.6,(1250,3))
    dist, cells = cKDTree(seeds).query(q,k=2)
    difference = dist[:,1]-dist[:,0]
    depth = rng.uniform(0.01,0.12,len(seeds))[cells[:,0]]
    randomness = rng.uniform(0,1,len(seeds))[cells[:,0]]
    spall = depth*np.maximum(0,1-difference/0.15)**2
    d[tuple(near.T)] += spall + 0.032*(randomness-0.5)*np.clip(difference/0.05,0,1)
    # Unite sub-voxel flakes with their ledges and discard detached grains. Photograph
    # pixels describe a continuous boulder; isolated crumbs in free space are artefacts.
    d = gaussian_filter(d,0.74)
    connected, _ = label(d < 0)
    counts = np.bincount(connected.ravel())
    main = counts[1:].argmax()+1
    floating = (connected != 0) & (connected != main)
    d[floating] = np.abs(d[floating]) + 0.002
    d = np.maximum(d, 0.708 - z)
    verts, faces, _, _ = marching_cubes(d, level=0, spacing=(step,)*3, allow_degenerate=False)
    # Use the gradient of the solid to orient the mesh (it is negative inside).
    tri = verts[faces]
    n = np.cross(tri[:,1]-tri[:,0], tri[:,2]-tri[:,0])
    at = tuple(np.clip((verts[faces[:,0]]/step).round().astype(int), 0, shape-1).T)
    grads = np.stack([g[at] for g in np.gradient(d)], axis=1)
    if (n * grads).sum() < 0:
        faces = faces[:, ::-1]
    return verts + origin, faces, hull.check(spec, d, origin, step)
