"""Pack this Blender GLB's untransformed meshes into a synchronous ES module.

This intentionally rejects unsupported transforms rather than silently changing them.
Usage: python3 convert_glb.py input.glb output.js
"""
import base64
import json
import struct
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
raw = source.read_bytes()
assert raw[:4] == b'glTF'
json_length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_length])
binary_start = 20 + json_length + 8
binary = raw[binary_start:]

def accessor(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    typ = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
    width = struct.calcsize('<' + typ) * count
    stride = view.get('byteStride', width)
    offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + typ * count, binary, offset + i * stride) for i in range(a['count'])]

groups = {}
for node in doc['nodes']:
    if 'mesh' not in node:
        continue
    assert not any(key in node for key in ('matrix', 'scale', 'rotation', 'children'))
    translation = node.get('translation', [0, 0, 0])
    role = node['extras']['part_role']
    if any(label in node['name'].lower() for label in ('sliding mast guide', 'mast rack', 'mast crown', 'mast ratchet')):
        role = 'mast'
    for primitive in doc['meshes'][node['mesh']]['primitives']:
        material = doc['materials'][primitive['material']]['name']
        key = (role, material)
        group = groups.setdefault(key, {'role': role, 'material': material, 'position': [], 'normal': [], 'uv': [], 'indices': [], 'parts': []})
        offset = len(group['position']) // 3
        position = accessor(primitive['attributes']['POSITION'])
        normal = accessor(primitive['attributes']['NORMAL'])
        uv = accessor(primitive['attributes']['TEXCOORD_0'])
        for p, n, t in zip(position, normal, uv):
            group['position'].extend(p[i] + translation[i] for i in range(3))
            group['normal'].extend(n)
            group['uv'].extend(t)
        group['indices'].extend(x[0] + offset for x in accessor(primitive['indices']))
        group['parts'].append(node['name'])

def encoded(values, fmt):
    return base64.b64encode(struct.pack('<' + fmt * len(values), *values)).decode('ascii')

payload=[]
for group in groups.values():
    payload.append({**{k:group[k] for k in ('role','material','parts')},
      'position': encoded(group['position'],'f'), 'normal':encoded(group['normal'],'f'),
      'uv':encoded(group['uv'],'f'), 'indices':encoded(group['indices'],'H')})
text='// Generated from crafted-easel.glb, authored in Blender 5.2.1. Do not edit by hand.\n'
text+='const decode = (s, Type) => { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new Type(b.buffer); };\n'
text+='const packed = ' + json.dumps(payload,separators=(',',':')) + ';\n'
text+='export const easelParts = packed.map(p => ({ ...p, position: decode(p.position, Float32Array), normal: decode(p.normal, Float32Array), uv: decode(p.uv, Float32Array), indices: decode(p.indices, Uint16Array) }));\n'
text+='export const easelAssetInfo = Object.freeze({ units:"metres", up:"Y", front:"+Z", source:"Blender 5.2.1 LTS", timber:"Poly Haven Coated Pine CC0", bodyHeight:2.20, footBottom:-0.10, shelfDatum:0, clampDatum:0 });\n'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(text)
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'drawParts':len(payload),'triangles':sum(len(g['indices'])//3 for g in groups.values()),'vertices':sum(len(g['position'])//3 for g in groups.values())}))
