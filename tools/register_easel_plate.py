#!/usr/bin/env python3
"""Clip-specific measured initial registration; not camera/depth reconstruction."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from video_frames import digest, write_json


def register(args):
    plate_path=Path(args.plate).resolve(strict=True);frame_path=Path(args.frame).resolve(strict=True)
    slots=json.loads(Path(args.slots).read_text())
    frames=json.loads(Path(args.frames_manifest).read_text())
    if digest(plate_path)!='bc2f16d0da0820506708ed6110a1fd59c839474b661d32f46ebcfc9ad2edcaf5':
        raise ValueError('This registration is scoped to the supplied exact easel plate')
    out=Path(args.out);out.mkdir(parents=True,exist_ok=False)
    plate=cv2.imread(str(plate_path));frame=cv2.imread(str(frame_path))
    ratio=1280/plate.shape[1];small=cv2.resize(plate,None,fx=ratio,fy=ratio,interpolation=cv2.INTER_AREA)
    mask=np.full(plate.shape[:2],255,np.uint8)
    mask[1400:]=0 # Exclude moving surf and lower feet region.
    for slot in slots:
        points=np.array(slot.get('edge') or slot['quad'],np.int32)
        cv2.fillPoly(mask,[points],0);cv2.polylines(mask,[points],True,0,18)
    mask=cv2.resize(mask,(small.shape[1],small.shape[0]),interpolation=cv2.INTER_NEAREST)
    sift=cv2.SIFT_create(nfeatures=5000)
    ka,da=sift.detectAndCompute(cv2.cvtColor(small,cv2.COLOR_BGR2GRAY),mask)
    kb,db=sift.detectAndCompute(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),None)
    matches=[a for a,b in cv2.BFMatcher().knnMatch(da,db,k=2) if a.distance<.7*b.distance]
    a=np.float32([ka[m.queryIdx].pt for m in matches]);b=np.float32([kb[m.trainIdx].pt for m in matches])
    affine,inliers=cv2.estimateAffine2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=2,maxIters=5000,confidence=.999)
    if affine is None: raise ValueError('No stable initial registration')
    good=inliers[:,0].astype(bool)
    residual=np.linalg.norm(a@affine[:,:2].T+affine[:,2]-b,axis=1)[good]
    spread=np.ptp(a[good],axis=0)
    if int(good.sum())<20 or np.percentile(residual,95)>2 or min(spread)<200:
        raise ValueError('Insufficient source alignment coverage/accuracy')
    review_map=np.vstack([affine,[0,0,1]])@np.diag([ratio,ratio,1])
    native_map=np.diag([frames['source']['nativeWidth']/frame.shape[1],frames['source']['nativeHeight']/frame.shape[0],1])@review_map
    def map_points(points,matrix):
        return (np.c_[np.array(points),np.ones(len(points))]@matrix.T)[:,:2].tolist()
    mapped=[];overlay=frame.copy()
    for slot in slots:
        mapped.append({'id':slot['id'],'depth':slot['depth'],'side':slot['side'],
            'quad':map_points(slot['quad'],native_map),'edge':map_points(slot.get('edge') or slot['quad'],native_map)})
        corners=np.int32(map_points(slot['quad'],review_map))
        cv2.polylines(overlay,[corners],True,(40,255,255),2)
        cv2.putText(overlay,f"{slot['depth']}{slot['side'][0].upper()}",tuple(corners[0]),cv2.FONT_HERSHEY_SIMPLEX,.5,(40,255,255),2)
    cv2.imwrite(str(out/'initial-canvas-corners.jpg'),overlay)
    selected=[m for m,yes in zip(matches,good) if yes]
    visual=cv2.drawMatches(small,ka,frame,kb,selected,None,flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    cv2.imwrite(str(out/'unoccluded-pier-matches.jpg'),visual)
    annotated=small.copy();annotated[mask==0]//=3;cv2.imwrite(str(out/'source-feature-mask.jpg'),annotated)
    result={'schemaVersion':1,'kind':'measured-initial-plate-registration','enabled':False,
        'plateSha256':digest(plate_path),'videoSha256':frames['source']['videoSha256'],
        'firstReviewFrameSha256':digest(frame_path),'sourcePlateSize':[plate.shape[1],plate.shape[0]],
        'nativeVideoSize':[frames['source']['nativeWidth'],frames['source']['nativeHeight']],
        'method':'SIFT on supplied plate excluding all canvas faces/edges and lower moving surf; RANSAC affine to actual first video frame',
        'matches':len(matches),'inliers':int(good.sum()),'medianResidualReviewPx':float(np.median(residual)),
        'p95ResidualReviewPx':float(np.percentile(residual,95)),'inlierSpanReviewPx':spread.tolist(),
        'plateToFirstVideoNative':native_map.tolist(),'slots':mapped,
        'limitations':['Initial static image registration only; no camera solve or world-depth inference.',
            'Existing slot depth labels remain authored arrangement labels, not measured physical depth.',
            'Later per-region2D flow may be used only in a reviewed opt-in experiment; invalid fits cannot become measured geometry.']}
    write_json(out/'initial-registration.json',result)
    print(json.dumps({k:result[k] for k in ('matches','inliers','medianResidualReviewPx','p95ResidualReviewPx','inlierSpanReviewPx','plateToFirstVideoNative')}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('plate','frame','slots','frames-manifest','out'):parser.add_argument('--'+name,required=True)
    register(parser.parse_args())
