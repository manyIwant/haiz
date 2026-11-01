import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fixture } from './helpers.mjs';

const documentUrl = new URL('../../../docs/architecture/openapi.json', import.meta.url);
const loadContract = () => JSON.parse(readFileSync(documentUrl, 'utf8'));

function validators() {
  const contract = loadContract();
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const schemaId = 'https://haiz.invalid/academic-contract';
  ajv.addSchema({ $id: schemaId, components: { schemas: contract.components.schemas } });
  return name => ajv.getSchema(`${schemaId}#/components/schemas/${name}`);
}

function assertSchema(validate, value) {
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

test('OpenAPI 3.1 document passes standard parser validation', async () => {
  const validated = await SwaggerParser.validate(loadContract());
  assert.equal(validated.info.version, '1.4.0');
});

const requiredOperations = [
  ['get', '/identity'],
  ['get', '/classes/{classId}/assignments'],
  ['post', '/classes/{classId}/assignments'],
  ['get', '/assignments/{id}'],
  ['patch', '/assignments/{id}'],
  ['post', '/assignments/{id}/review'],
  ['post', '/assignments/{id}/publish'],
  ['post', '/assignments/{id}/retract'],
  ['get', '/assignments/{id}/history'],
  ['post', '/assignments/{id}/acknowledge'],
  ['get', '/assignments/{id}/acknowledgements'],
  ['get', '/sync'],
  ['post', '/classes/{classId}/members/{userId}/revoke'],
  ['get', '/classroom'],
];

test('OpenAPI covers every v1 operation with explicit permission and error responses', () => {
  const contract = loadContract();
  assert.equal(contract.openapi, '3.1.0');
  assert.equal(contract.servers[0].url, '/api/v1');
  const operationIds = requiredOperations.map(([method, path]) => {
    const operation = contract.paths[path]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${path}`);
    for (const status of ['400', '401', '403', '409', '429', '500', '503']) {
      assert.ok(operation.responses[status], `${operation.operationId}: ${status}`);
    }
    return operation.operationId;
  });
  assert.equal(new Set(operationIds).size, requiredOperations.length);
});

test('mutations require idempotency keys and existing assignment edits require a version', () => {
  const contract = loadContract();
  for (const [method, path] of requiredOperations.filter(([verb]) => verb !== 'get')) {
    const operation = contract.paths[path][method];
    assert.ok(operation.parameters.some(parameter => parameter.$ref === '#/components/parameters/IdempotencyKey'));
    const requestBody = operation.requestBody.$ref
      ? contract.components.requestBodies[operation.requestBody.$ref.split('/').at(-1)]
      : operation.requestBody;
    assert.equal(requestBody.required, true);
  }
  for (const name of ['AssignmentPatch', 'VersionCommand']) {
    assert.ok(contract.components.schemas[name].required.includes('expectedVersion'));
  }
  const properties = contract.components.schemas.AssignmentCreate.properties;
  assert.deepEqual(Object.keys(properties).sort(), ['details', 'due', 'duePrecision', 'subject', 'title']);
  assert.equal(contract.components.schemas.AssignmentCreate.additionalProperties, false);
});

test('classroom uses a bearer credential and a closed projection with no identity or private fields', () => {
  const contract = loadContract();
  assert.deepEqual(contract.security, [{ SessionCookie: [] }]);
  assert.deepEqual(contract.paths['/classroom'].get.security, [{ ClassroomBearer: [] }]);
  const assignment = contract.components.schemas.ClassroomAssignment;
  assert.equal(assignment.additionalProperties, false);
  assert.deepEqual(Object.keys(assignment.properties).sort(), [
    'details', 'due', 'duePrecision', 'id', 'status', 'subject', 'title', 'updatedAt', 'version',
  ]);
  assert.deepEqual(contract.components.schemas.PublicAssignmentStatus.enum, ['published', 'revised', 'retracted']);
  assert.deepEqual(contract.components.schemas.ClassroomAssignment.properties.status.enum, ['published', 'revised']);
});

test('sync contract defines restart-safe opaque cursors and explicit resynchronization failures', () => {
  const contract = loadContract();
  assert.ok(contract.paths['/sync'].get.responses['410']);
  const variants = contract.components.schemas.SyncData.oneOf.map(schema => schema.$ref);
  assert.deepEqual(variants, ['#/components/schemas/SnapshotPage', '#/components/schemas/DeltaPage']);
  for (const name of ['SnapshotPage', 'DeltaPage']) {
    const schema = contract.components.schemas[name];
    for (const field of ['instanceId', 'userId', 'authorizedClassIds', 'cursor', 'hasMore', 'mode']) {
      assert.ok(schema.required.includes(field), `${name}.${field}`);
    }
  }
  assert.equal(contract.components.schemas.CursorExpiredError.properties.code.const, 'CURSOR_EXPIRED');
  assert.equal(contract.components.schemas.CursorExpiredError.properties.resyncRequired.const, true);
});

test('all local references resolve and every parameterized path declares its parameters', () => {
  const contract = loadContract();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref?.startsWith('#/')) {
      const resolved = value.$ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], contract);
      assert.ok(resolved, value.$ref);
    }
    Object.values(value).forEach(visit);
  };
  visit(contract);
  for (const [path, item] of Object.entries(contract.paths)) {
    const names = [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
    const declared = (item.parameters ?? []).map(parameter => contract.components.parameters[parameter.$ref.split('/').at(-1)]?.name);
    for (const name of names) assert.ok(declared.includes(name), `${path}: ${name}`);
  }
});

test('request schemas reject reserved fields and inconsistent deadline precision', () => {
  const schema = validators();
  const create = schema('AssignmentCreate');
  assertSchema(create, { subject: '数学', title: '合成作业', due: '2026-10-30', duePrecision: 'date' });
  assertSchema(create, { subject: '数学', title: '合成作业', due: '2026-10-30T16:30+08:00', duePrecision: 'minute' });
  for (const value of [
    { subject: '数学', title: '合成作业', status: 'published' },
    { subject: '数学', title: '合成作业', due: '2026-02-30', duePrecision: 'date' },
    { subject: '数学', title: '合成作业', due: '2026-10-30' },
    { subject: '数学', title: '合成作业', due: null, duePrecision: 'date' },
    { subject: '数学', title: '合成作业', due: '2026-10-30T16:30', duePrecision: 'minute' },
  ]) assert.equal(create(value), false, JSON.stringify(value));
  const patch = schema('AssignmentPatch');
  assertSchema(patch, { expectedVersion: 3, due: '2026-10-31' });
  assert.equal(patch({ expectedVersion: 3 }), false);
  assert.equal(patch({ expectedVersion: '3', title: '不接受字符串版本' }), false);
  assert.equal(patch({ expectedVersion: 3, classId: 'forged' }), false);
});

test('real synthetic HTTP responses match the published lifecycle, sync and privacy schemas', async t => {
  const f = await fixture(t);
  const schema = validators();
  const validateResponse = (name, response, status = 200) => {
    assert.equal(response.status, status, JSON.stringify(response.body));
    assertSchema(schema(name), response.body);
    return response.body.data;
  };
  validateResponse('IdentityResponse', await f.b.call('/api/v1/identity'));
  const draftResponse = await f.command(f.teacher, `/classes/${f.classroom.id}/assignments`, {
    subject: '数学', title: '契约合成作业', due: '2026-10-29', duePrecision: 'date',
  });
  const draft = validateResponse('AssignmentMutationResponse', draftResponse, 201).assignment;
  const review = validateResponse('AssignmentMutationResponse', await f.command(f.teacher,
    `/assignments/${draft.id}/review`, { expectedVersion: draft.version })).assignment;
  const published = validateResponse('AssignmentMutationResponse', await f.command(f.teacher,
    `/assignments/${draft.id}/publish`, { expectedVersion: review.version })).assignment;
  validateResponse('AssignmentResponse', await f.b.call(`/api/v1/assignments/${draft.id}`));
  validateResponse('AssignmentListResponse', await f.b.call(`/api/v1/classes/${f.classroom.id}/assignments`));
  const snapshot = validateResponse('SyncResponse', await f.b.call('/api/v1/sync'));
  validateResponse('AcknowledgedResponse', await f.command(f.b,
    `/assignments/${draft.id}/acknowledge`, { version: published.version }));
  validateResponse('AcknowledgementListResponse', await f.teacher.call(`/api/v1/assignments/${draft.id}/acknowledgements`));
  const revised = validateResponse('AssignmentMutationResponse', await f.command(f.teacher,
    `/assignments/${draft.id}`, { expectedVersion: published.version, due: '2026-10-30' }, 'PATCH')).assignment;
  validateResponse('HistoryResponse', await f.b.call(`/api/v1/assignments/${draft.id}/history`));
  validateResponse('SyncResponse', await f.b.call(`/api/v1/sync?cursor=${encodeURIComponent(snapshot.cursor)}`));
  validateResponse('ClassroomResponse', await f.anonymous.call('/api/v1/classroom', 'GET', undefined,
    { Authorization: `Bearer ${f.classroom.screenKey}` }));
  const conflict = await f.command(f.teacher, `/assignments/${draft.id}`,
    { expectedVersion: published.version, title: '旧版本' }, 'PATCH');
  assert.equal(conflict.status, 409);
  assertSchema(schema('ConflictResponse'), conflict.body);
  validateResponse('AssignmentMutationResponse', await f.command(f.teacher,
    `/assignments/${draft.id}/retract`, { expectedVersion: revised.version }));
  validateResponse('SyncResponse', await f.b.call(`/api/v1/sync?cursor=${encodeURIComponent(snapshot.cursor)}`));
  const forged = await f.b.call('/api/v1/sync?cursor=forged.signature');
  assert.equal(forged.status, 400);
  assertSchema(schema('FailedResponse'), forged.body);
  validateResponse('MembershipRevokedResponse', await f.command(f.teacher,
    `/classes/${f.classroom.id}/members/${f.b.id}/revoke`, {}));
  const revoked = await f.b.call(`/api/v1/sync?cursor=${encodeURIComponent(snapshot.cursor)}`);
  assert.equal(revoked.status, 409);
  assertSchema(schema('ScopeChangedResponse'), revoked.body);
  const anonymous = await f.anonymous.call('/api/v1/identity');
  assert.equal(anonymous.status, 401);
  assertSchema(schema('RevokedResponse'), anonymous.body);
});
