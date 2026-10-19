import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogue, parseEnvelope, saveCatalogue, unlockCatalogue, validatePassword } from '../js/crypto.js';

test('independent passwords unlock content without publishing plaintext or passwords', async () => {
  const data = { incidents: [{ title: 'Confidential incident', description: 'Private details' }] };
  const { envelope, contentKey } = await createCatalogue(data, 'ViewerSecret123!', 'EditorSecret456!');
  const serialized = JSON.stringify(envelope);
  for (const secret of ['Confidential', 'Private details', 'ViewerSecret123!', 'EditorSecret456!']) {
    assert.equal(serialized.includes(secret), false);
  }
  const parsed = parseEnvelope(serialized);
  assert.deepEqual((await unlockCatalogue(parsed, 'ViewerSecret123!', 'viewer')).data, data);
  assert.deepEqual((await unlockCatalogue(parsed, 'EditorSecret456!', 'editor')).data, data);
  await assert.rejects(unlockCatalogue(parsed, 'EditorSecret456!', 'viewer'), /Unable to unlock/);
  await assert.rejects(unlockCatalogue(parsed, 'WrongPassword123', 'editor'), /Unable to unlock/);
  const updatedData = { incidents: [] };
  const updated = await saveCatalogue(envelope, contentKey, updatedData);
  assert.notEqual(updated.payload.iv, envelope.payload.iv);
  assert.deepEqual((await unlockCatalogue(updated, 'ViewerSecret123!', 'viewer')).data, updatedData);
});

test('tampering and unsupported formats are rejected', async () => {
  const { envelope } = await createCatalogue({ incidents: [] }, 'ViewerSecret123!', 'EditorSecret456!');
  envelope.payload.ciphertext = 'AAAA' + envelope.payload.ciphertext.slice(4);
  await assert.rejects(unlockCatalogue(envelope, 'ViewerSecret123!', 'viewer'), /Unable to unlock/);
  assert.throws(() => parseEnvelope('{}'), /not supported/);
  assert.throws(() => parseEnvelope('not json'), /valid encrypted/);
  assert.throws(() => parseEnvelope(JSON.stringify({ ...envelope, iterations: 1 })), /not supported/);
});

test('setup enforces distinct single-word passwords of at least 12 characters', async () => {
  assert.throws(() => validatePassword('short'), /12 to 256/);
  assert.throws(() => validatePassword('this has spaces'), /without spaces/);
  assert.doesNotThrow(() => validatePassword('LongUniqueWord123!'));
  await assert.rejects(createCatalogue({}, 'SamePassword123', 'SamePassword123'), /different/);
});