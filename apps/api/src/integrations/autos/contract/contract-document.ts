import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  $ref?: string;
  additionalProperties?: boolean | Schema;
  [key: string]: unknown;
}
export interface Operation {
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema: Schema;
  }>;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: Schema }>;
  };
  responses: Record<
    string,
    {
      headers?: Record<string, { schema: { example?: string } }>;
      content?: Record<string, { schema: Schema }>;
      $ref?: string;
    }
  >;
  [key: string]: unknown;
}
export interface ContractDocument {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema>; [key: string]: unknown };
  [key: string]: unknown;
}
const candidates = [
  resolve(process.cwd(), '../../contracts/autos-openapi.yaml'),
  resolve(process.cwd(), 'contracts/autos-openapi.yaml'),
];
const source = candidates.find((p) => existsSync(p));
if (!source) throw new Error('Contrato canónico no encontrado.');
const bytes = readFileSync(source);
if (
  createHash('sha256').update(bytes).digest('hex') !==
  '7ef0fd17b82e2fa24e7efb170f2ec833f905e071b1017cc0bf2741393593ed5b'
)
  throw new Error('Integridad del contrato inválida.');
export const autosDocument = parse(bytes.toString('utf8')) as ContractDocument;
