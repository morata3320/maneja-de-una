import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parse } from 'yaml';
import { format } from 'prettier';

interface Schema {
  $ref?: string;
  type?: string;
  enum?: readonly (string | number | boolean)[];
  nullable?: boolean;
  properties?: Record<string, Schema>;
  required?: readonly string[];
  items?: Schema;
  additionalProperties?: boolean | Schema;
}
interface Contract {
  openapi: string;
  components: { schemas: Record<string, Schema> };
}
interface Provenance {
  sha256: string;
  bytes: number;
}

const source = resolve(
  import.meta.dirname,
  '../../../contracts/autos-openapi.yaml',
);
const metadata = JSON.parse(
  readFileSync(resolve(dirname(source), 'autos-openapi.source.json'), 'utf8'),
) as Provenance;
const bytes = readFileSync(source);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== metadata.sha256 || bytes.length !== metadata.bytes) {
  throw new Error('El contrato canónico cambió: SHA-256 o tamaño incorrecto.');
}
await SwaggerParser.validate(source);
const contract = parse(bytes.toString('utf8')) as Contract;
if (contract.openapi !== '3.0.3')
  throw new Error('Versión OpenAPI inesperada.');
const names = new Set(Object.keys(contract.components.schemas));

function typeOf(schema: Schema): string {
  let result: string;
  if (schema.$ref) {
    const prefix = '#/components/schemas/';
    const name = schema.$ref.slice(prefix.length);
    if (!schema.$ref.startsWith(prefix) || !names.has(name))
      throw new Error('Referencia no soportada.');
    result = name;
  } else if (schema.enum) {
    result =
      schema.enum.map((value) => JSON.stringify(value)).join(' | ') || 'never';
  } else if (schema.type === 'object') {
    const fields = Object.entries(schema.properties ?? {}).map(
      ([key, value]) =>
        JSON.stringify(key) +
        (schema.required?.includes(key) ? '' : '?') +
        ': ' +
        typeOf(value) +
        ';',
    );
    if (schema.additionalProperties !== false) {
      const extra =
        typeof schema.additionalProperties === 'object'
          ? typeOf(schema.additionalProperties)
          : 'unknown';
      fields.push('[key: string]: ' + extra + ';');
    }
    result = '{ ' + fields.join(' ') + ' }';
  } else if (schema.type === 'array') {
    if (!schema.items) throw new Error('Array sin items.');
    result = 'Array<' + typeOf(schema.items) + '>';
  } else if (schema.type === 'integer' || schema.type === 'number')
    result = 'number';
  else if (schema.type === 'string') result = 'string';
  else if (schema.type === 'boolean') result = 'boolean';
  else throw new Error('Tipo de schema no soportado.');
  return schema.nullable ? '(' + result + ' | null)' : result;
}

const rawOutput =
  '// Generado desde contracts/autos-openapi.yaml. No editar.\n' +
  '// Son tipos de transporte, no validadores HTTP ni modelos ORM.\n' +
  Object.entries(contract.components.schemas)
    .map(
      ([name, schema]) => 'export type ' + name + ' = ' + typeOf(schema) + ';',
    )
    .join('\n') +
  '\n';
const output = await format(rawOutput, {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'all',
});
const target = resolve(
  import.meta.dirname,
  '../src/integrations/autos/contract/autos.types.ts',
);
if (process.argv.includes('--generate')) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output);
} else if (
  process.argv.includes('--check-types') &&
  readFileSync(target, 'utf8') !== output
) {
  throw new Error('Tipos desactualizados; ejecutar npm run contract:generate.');
}
console.log(
  'OpenAPI válido; SHA-256 ' + hash + '; ' + names.size + ' schemas.',
);
