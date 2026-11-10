// setup: npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 meshoptimizer@0.22.0 sharp
// Slim a heavy car GLB for the game.
// usage: node slim2.mjs in.glb out.glb '{"ratio":0.05,"error":0.01,"dropNode":"interior","dropMat":"leather","keepUV":false,"tex":512}'
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, join, flatten, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [,, inp, out, cfgArg] = process.argv;
const C = { ratio: 0.05, error: 0.01, dropNode: '', dropMat: '', keepUV: false, tex: 512, ...JSON.parse(cfgArg || '{}') };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
let before = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) before += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
if (C.dropNode) { const re = new RegExp(C.dropNode, 'i'); for (const n of root.listNodes()) if (re.test(n.getName())) n.dispose(); }
if (C.dropMat) {
  const re = new RegExp(C.dropMat, 'i');
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) if (re.test(p.getMaterial()?.getName() || '')) p.dispose();
}
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const usesTex = !!p.getMaterial()?.getBaseColorTexture();
  for (const sem of p.listSemantics()) {
    if (sem === 'POSITION') continue;
    if (C.keepUV && usesTex && sem === 'TEXCOORD_0') continue;
    p.setAttribute(sem, null);
  }
}
// textures: drop the ones no remaining material samples as base colour; shrink the rest
for (const mat of root.listMaterials()) {
  mat.setNormalTexture(null); mat.setOcclusionTexture(null); mat.setMetallicRoughnessTexture(null); mat.setEmissiveTexture(null);
}
await doc.transform(flatten(), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), join({ keepNamed: false }), weld({ tolerance: 0.0005 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: C.ratio, error: C.error, lockBorder: false }), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [C.tex, C.tex], quality: 80 }));
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
await io.write(out, doc);
console.log('triangles', before, '->', tris, '| materials', root.listMaterials().map(m => m.getName()).join(','), '| textures', root.listTextures().length);
