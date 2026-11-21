"""Paint material regions against the audited orthographic views of this source."""
import numpy as np

PX = 920 / 1.33


def smooth(a, b, v):
    x = np.clip((v - a) / (b - a), 0, 1)
    return x * x * (3 - 2 * x)


def profile(x, *points):
    return np.interp(x, *zip(*points))


def polygon(x, y, points, feather=2):
    inside = np.zeros(x.shape, dtype=bool)
    nearest = np.full(x.shape, 1e12)
    for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
        dx, dy = bx - ax, by - ay
        if dy:
            inside ^= ((ay > y) != (by > y)) & (x < dx * (y - ay) / dy + ax)
        t = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        nearest = np.minimum(nearest, (x - ax - dx * t)**2 + (y - ay - dy * t)**2)
    d = np.sqrt(nearest) * np.where(inside, 1, -1)
    return smooth(-feather, feather, d)


def coordinates(source):
    x, y, f = source.T
    return 380 + x * PX, 460 - (y - .58) * PX, 380 + (.021 - f) * PX


def regions(source):
    x, y, side = coordinates(source)
    a = np.abs(x - 380)
    front = smooth(376, 417, side)
    # Trace the source cuffs in front view, then use side view to preserve the round sleeve shape.
    cuff_y = profile(a, (100, 326), (110, 322), (126, 315), (146, 304), (160, 298))
    bare_arm = smooth(99, 112, a) * smooth(cuff_y - 2, cuff_y + 3, y)
    bare_arm *= 1 - smooth(512, 521, y)
    neck_limit = profile(a, (0, 210), (28, 195), (33, 187), (47, 169), (64, 167))
    bare_head = 1 - smooth(neck_limit - 2, neck_limit + 2, y)
    bare_head *= 1 - smooth(41, 55, a) * smooth(145, 170, y)
    front_hair = polygon(x, y, [(318, 35), (435, 35), (441, 106), (423, 113), (416, 102),
                               (415, 113), (399, 111), (384, 101), (379, 118), (373, 95),
                               (366, 92), (359, 105), (351, 117), (341, 125), (329, 118)], 2)
    side_hair = polygon(side, y, [(302, 38), (449, 38), (443, 144), (406, 157),
                                  (391, 143), (384, 122), (363, 117), (345, 126), (325, 110)], 2.6)
    hair = (1 - front) * front_hair + front * side_hair
    back_hair = 1 - smooth(155, 161, y)
    hair = hair * (1 - smooth(412, 437, side)) + back_hair * smooth(412, 437, side)
    bare_head *= 1 - hair
    # Back volume and the two straps are fused to the original shirt. Restrict side
    # masks by torso width so they cannot tint the arm passing in front of the pack.
    pack = polygon(side, y, [(430,195), (441,199), (454,225), (493,225), (530,249),
                              (538,443), (435,440), (430,398), (432,270)], 2.5)
    pack *= (1 - smooth(68, 82, a))
    straps = polygon(a, y, [(48,187), (72,188), (78,205), (78,227), (85,379), (74,382),
                            (68,303), (61,296), (58,251), (51,220)], 2)
    straps *= smooth(187, 193, y) * (1 - smooth(423, 447, side))
    # Exclude the sleeve and face, and extend onto the rounded shoulder crest.
    rear_straps = polygon(a, y, [(43,185), (61,185), (73,199), (66,213),
                                   (55,226), (39,238), (31,233), (36,216)], 2.0)
    rear_straps *= smooth(401, 432, side)
    straps = np.maximum(straps, rear_straps) * (1 - bare_arm)
    bag = np.maximum(pack, straps)
    hem = profile(a, (0, 477), (44, 478), (80, 476), (125, 474))
    pants = smooth(hem - 1.8, hem + 2, y)
    shoe_top = profile(side, (302, 834), (331, 827), (353, 819), (389, 823), (429, 824), (463, 829))
    shoes = smooth(shoe_top - 2, shoe_top + 2, y)
    return x, y, side, a, hair, np.maximum(bare_head, bare_arm), bag, straps, pants, shoes


