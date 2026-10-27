import fs from 'node:fs';
import YAML from 'yaml';
const y=YAML.parse(fs.readFileSync(new URL('../contracts-autos-openapi-v3.yaml',import.meta.url),'utf8'));
const methods=new Set(['get','post','put','patch','delete']);
const ops=Object.entries(y.paths).flatMap(([p,v])=>Object.keys(v).filter(m=>methods.has(m)).map(m=>`${m.toUpperCase()} ${p}`));
console.log(`OpenAPI ${y.info.version} | ${ops.length} operaciones | ${Object.keys(y.paths).length} rutas`);
for(const o of ops)console.log(o);
if(ops.length!==19||y.info.version!=='3.0.0')process.exitCode=1;
