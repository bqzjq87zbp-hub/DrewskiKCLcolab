import bpy, math, json
from pathlib import Path
asset_dir=Path(__file__).resolve().parent
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.name='KCL isolated crafted timber easel'
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1.0
asset_collection=bpy.data.collections.new('Crafted easel - export only')
scene.collection.children.link(asset_collection)
asset_objects=[]

def material(name,color,roughness,metallic=0.0):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metallic
    return mat
wood=material('timber',(1,1,1),.70)
n=wood.node_tree.nodes
links=wood.node_tree.links
bsdf=n.get('Principled BSDF')
diff=n.new('ShaderNodeTexImage')
diff.image=bpy.data.images.load(str(asset_dir/'coated_pine_diff_1k.jpg'))
diff.image.pack()
links.new(diff.outputs['Color'],bsdf.inputs['Base Color'])
rough=n.new('ShaderNodeTexImage')
rough.image=bpy.data.images.load(str(asset_dir/'coated_pine_rough_1k.jpg'))
rough.image.colorspace_settings.name='Non-Color'
rough.image.pack()
links.new(rough.outputs['Color'],bsdf.inputs['Roughness'])
normal=n.new('ShaderNodeTexImage')
normal.image=bpy.data.images.load(str(asset_dir/'coated_pine_nor_gl_1k.jpg'))
normal.image.colorspace_settings.name='Non-Color'
normal.image.pack()
norm=n.new('ShaderNodeNormalMap')
norm.inputs['Strength'].default_value=.22
links.new(normal.outputs['Color'],norm.inputs['Color'])
links.new(norm.outputs['Normal'],bsdf.inputs['Normal'])
steel=material('hardware',(.18,.19,.18),.39,.72)
black=material('dark_details',(.012,.014,.014),.76,.20)
brass=material('brass',(.31,.22,.12),.46,.66)
def cv(a):
    return Vector((a[0],-a[2],a[1]))
def add_asset(obj,name,role,mat):
    obj.name=name
    obj['part_role']=role
    obj['asset_author']='KCL Blender build 2026-09-09'
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    asset_collection.objects.link(obj)
    obj.data.materials.append(mat)
    asset_objects.append(obj)
    return obj
def beam(name,a,b,width=.056,depth=.052,role='body',mat=wood,bevel=.0025):
    start,end=cv(a),cv(b)
    length=(end-start).length
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=add_asset(bpy.context.object,name,role,mat)
    o.scale=(width,depth,length)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    # Align the horizontal grain in the online pine material along each board.
    uv=o.data.uv_layers.active
    seed=len(asset_objects)*.071
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            endgrain=abs(poly.normal.z)>.7
            along=(co.y if endgrain else co.z)/.7
            across=(co.x if abs(poly.normal.x)<.7 else co.y)/.7
            uv.data[li].uv=(along+seed,across+.12+(seed%0.57))
    mod=o.modifiers.new('Soft worked timber edges','BEVEL')
    mod.width=min(bevel,width*.15,depth*.15)
    mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in o.data.polygons:
        poly.use_smooth=True
    mod=o.modifiers.new('Board face normals','WEIGHTED_NORMAL')
    mod.keep_sharp=True
    mod.weight=40
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.rotation_mode='QUATERNION'
    o.rotation_quaternion=(end-start).to_track_quat('Z','Y')
    o.location=(start+end)/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return o