def paint(source):
    x, y, side, a, hair, skin, bag, straps, pants, shoes = regions(source)
    front = 1 - smooth(353, 403, side)
    rear = smooth(450, 475, side)
    # Colors here are sRGB swatches sampled and tuned under the neutral studio key.
    base = np.tile(np.array([.93, .93, .885]), (len(x), 1))
    rough = np.full(len(x), .81)

    def layer(amount, rgb, r):
        base[:] += amount[:, None] * (np.asarray(rgb) - base)
        rough[:] += amount * (r - rough)

    layer(.43 * np.exp(-((y - 472) / 1.8)**2) * (1-pants), [.69, .72, .69], .86)
    fold = .11 * (.5 + .5 * np.sin(x * .046 + y * .014)) * np.sin(y * .011)**2
    layer(pants, [.23, .515, .607], .83)
    layer(fold * pants, [.105, .31, .42], .87)
    piped = np.exp(-((a - profile(y, (480, 80), (556, 77), (657, 72), (742, 78), (805, 79))) / 1.1)**2)
    layer(pants * piped * (1 - front) * .48, [.32, .59, .68], .82)
    layer(shoes, [.88, .887, .85], .72)
    layer(shoes * smooth(847, 853, y), [.69, .71, .68], .88)
    layer(shoes * smooth(856, 861, y), [.42, .45, .43], .83)
    layer(skin, [.728, .505, .39], .61)
    layer(skin * .45 * (1 - smooth(11, 35, np.abs(y-128))), [.754, .524, .402], .56)
    layer(skin * .34 * np.exp(-((y-149)/2.35)**2) * (1-smooth(11,19,a)) * front, [.48, .235, .19], .58)
    eyebrows = np.exp(-((y - profile(a, (3, 118), (12, 115), (25, 116), (33, 122))) / 1.55)**2)
    eyebrows *= smooth(3, 7, a) * (1 - smooth(23, 29, a)) * front
    layer(eyebrows * skin * .73, [.145, .095, .079], .73)
    # Follow the shallow sculpted eyelid aperture. The mesh has no separate eyeballs.
    aperture = np.exp(-((y - profile(a, (5,124), (10,121), (17,121), (24,123), (28,125))) / 1.12)**2)
    aperture *= smooth(7, 9, a) * (1 - smooth(22, 26, a)) * front * skin
    layer(aperture * .86, [.77, .71, .62], .46)
    layer(aperture * np.exp(-((a - 15.4) / 2.9)**2), [.098, .072, .056], .46)
    layer(hair, [.105, .083, .075], .57)
    layer(.26 * hair * (.5 + .5 * np.sin(x * .18 + y * .12 + side*.20)), [.23, .17, .133], .51)
    layer(bag, [.61, .337, .194], .86)
    layer(straps * .56, [.41, .202, .115], .89)
    pocket = polygon(a, y, [(0,328), (45,328), (51,339), (49,408), (43,415), (0,419), (-2,374)], 2.6)
    layer(pocket * rear * bag * .77, [.70,.374,.204], .81)
    layer(rear * bag * (.62 * np.exp(-((y-358)/1.75)**2) + .58 * np.exp(-((y-420)/2.0)**2)), [.36,.18,.11], .74)
    buckles = polygon(a,y,[(70,282),(84,282),(84,297),(71,298)],1.25)
    layer(buckles * straps * front, [.245,.23,.195], .50)
    # Fine coordinate-space variation stays continuous across UV islands.
    weave = np.sin(x * 1.43 + y * .73) * np.sin(y * 1.52 + side * 1.01)
    grain = np.sin(x * 2.49 + y * 3.87 + side * 2.33)
    cloth = np.maximum(pants * (1-shoes), bag)
    cloth = np.maximum(cloth, (1 - np.maximum(skin, hair)) * (1 - shoes))
    base *= (1 + .018 * grain + .039 * weave * cloth)[:, None]
    rough = np.clip(rough + cloth * weave * .035, .38, .94)
    linear = np.where(base <= .04045, base / 12.92, ((base + .055) / 1.055)**2.4)
    return linear.astype(np.float32), rough.astype(np.float32)
