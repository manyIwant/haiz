"""Extract the visible paint outlines from three stone panels, without embedding photos.
Run with Python + OpenCV: trace_stone_lettering.py /path/to/full/HAIZ/checkout
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np

OUTPUT=Path(__file__).resolve().parents[1]/'evidence/calibration/stone_lettering.json'
# Perspective crops bound the paint only. All saved contours return to original pixels.
PANELS={
    'taihu':('web/jiaoxuelou-1600.jpg',[(393,924),(621,937),(621,969),(393,955)],(912,124)),
    'donor':('web/jiaoxuelou-1600.jpg',[(966,982),(1056,986),(1056,1010),(966,1006)],(540,132)),
    'pond':('campus/campus_yanchi.jpg',[(234,182),(382,182),(382,635),(234,635)],(444,1359)),
}


def trace(image,quad,size,name,dense=False):
    w,h=size
    target=np.float32([(0,0),(w,0),(w,h),(0,h)])
    M=cv2.getPerspectiveTransform(np.float32(quad),target)
    crop=cv2.warpPerspective(image,M,size,flags=cv2.INTER_CUBIC)
    b,g,r=cv2.split(crop.astype('float32'))
    if name=='pond':
        chroma=r-np.maximum(g,b)
        seed=(chroma>np.maximum(11,.21*r)) & (r>49)
        if dense:
            mask=(chroma>np.maximum(24,.30*r)) & (r>87)
        else:
            support=(chroma>np.maximum(4,.135*r)) & (r>24)
            _,components=cv2.connectedComponents(np.uint8(support))
            mask=support & np.isin(components,np.unique(components[seed & support]))
            mask=cv2.morphologyEx(np.uint8(mask),cv2.MORPH_CLOSE,np.ones((5,3),np.uint8))>0
        if not dense:
            # The long hairline beside the lower character crosses dark rock.
            # Trace only its visible centre between the two stronger red ends.
            hair=np.float32([[(284.5,487.0)],[(282.1,510.0)],[(279.9,535.6)],[(277.3,561.2)],[(276.2,579.0)]])
            guide=np.zeros((h,w),np.uint8)
            cv2.polylines(guide,[np.int32(cv2.perspectiveTransform(hair,M))],False,1,3)
            mask|=guide.astype(bool)
        # Exclude patches of orange stone surrounding the script, retain the small seals.
        mask&=(np.indices((h,w))[0]>8)
    else:
        gray=.26*r+.53*g+.21*b
        local=cv2.GaussianBlur(gray,(0,0),14 if name=='taihu' else 11)
        if dense:
            mask=gray>np.maximum(121 if name=='taihu' else 104,local+(29 if name=='taihu' else 25))
        else:
            mask=(gray>np.maximum(89 if name=='taihu' else 76,local+(12 if name=='taihu' else 9)))
    binary=np.uint8(mask)*255
    contours,hier=cv2.findContours(binary,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    inverse=np.linalg.inv(M)
    polygons=[]
    def restore(contour):
        pts=cv2.approxPolyDP(contour,.74,True).astype('float32')
        return np.round(cv2.perspectiveTransform(pts,inverse)[:,0,:],2).tolist()
    for i,outer in enumerate(contours):
        if hier[0,i,3]!=-1 or cv2.contourArea(outer)<{'pond':17,'taihu':11,'donor':14}[name]: continue
        pts=restore(outer)
        if len(pts)<3:continue
        holes=[]
        child=hier[0,i,2]
        while child!=-1:
            inner=restore(contours[child])
            if len(inner)>=3 and cv2.contourArea(contours[child])>6:holes.append(inner)
            child=hier[0,child,0]
        polygons.append([pts,*holes])
    return polygons,crop,binary


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('checkout',type=Path)
    parser.add_argument('--review',type=Path);args=parser.parse_args()
    panels={}
    for name,(path,quad,size) in PANELS.items():
        im=cv2.imread(str(args.checkout/'assets/images'/path))
        if im is None:raise FileNotFoundError(path)
        polygons,crop,binary=trace(im,quad,size,name)
        dense,_,_=trace(im,quad,size,name,True)
        panels[name]={'source':'assets/images/'+path,'outlines_px':polygons,'dense_px':dense}
        if args.review:
            args.review.mkdir(parents=True,exist_ok=True)
            out=crop.copy();out[binary>0]=(10,220,240)
            cv2.imwrite(str(args.review/(name+'.jpg')),out)
    OUTPUT.write_text(json.dumps({'basis':'Visible light mineral and vermilion paint boundaries. Small signatures and seals are outlines of surviving marks; names and missing strokes not transcribed.','panels':panels},ensure_ascii=False,separators=(',',':'))+'\n')


if __name__=='__main__':main()
