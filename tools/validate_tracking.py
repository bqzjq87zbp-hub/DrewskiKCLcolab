#!/usr/bin/env python3
"""Structural tracking validation only: never a substitute for visual proof."""
import argparse
import json
import math


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def valid_quad(quad):
    if not isinstance(quad, list) or len(quad) != 4:
        return False
    if any(not isinstance(p, list) or len(p) != 2 or not all(map(finite, p)) for p in quad):
        return False
    crosses = []
    for i in range(4):
        a, b, c = quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]
        crosses.append((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]))
    return all(c > 1e-6 for c in crosses)


def validate(track, frames, timeline, reviewed=False):
    require(track.get('schemaVersion') == 1, 'Unsupported schema')
    source = frames['source']
    require(track.get('videoSha256') == source['videoSha256'], 'Video hash mismatch')
    space = track.get('coordinateSpace', {})
    require(space == {'kind': 'native-video-pixels', 'width': source['nativeWidth'],
        'height': source['nativeHeight'], 'origin': 'top-left', 'quadOrder': 'TL,TR,BR,BL'},
        'Coordinate space mismatch')
    require(track.get('timestampOrigin') == source['timestampOrigin'], 'Timestamp origin mismatch')
    require(track.get('interpolation') == 'none', 'Interpolation is not approved by this contract')
    ids = track.get('slotIds', [])
    require(isinstance(ids, list) and all(isinstance(i, str) and i for i in ids)
            and len(ids) == len(set(ids)), 'Slot IDs must be unique strings')
    observations = track.get('frames', [])
    require(isinstance(observations, list), 'frames must be an array')
    seen = set()
    for observation in observations:
        index = observation.get('index')
        require(type(index) is int and 0 <= index < len(timeline) and index not in seen,
                'Invalid or duplicate frame index')
        seen.add(index)
        require(finite(observation.get('time')) and
            abs(observation['time'] - timeline[index]['time']) < 1e-6, 'Frame timestamp mismatch')
        slots = observation.get('slots', [])
        require(len(slots) == len(ids) and {s.get('id') for s in slots} == set(ids),
                'Every frame must explicitly account for every slot')
        for slot in slots:
            require(type(slot.get('visible')) is bool, 'Visibility must be explicit')
            require(finite(slot.get('confidence')) and 0 <= slot['confidence'] <= 1,
                    'Confidence must be between0 and1')
            if slot['visible']:
                require(valid_quad(slot.get('quad')), 'Quad must be finite, convex, clockwise TL/TR/BR/BL')
                require(type(slot.get('depthOrder')) is int, 'Visible slot needs integer depthOrder')
                require(isinstance(slot.get('evidence'), list) and slot['evidence'], 'Visible slot needs evidence')
            else:
                require(slot.get('quad') is None, 'Invisible slot must not retain a clickable quad')
    require(type(track.get('enabled')) is bool, 'Enabled must be a boolean')
    if reviewed or track['enabled']:
        require(track['enabled'] and track.get('reviewStatus') == 'reviewed', 'Tracking is not reviewed/enabled')
        require(track.get('method') in ('manual-per-frame', 'camera-solve-projected'), 'Unapproved tracking method')
        require(ids and seen == {frame['index'] for frame in frames['frames']},
                'All published frames and slots need explicit coverage')
        review = track.get('review') or {}
        require(all(review.get(k) for k in ('reviewer', 'reviewedAt', 'evidence', 'limitations')),
                'Review identity/evidence/limitations are required')
    else:
        require(track.get('reviewStatus') == 'pending', 'Disabled scaffold must remain pending')
    return {'structuralValidation': 'pass', 'enabled': track['enabled'],
            'trackingQuality': 'NOT assessed by this tool', 'coveredFrames': len(seen)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tracking')
    parser.add_argument('--frames', required=True)
    parser.add_argument('--timeline', required=True)
    parser.add_argument('--require-reviewed', action='store_true')
    args = parser.parse_args()
    def read(path):
        with open(path) as stream:
            return json.load(stream)
    print(json.dumps(validate(read(args.tracking), read(args.frames), read(args.timeline), args.require_reviewed)))


if __name__ == '__main__':
    main()
