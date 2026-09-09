#!/usr/bin/env python3
"""One-frame source alignment diagnostic; not video/easel tracking."""
import argparse
from pathlib import Path
import cv2
import numpy as np
from video_frames import write_json, digest


def compare(args):
    original=cv2.imread(args.original)
    frame=cv2.imread(args.frame)
    scale=min(1280/original.shape[1],1)
    resized=cv2.resize(original,None,fx=scale,fy=scale,interpolation=cv2.INTER_AREA)
    sift=cv2.SIFT_create(nfeatures=3500)
    key_a,desc_a=sift.detectAndCompute(cv2.cvtColor(resized,cv2.COLOR_BGR2GRAY),None)
    key_b,desc_b=sift.detectAndCompute(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),None)
    matches=cv2.BFMatcher().knnMatch(desc_a,desc_b,k=2)
    good=[a for a,b in matches if a.distance<.7*b.distance]
    a=np.float32([key_a[m.queryIdx].pt for m in good]);b=np.float32([key_b[m.trainIdx].pt for m in good])
    transform,inliers=cv2.estimateAffine2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=2,maxIters=4000,confidence=.999)
    if transform is None:
        raise ValueError('No source-frame alignment found')
    mask=inliers[:,0].astype(bool)
    residual=np.linalg.norm(a@transform[:,:2].T+transform[:,2]-b,axis=1)[mask]
    inverse=cv2.invertAffineTransform(transform)
    video_corners=np.array([[0,0],[frame.shape[1],0],[frame.shape[1],frame.shape[0]],[0,frame.shape[0]]])
    source_corners=(video_corners@inverse[:,:2].T+inverse[:,2])/scale
    result={'kind':'single-frame-source-alignment-only','originalSha256':digest(Path(args.original)),
        'frameSha256':digest(Path(args.frame)),'originalDimensions':[original.shape[1],original.shape[0]],
        'frameDimensions':[frame.shape[1],frame.shape[0]],'matches':len(good),'inliers':int(mask.sum()),
        'medianResidualPx':float(np.median(residual)),'p95ResidualPx':float(np.percentile(residual,95)),
        'originalResizedToFrameAffine':transform.tolist(),'frameBoundsInOriginalPixels':source_corners.tolist(),
        'limitation':'RANSAC alignment of static image features; does not establish unchanged pixels, color identity or physical camera motion.'}
    write_json(Path(args.out),result)
    print(result)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original',required=True);parser.add_argument('--frame',required=True);parser.add_argument('--out',required=True)
    compare(parser.parse_args())