def cylinder(name,at,radius=.008,length=.012,axis=(0,0,1),role='body',mat=steel,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=length)
    o=add_asset(bpy.context.object,name,role,mat)
    o.rotation_mode='QUATERNION'
    o.rotation_quaternion=cv(axis).to_track_quat('Z','Y')
    o.location=cv(at)
    mod=o.modifiers.new('Machined edge','BEVEL')
    mod.width=.00065
    mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    mod=o.modifiers.new('Hardware normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return o
def bolt(name,at,role='body',radius=.007):
    x,y,z=at
    cylinder(name+' washer',(x,y,z),radius*1.65,.0018,role=role,mat=brass)
    cylinder(name+' screw',(x,y,z+.003),radius,.005,role=role,mat=steel)
    beam(name+' screw slot',(x-radius*.68,y,z+.006),(x+radius*.68,y,z+.006),.0012,.0008,role,black,.0002)
def wingnut(name,at,role='body'):
    x,y,z=at
    cylinder(name+' washer',(x,y,z),.018,.002,role=role,mat=brass)
    cylinder(name+' centre',(x,y,z+.011),.010,.023,role=role,mat=steel)
    beam(name+' left wing',(x-.024,y+.009,z+.020),(x-.008,y,z+.020),.011,.006,role,steel,.002)
    beam(name+' right wing',(x+.008,y,z+.020),(x+.024,y+.009,z+.020),.011,.006,role,steel,.002)

beam('Left splayed front leg',(-.43,-.095,.090),(-.135,1.82,-.062))
beam('Right splayed front leg',(.43,-.095,.090),(.135,1.82,-.062))
beam('Hinged rear support',(0,-.095,-.69),(0,1.70,-.108),.052,.048)
beam('Lower mortised stretcher',(-.35,.43,.046),(.35,.43,.046),.060,.042)
beam('Upper mortised stretcher',(-.172,1.57,-.040),(.172,1.57,-.040),.065,.045)
# Two guided rails form a visible recess, and a centre rack carries the shelf.
beam('Left sliding mast guide',(-.022,.35,-.010),(-.022,2.20,-.010),.028,.036)
beam('Right sliding mast guide',(.022,.35,-.010),(.022,2.20,-.010),.028,.036)
beam('Recessed mast rack',(0,.37,-.021),(0,2.175,-.021),.015,.014,mat=black)
beam('Mast crown join',(-.026,2.185,-.010),(.026,2.185,-.010),.03,.036)
for y in [.49,.63,.77,.91,1.05,1.19,1.33,1.47,1.61,1.75,1.89,2.03]:
    beam('Mast ratchet tooth '+str(y),(-.006,y,.003),(.006,y,.003),.010,.008,mat=brass,bevel=.0008)
for side in [-1,1]:
    bolt(('Left' if side<0 else 'Right')+' lower tenon',(side*.35,.43,.070))
    bolt(('Left' if side<0 else 'Right')+' upper tenon',(side*.172,1.57,-.014))
beam('Rear hinge left leaf',(-.030,1.68,-.080),(-.030,1.75,-.080),.020,.004,mat=brass,bevel=.0005)
beam('Rear hinge right leaf',(.030,1.68,-.080),(.030,1.75,-.080),.020,.004,mat=brass,bevel=.0005)
cylinder('Rear brass hinge pin',(0,1.72,-.090),.008,.082,(1,0,0),mat=brass)
# A real jointed folding spreader prevents the rear leg sliding in water.
beam('Front spreader',(.018,.40,-.020),(.018,.38,-.255),.012,.004,mat=steel,bevel=.0006)
beam('Rear spreader',(.018,.38,-.255),(.018,.40,-.530),.012,.004,mat=steel,bevel=.0006)
cylinder('Spreader joint',(.018,.38,-.255),.009,.007,(1,0,0),mat=brass)
wingnut('Rear spreader lock',(.042,.40,-.53))
# Shelf geometry authored around y=0 and moved to the physical print bottom.
beam('Canvas ledge',(-.37,-.027,.025),(.37,-.027,.025),.048,.16,'shelf')
beam('Canvas retaining lip',(-.37,-.013,.107),(.37,-.013,.107),.026,.018,'shelf')
beam('Shelf back rail',(-.36,.008,-.051),(.36,.008,-.051),.060,.022,'shelf')
beam('Shelf bracket left',(-.043,-.090,-.024),(-.043,.060,-.024),.024,.035,'shelf')
beam('Shelf bracket right',(.043,-.090,-.024),(.043,.060,-.024),.024,.035,'shelf')
wingnut('Shelf adjustment',(0,-.087,.028),'shelf')
bolt('Shelf left join',(-.28,-.023,.116),'shelf',.0048)
bolt('Shelf right join',(.28,-.023,.116),'shelf',.0048)
# Clamp stays above the picture rather than covering its pixels.
beam('Top clamp pad',(-.082,.019,.010),(.082,.019,.010),.034,.068,'clamp')
beam('Clamp slider left',(-.043,.020,-.025),(-.043,.120,-.025),.022,.032,'clamp')
beam('Clamp slider right',(.043,.020,-.025),(.043,.120,-.025),.022,.032,'clamp')
wingnut('Clamp adjustment',(0,.085,.017),'clamp')
bpy.context.view_layer.update()
print(json.dumps({'meshes':len(asset_objects),'polygons':sum(len(o.data.polygons) for o in asset_objects),'roles':sorted(set(o['part_role'] for o in asset_objects))}))


bpy.ops.object.select_all(action='DESELECT')
for o in asset_objects:o.select_set(True)
bpy.context.view_layer.objects.active=asset_objects[0]
bpy.ops.wm.save_as_mainfile(filepath=str(asset_dir/'crafted-easel-source.blend'))
bpy.ops.export_scene.gltf(filepath=str(asset_dir/'crafted-easel.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True)
