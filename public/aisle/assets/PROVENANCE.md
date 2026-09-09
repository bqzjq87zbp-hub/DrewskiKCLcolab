# Easel geometry and canvas materials

The timber easel was constructed and rendered in an isolated Blender 5.2.1 LTS scene on September 9, 2026, then exported to `crafted-easel.glb`. The browser consumes the same exported positions, normals, UVs and indices through `easel-geometry.js`. It is an original general lyre-easel model, informed by the [MABEF M/11 construction reference](https://www.mabef.com/en/products/lyre-easels/m11); no manufacturer's photographs, branding, 3D files or assembly drawings are included.

The model contains bevelled boards, splayed front legs, a hinged rear support, mortised stretchers, twin mast guides, a recessed adjustment rack, sliding canvas ledge and clamp, washers, screws, wingnuts and a folding spreader. Sixty-five authored source objects are packed into fourteen material/part meshes, with 14,140 triangles and 10,176 vertices. The mast, ledge and clamp are positioned independently of the picture in the runtime. One unit is one metre, Y is up and the printed face looks toward +Z.

## Online material

- Asset: [Coated Pine by Poly Haven](https://polyhaven.com/a/coated_pine).
- Authors: Charlotte Baglioni (scanning), Rico Cilliers (processing).
- License: [CC0](https://polyhaven.com/license), including commercial use and redistribution. The license applies to the texture asset, not unrelated website imagery or text.
- Maps included: original 1K JPEG diffuse, OpenGL normal and roughness maps. No texture pixels were rewritten. Their original source URLs, MD5 and SHA-256 hashes are recorded in `texture-manifest.json`; each download matched the API's MD5.
- The scanned tile is approximately 0.7 m wide. UVs follow the length of each individual wooden member; the runtime reduces normal strength and increases roughness for the shaded pier setting. Pine is a material interpretation, not a claim that the asset duplicates the manufacturer's beech easel.

## Canvas construction

The front uses the entire source photograph and its original aspect ratio, with a 1.05 m long-edge assumption. Its four front vertices and 0/1 UVs stay fixed throughout travel. A separate rolled shell carries a narrow image strip onto the sides; it never changes or crops the front. The shell is 38 mm deep with a 1.3 mm worked edge radius. Rear construction includes four wooden stretcher bars, opaque recessed cotton, folded fabric strips with doubled corner layers, and staple crowns.

The canvas weave is an original procedural warp/weft height texture, applied as bump shading with approximately 0.9 mm thread spacing. It changes reflected light without changing photograph pixels. Mipmaps and anisotropic filtering suppress detail smaller than a pixel. Material controls were tuned against browser renders; the Three.js bump-strength control is not a physical millimetre measurement. The front is opaque. User-provided physical canvas photos informed this construction; those private originals are not included.

## Reproduce and inspect

Run these commands from this directory, using an installed Blender 5.2 binary. Factory-startup background mode creates an isolated file and does not replace a user's open scene.

```sh
blender --background --factory-startup --python build_easel.py
python3 convert_glb.py crafted-easel.glb easel-geometry.js
```

The generated `.blend` source is optional local authoring output; the compact exported geometry and maps are what the gallery requires. The converter verifies that the export has no unexpected node rotation, scale or hierarchy before packing it. It preserves the original normals and UVs and merges only by material and functional part.

With the local project server running, `/aisle/assets/review.html` provides front, oblique, rear and canvas-edge views using the actual runtime model and a portfolio photograph. This is an asset inspection surface, not proof that the wider photographed pier scene has solved camera registration or water compositing.

## Current limits

The texture repeats are still visible at some close angles, and the model is a newly constructed display easel rather than a scan of a weathered seaside object. Cloth folds and staple crowns are simplified geometry; the corner treatment is more regular than a hand-stretched canvas. Environmental shadows, background registration and water contact are handled separately by the gallery. Do not describe this asset render alone as photoreal acceptance of the whole scene.
