// usage: npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 meshoptimizer@0.22.0
//        node slim.mjs input.glb output.glb 0.03 0.01   (keep ratio, max error)
// Slim a heavy car GLB for mobile: drop hidden/tiny parts, merge by material, simplify.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, join, flatten, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [,, inp, out, ratioArg, errArg] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
const DROP = /interior|seat|steering|dashboard|brake|caliper|nuts|support|underbody|reflector|lamp_part|_part_mattemetal|xenon|wiper|engine|exhaust|pedal|belt|speaker|_parts_mattemetal/i;
let dropped = 0;
for (const node of root.listNodes()) {
  if (DROP.test(node.getName())) { node.dispose(); dropped++; }
}
// no textures in this model: drop UVs and normals so the simplifier is not stopped by their seams
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  for (const sem of p.listSemantics()) if (sem !== 'POSITION') p.setAttribute(sem, null);
}
await doc.transform(flatten(), dedup(), join({ keepNamed: false }), weld({ tolerance: 0.0005 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratioArg || 0.03), error: Number(errArg || 0.004), lockBorder: false }), prune());
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
// (no quantize: the game re-bakes transforms, which needs float positions)
await io.write(out, doc);
console.log('dropped nodes', dropped, 'triangles', tris, 'materials', root.listMaterials().map(m => m.getName()).join(','));
