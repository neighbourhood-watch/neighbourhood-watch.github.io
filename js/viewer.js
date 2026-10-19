import { $, busy, formatDate, formatTime, icon, loadPublishedCatalogue, mediaIcon, refreshIcons, report, textElement } from './common.js';
import { unlockCatalogue } from './crypto.js';
import { findIncidents, validateCatalogue } from './model.js';
import { renderMedia } from './media.js';

let envelope;
let catalogue;
let selectedId = null;
let idleTimer;

function resetIdleTimer() {
  if (!catalogue) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => location.reload(), 15 * 60 * 1000);
}
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, resetIdleTimer);
$('#lock').addEventListener('click', () => location.reload());

function selectIncident(incident, moveFocus = true) {
  selectedId = incident.id;
  document.querySelectorAll('.incident-button').forEach(button => button.setAttribute('aria-current', String(button.dataset.id === selectedId)));
  const detail = $('#incident-detail');
  detail.replaceChildren();
  const meta = textElement('p', `${formatDate(incident.occurredAt)} / ${formatTime(incident.occurredAt)}`, 'eyebrow detail-date');
  const heading = textElement('h2', incident.title);
  heading.tabIndex = -1;
  const description = textElement('p', incident.description, 'incident-description');
  const mediaList = document.createElement('div');
  mediaList.className = 'media-list';
  const controls = document.createElement('div');
  controls.className = 'media-tabs';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Associated media');
  function selectMedia(index) {
    controls.querySelectorAll('button').forEach((button, position) => button.setAttribute('aria-pressed', String(index === position)));
    mediaList.replaceChildren(renderMedia(incident.media[index]));
  }
  incident.media.forEach((media, index) => {
    const button = document.createElement('button');
    button.className = 'media-choice';
    button.type = 'button';
    button.append(icon(mediaIcon(media.kind)), textElement('span', media.label));
    button.addEventListener('click', () => selectMedia(index));
    controls.append(button);
  });
  detail.append(meta, heading);
  if (incident.description) detail.append(description);
  detail.append(controls, mediaList);
  selectMedia(0);
  refreshIcons();
  if (moveFocus) heading.focus();
}

function renderList() {
  const incidents = findIncidents(catalogue.incidents, $('#search').value, $('#kind-filter').value, $('#sort').value);
  $('#incident-count').textContent = `${incidents.length} / ${catalogue.incidents.length}`;
  const list = $('#incident-list');
  list.replaceChildren();
  if (!incidents.length) list.append(textElement('p', catalogue.incidents.length ? 'No matching incidents.' : 'No incidents published.', 'list-empty'));
  for (const incident of incidents) {
    const button = document.createElement('button');
    button.className = 'incident-button';
    button.type = 'button';
    button.dataset.id = incident.id;
    button.setAttribute('aria-current', String(incident.id === selectedId));
    const time = textElement('time', formatDate(incident.occurredAt), 'incident-date');
    time.dateTime = incident.occurredAt;
    const types = document.createElement('span');
    types.className = 'incident-types';
    for (const kind of new Set(incident.media.map(media => media.kind))) {
      const badge = textElement('span', kind, 'media-type');
      badge.prepend(icon(mediaIcon(kind)));
      types.append(badge);
    }
    button.append(time, textElement('span', incident.title, 'incident-name'), types, textElement('span', `${incident.media.length} item${incident.media.length === 1 ? '' : 's'}`, 'incident-item-count'));
    button.addEventListener('click', () => selectIncident(incident));
    list.append(button);
  }
  if (selectedId && !incidents.some(incident => incident.id === selectedId)) {
    selectedId = null;
    const empty = textElement('div', '', 'empty-state');
    empty.append(icon('files'), textElement('h2', 'Select an incident'));
    $('#incident-detail').replaceChildren(empty);
  }
  refreshIcons();
}

$('#unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  await busy(event.currentTarget, async () => {
    try {
      report('#gate-error', 'Unlocking...');
      const unlocked = await unlockCatalogue(envelope, $('#password').value, 'viewer');
      catalogue = validateCatalogue(unlocked.data);
      $('#password').value = '';
      $('#gate').hidden = true;
      $('#register').hidden = false;
      $('#lock').hidden = false;
      renderList();
      $('#register-title').tabIndex = -1;
      $('#register-title').focus();
      resetIdleTimer();
    } catch (error) { report('#gate-error', error.message, true); }
  });
});
$('#search').addEventListener('input', renderList);
$('#kind-filter').addEventListener('change', renderList);
$('#sort').addEventListener('change', renderList);

$('#unlock-form').hidden = true;
try {
  envelope = await loadPublishedCatalogue();
  if (envelope) $('#unlock-form').hidden = false;
  else {
    $('#gate-caption').textContent = 'No catalogue has been published yet.';
    $('#setup-link').hidden = false;
  }
} catch (error) { report('#gate-error', error.message, true); }