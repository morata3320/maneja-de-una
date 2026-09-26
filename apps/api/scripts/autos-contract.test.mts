import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema: { type?: string; format?: string };
}
interface Operation {
  parameters?: Parameter[];
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: { $ref: string } }>;
  };
  responses: Record<
    string,
    { headers?: Record<string, unknown>; content?: Record<string, unknown> }
  >;
}
interface Schema {
  required?: string[];
  properties?: Record<string, unknown>;
}
interface Contract {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}
const contract = parse(
  readFileSync(
    resolve(import.meta.dirname, '../../../contracts/autos-openapi.yaml'),
    'utf8',
  ),
) as Contract;
const operations = Object.entries(contract.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) =>
      ['get', 'post', 'delete', 'put', 'patch'].includes(method),
    )
    .map(([method, operation]) => ({ path, method, operation })),
);

await test('exactamente las 15 operaciones canónicas', () => {
  assert.deepEqual(
    operations
      .map(({ path, method }) => method.toUpperCase() + ' ' + path)
      .sort(),
    [
      'POST /search',
      'POST /depots',
      'POST /depots/reviews/scores',
      'POST /details',
      'POST /suppliers',
      'POST /constants',
      'POST /orders/hold',
      'POST /orders/preview',
      'POST /orders/create',
      'GET /orders/{orderId}',
      'POST /orders/{orderId}/modify',
      'POST /orders/{orderId}/cancel',
      'GET /webhooks',
      'POST /webhooks',
      'DELETE /webhooks/{id}',
    ].sort(),
  );
});
await test('seis operaciones públicas sin OAuth con affiliate integer requerido y cache', () => {
  const publicOperations = operations.filter(
    ({ operation }) => operation.security?.length === 0,
  );
  assert.equal(publicOperations.length, 6);
  for (const { operation } of publicOperations) {
    const affiliate = operation.parameters?.find(
      (p) => p.name === 'X-Affiliate-Id',
    );
    assert.equal(affiliate?.required, true);
    assert.equal(affiliate?.schema.type, 'integer');
    assert.ok(operation.responses['200'].headers?.['Cache-Control']);
    assert.ok(operation.responses['200'].headers?.['X-API-Deprecation-Date']);
  }
});
await test('scopes y cabeceras idempotentes exactos', () => {
  const scopes: Record<string, string> = {
    '/orders/hold': 'autos:book',
    '/orders/preview': 'autos:read',
    '/orders/create': 'autos:book',
    '/orders/{orderId}': 'autos:read',
    '/orders/{orderId}/modify': 'autos:book',
    '/orders/{orderId}/cancel': 'autos:cancel',
    '/webhooks': 'autos:webhooks',
    '/webhooks/{id}': 'autos:webhooks',
  };
  for (const { path, operation } of operations.filter(
    ({ operation }) => operation.security?.length,
  )) {
    assert.deepEqual(operation.security, [{ OAuth2Security: [scopes[path]] }]);
    assert.equal(
      operation.parameters?.some((p) => p.name === 'X-Affiliate-Id') ?? false,
      false,
    );
    const idempotency = operation.parameters?.find(
      (p) => p.name === 'Idempotency-Key',
    );
    const required = [
      '/orders/create',
      '/orders/{orderId}/modify',
      '/orders/{orderId}/cancel',
    ].includes(path);
    assert.equal(Boolean(idempotency), required);
    if (required) {
      assert.equal(idempotency?.required, true);
      assert.equal(idempotency?.schema.format, 'uuid');
    }
  }
});
await test('requests referencian schemas reales sin inventar required', () => {
  for (const { operation } of operations) {
    const body = operation.requestBody;
    if (body) {
      const name = body.content['application/json'].schema.$ref
        .split('/')
        .pop();
      assert.ok(name && contract.components.schemas[name]);
    }
  }
  assert.equal(
    contract.components.schemas.OrderModifyRequest.required,
    undefined,
  );
  assert.equal(
    contract.components.schemas.CarDetailsRequest.required,
    undefined,
  );
  assert.deepEqual(contract.components.schemas.OrderCreateRequest.required, [
    'order_preview_id',
    'payment_reference',
    'driver_details',
  ]);
  assert.deepEqual(contract.components.schemas.WebhookSubscription.required, [
    'id',
    'url',
    'events',
  ]);
});
await test('respuestas de creación, cancelación y eliminación conservadas', () => {
  assert.ok(contract.paths['/orders/create'].post.responses['201']);
  assert.ok(contract.paths['/webhooks'].post.responses['201']);
  assert.equal(
    contract.paths['/webhooks/{id}'].delete.responses['204'].content,
    undefined,
  );
  assert.equal(
    contract.paths['/orders/{orderId}/cancel'].post.responses['200'].content,
    undefined,
  );
});
