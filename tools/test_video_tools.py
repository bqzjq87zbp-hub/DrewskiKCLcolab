#!/usr/bin/env python3
import copy
import unittest
from validate_tracking import validate, valid_quad


class TrackingTests(unittest.TestCase):
    def setUp(self):
        self.frames={'source':{'videoSha256':'a'*64,'nativeWidth':1280,'nativeHeight':960,'timestampOrigin':0},
                     'frames':[{'index':0},{'index':2}]}
        self.timeline=[{'index':i,'time':i/24} for i in range(3)]
        self.track={'schemaVersion':1,'enabled':False,'reviewStatus':'pending','method':'none',
            'videoSha256':'a'*64,'coordinateSpace':{'kind':'native-video-pixels','width':1280,
            'height':960,'origin':'top-left','quadOrder':'TL,TR,BR,BL'},'timestampOrigin':0,
            'interpolation':'none','slotIds':[],'frames':[],'review':None}

    def test_pending_scaffold_is_not_enabled(self):
        result=validate(self.track,self.frames,self.timeline)
        self.assertFalse(result['enabled'])
        self.assertIn('NOT assessed',result['trackingQuality'])

    def test_scaffold_cannot_pass_reviewed_gate(self):
        with self.assertRaisesRegex(ValueError,'not reviewed'):
            validate(self.track,self.frames,self.timeline,True)

    def test_hash_drift_rejected(self):
        self.track['videoSha256']='b'*64
        with self.assertRaisesRegex(ValueError,'hash mismatch'):
            validate(self.track,self.frames,self.timeline)

    def test_guessed_interpolation_rejected(self):
        self.track['interpolation']='linear'
        with self.assertRaisesRegex(ValueError,'Interpolation'):
            validate(self.track,self.frames,self.timeline)

    def test_dimensions_rejected(self):
        self.track['coordinateSpace']['width']=1920
        with self.assertRaisesRegex(ValueError,'Coordinate'):
            validate(self.track,self.frames,self.timeline)

    def test_convex_quads_only(self):
        self.assertTrue(valid_quad([[0,0],[10,0],[10,10],[0,10]]))
        self.assertFalse(valid_quad([[0,0],[10,10],[10,0],[0,10]]))
        self.assertFalse(valid_quad([[0,0],[0,0],[0,0],[0,0]]))
        self.assertFalse(valid_quad([[0,0],[float('nan'),0],[10,10],[0,10]]))

    def test_published_stride_coverage(self):
        track=copy.deepcopy(self.track)
        track.update(enabled=True,reviewStatus='reviewed',method='manual-per-frame',slotIds=['TEST_ONLY'],
            review={'reviewer':'synthetic-test','reviewedAt':'test','evidence':['synthetic'],'limitations':['Not actual tracking']})
        track['frames']=[{'index':i,'time':i/24,'slots':[{'id':'TEST_ONLY','visible':False,
            'quad':None,'confidence':1}]} for i in (0,2)]
        self.assertEqual(validate(track,self.frames,self.timeline,True)['coveredFrames'],2)
        track['frames'].pop()
        with self.assertRaisesRegex(ValueError,'published frames'):
            validate(track,self.frames,self.timeline,True)


if __name__=='__main__':
    unittest.main()
