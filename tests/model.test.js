import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalogue, safeUrl, embedUrl, findIncidents } from '../js/model.js';

const incident = {
  id: 'incident-1', title: 'North entrance', description: 'Door alarm', occurredAt: '2026-10-17T12:30:00Z',
  media: [{ kind: 'video', mode: 'embed', label: 'Entrance camera', src: 'https://player.vimeo.com/video/123456' }],
};

test('validates multiple media per incident and normalizes dates', () => {
  const data = validateCatalogue({ version: 1, incidents: [{ ...incident, media: [...incident.media, { kind: 'audio', mode: 'direct', label: 'Radio recording', src: 'https://example.com/recording.mp3' }] }] });
  assert.equal(data.incidents[0].media.length, 2);
  assert.equal(data.incidents[0].occurredAt, '2026-10-17T12:30:00.000Z');
  assert.equal(data.incidents[0].location, '');
});

test('normalizes optional locations and includes them in incident search', () => {
  const located = validateCatalogue({ version: 1, incidents: [{ ...incident, location: '  Queen St W & Spadina Ave  ' }] }).incidents[0];
  assert.equal(located.location, 'Queen St W & Spadina Ave');
  assert.equal(findIncidents([located], 'spadina').length, 1);
  assert.throws(() => validateCatalogue({ version: 1, incidents: [{ ...incident, location: 'x'.repeat(301) }] }), /Locations/);
});

test('rejects executable URLs, unsafe frames, malformed incidents and duplicate IDs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com/a', 'https://user:pass@example.com/a']) {
    assert.throws(() => safeUrl(value));
  }
  assert.throws(() => embedUrl('https://evil.example/embed/123'));
  assert.throws(() => embedUrl('https://www.youtube.com/redirect?q=evil'));
  assert.throws(() => embedUrl('https://player.vimeo.com.evil.example/video/123'));
  assert.equal(new URL(embedUrl('https://player.vimeo.com/video/123?autoplay=1&h=private')).searchParams.get('autoplay'), null);
  assert.throws(() => validateCatalogue({ version: 1, incidents: [incident, incident] }), /unique/);
  assert.throws(() => validateCatalogue({ version: 1, incidents: [{ ...incident, media: [] }] }), /1 and 30/);
  assert.throws(() => validateCatalogue({ version: 1, incidents: [{ ...incident, occurredAt: 'bad' }] }), /date and time/);
});

test('searches, filters and orders incidents without changing the original list', () => {
  const newer = { ...incident, id: 'incident-2', title: 'South exit', occurredAt: '2026-10-18T12:30:00Z' };
  const items = [incident, newer];
  assert.equal(findIncidents(items)[0].id, 'incident-2');
  assert.equal(findIncidents(items, '', 'all', 'oldest')[0].id, 'incident-1');
  assert.equal(findIncidents(items, 'north').length, 1);
  assert.equal(findIncidents(items, '', 'audio').length, 0);
  assert.equal(items[0].id, 'incident-1');
});