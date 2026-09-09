#!/usr/bin/env python3
"""Bounded diagnostic: original-frame rigid-pier feature flow, NOT a3D solve.

Manual image-space feature regions are hypotheses, not measured world-depths.
Never activates runtime tracking. OpenCV + NumPy required; no network/install.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from video_frames import write_json, digest, contact_sheet

# Coordinates refer to the inspected1280x960 first generated frame only.
# No water/sky feature regions. These must not be reused for another clip.
REGIONS = [
    [[[225,199],[1044,207],[1044,245],[224,235]], [[475,280],[493,280],[467,805],[438,805]], [[718,282],[741,282],[776,811],[751,811]]],
    [[[414,466],[887,475],[887,499],[410,491]], [[538,526],[554,526],[538,801],[521,801]], [[661,525],[678,525],[697,800],[680,800]]],
    [[[491,597],[799,600],[801,621],[490,622]], [[575,638],[588,638],[577,797],[563,797]], [[638,637],[651,637],[661,797],[647,797]]],
    [[[550,681],[726,681],[727,696],[549,697]], [[594,706],[605,706],[599,797],[588,797]], [[625,706],[636,706],[641,797],[630,797]]],
    [[[581,739],[677,739],[678,751],[580,752]], [[605,754],[613,754],[610,798],[602,798]], [[618,754],[627,754],[632,798],[623,798]]]
]
COLORS = [(40,70,255),(60,210,255),(70,235,90),(245,200,40),(255,80,225)]


def probe(args):
    folder = Path(args.frames).resolve(strict=True)
    manifest = json.loads((folder / 'frames.json').read_text())
    if manifest['source']['videoSha256'] != '4d8fa4dbf444ebbcdde91ed6ac91859463f387b16f0b7a30ff6497b31948dd8a':
        raise ValueError('Manual regions belong to one exact reviewed clip only')
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=False)
    first = cv2.imread(str(folder / manifest['frames'][0]['file']))
    if first.shape[:2] != (960,1280):
        raise ValueError('Probe requires inspected1280x960 frames')
    gray = cv2.cvtColor(first, cv2.COLOR_BGR2GRAY)
    points, groups = [], []
    annotation = first.copy()
    for depth, polygons in enumerate(REGIONS, 1):
        mask = np.zeros(gray.shape, np.uint8)
        for polygon in polygons:
            cv2.fillPoly(mask, [np.array(polygon,np.int32)], 255)
            cv2.polylines(annotation,[np.array(polygon,np.int32)],True,COLORS[depth-1],2)
        found = cv2.goodFeaturesToTrack(gray, maxCorners=180, qualityLevel=.008,
            minDistance=4, mask=mask, blockSize=5)
        if found is not None:
            points.extend(found[:,0].tolist());groups.extend([depth]*len(found))
    originals = np.array(points,np.float32).reshape(-1,1,2)
    positions = originals.copy(); group_array = np.array(groups)
    alive = np.ones(len(points), bool)
    cv2.imwrite(str(out/'feature-regions.jpg'), annotation)
    results, screenshot_paths, labels = [], [], []
    lk = dict(winSize=(31,31),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,40,.01))
    native = manifest['source']
    scale = np.diag([1280/native['nativeWidth'],960/native['nativeHeight'],1.0])
    for number, record in enumerate(manifest['frames']):
        image = first if number == 0 else cv2.imread(str(folder/record['file']))
        current = cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
        forward_back = np.zeros(len(points))
        if number:
            active_indices = np.where(alive)[0]
            if len(active_indices):
                old = positions[active_indices]
                new,status,_ = cv2.calcOpticalFlowPyrLK(gray,current,old,None,**lk)
                back,back_status,_ = cv2.calcOpticalFlowPyrLK(current,gray,new,None,**lk)
                error = np.linalg.norm(back-old,axis=2).reshape(-1)
                xy = new[:,0]
                good = (status[:,0]==1)&(back_status[:,0]==1)&(error<=1.0)&np.isfinite(xy).all(axis=1)&(xy[:,0]>=4)&(xy[:,0]<1276)&(xy[:,1]>=4)&(xy[:,1]<956)
                alive[active_indices[~good]] = False
                positions[active_indices] = new
                forward_back[active_indices] = error
        observations = []
        for depth in range(1,6):
            indices = np.where(alive&(group_array==depth))[0]
            origin = originals[indices,0];target=positions[indices,0]
            item = {'depth':depth,'initialFeatures':int(np.sum(group_array==depth)),
                    'survivingFeatures':len(indices),'valid':False,'affine':None}
            if len(indices)>=8:
                matrix,inliers = cv2.estimateAffine2D(origin,target,method=cv2.RANSAC,
                    ransacReprojThreshold=2.0,maxIters=2500,confidence=.995,refineIters=15)
                if matrix is not None:
                    inside=inliers[:,0].astype(bool)
                    prediction=origin@matrix[:,:2].T+matrix[:,2]
                    residual=np.linalg.norm(prediction-target,axis=1)[inside]
                    spread=np.ptp(target[inside],axis=0) if inside.any() else np.zeros(2)
                    valid=int(inside.sum())>=8 and float(np.median(residual))<=1.5 and float(np.percentile(residual,95))<=3 and min(spread)>=20
                    transform=np.linalg.inv(scale)@np.vstack([matrix,[0,0,1]])@scale
                    a,c,e=transform[0];b,d,f=transform[1]
                    item.update({'valid':bool(valid),'inliers':int(inside.sum()),
                        'inlierFraction':float(inside.mean()),'medianResidualPx':float(np.median(residual)),
                        'p95ResidualPx':float(np.percentile(residual,95)),
                        'spreadPx':spread.tolist(),'medianForwardBackwardPx':float(np.median(forward_back[indices])),
                        'affine':[float(v) for v in [a,b,c,d,e,f]] if valid else None})
            observations.append(item)
        results.append({'index':record['index'],'time':record['time'],'groups':observations})
        if number in (0,24,48,60,72,96,120):
            for i in np.where(alive)[0]:
                x,y=positions[i,0];cv2.circle(image,(round(float(x)),round(float(y))),3,COLORS[group_array[i]-1],-1)
            for i,item in enumerate(observations):
                cv2.putText(image,f"G{item['depth']}: {item['survivingFeatures']} / {'FIT' if item['valid'] else 'FAIL'}",(20,30+i*26),cv2.FONT_HERSHEY_SIMPLEX,.6,COLORS[i],2)
            path=out/f"flow-{record['index']:04d}.jpg";cv2.imwrite(str(path),image)
            screenshot_paths.append(path);labels.append(f"{record['time']:.3f}s - surviving original points")
        gray=current
    summary=[]
    for depth in range(1,6):
        good=[r for r in results if r['groups'][depth-1]['valid']]
        failures=[r['time'] for r in results if not r['groups'][depth-1]['valid']]
        summary.append({'depth':depth,'validSamples':len(good),'totalSamples':len(results),
            'firstFailureTime':failures[0] if failures else None,'lastValidTime':good[-1]['time'] if good else None})
    write_json(out/'flow-evidence.json',{'schemaVersion':1,'enabled':False,
        'reviewStatus':'diagnostic-only','videoSha256':native['videoSha256'],
        'method':'Original-frame Shi-Tomasi points; sequential pyramidal LK;<=1px forward/backward filter; RANSAC2D affine per manual structural feature region',
        'limitations':['Manual regions are apparent near/far hypotheses, not measured world depth.',
            'Affine residuals measure agreement of surviving points, not ground-truth easel placement.',
            'No feature replenishment; leaving-view and lost tracks are reported, not invented.',
            'No water features, no3D reconstruction, no enabled easel tracking.'],
        'regionPolygonsAt1280':REGIONS,'summary':summary,'frames':results})
    contact_sheet(screenshot_paths,labels,out/'flow-contact-sheet.jpg')
    print(json.dumps(summary))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frames',required=True);parser.add_argument('--out',required=True)
    probe(parser.parse_args())
