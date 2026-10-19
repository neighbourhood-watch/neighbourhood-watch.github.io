import { $, busy, formatDate, icon, loadPublishedCatalogue, mediaIcon, readCatalogueFile, refreshIcons, report, textElement } from './common.js';
import { createCatalogue, saveCatalogue, unlockCatalogue } from './crypto.js';
import { findIncidents, validateCatalogue } from './model.js';
import { parseMedia, renderMedia } from './media.js';

let envelope;
let contentKey;
let catalogue;
let selectedId = null;
let formDirty = false;
let needsExport = false;
let rowSequence = 0;

function updateState() {
  $('#save-state').textContent = formDirty ? 'Unsaved form changes' : needsExport ? 'Changes need exporting' : 'No unexported changes';
  $('#save-state').classList.toggle('pending', formDirty || needsExport);
  $('#editor-count').textContent = `${catalogue.incidents.length} incident${catalogue.incidents.length === 1 ? '' : 's'}`;
}

function canDiscardForm() {
  return !formDirty || window.confirm('Discard the unsaved changes in this incident form?');
}

function addMediaRow(media) {
  const rowId = ++rowSequence;
  const row = document.createElement('fieldset');
  row.className = 'media-field';
  row.innerHTML = `<legend>Media item</legend>
    <div class="media-row-heading"><span class="media-number"></span><button type="button" class="icon-button remove-media" aria-label="Remove media item" title="Remove media item"><i data-lucide="trash-2" aria-hidden="true"></i></button></div>
    <div class="form-grid"><div><label for="media-kind-${rowId}">Media type</label><select id="media-kind-${rowId}" class="media-kind"><option value="video">Video</option><option value="image">Image</option><option value="audio">Audio</option></select></div>
    <div><label for="media-label-${rowId}">Label / image description</label><input id="media-label-${rowId}" class="media-label" maxlength="200" required /></div></div>
    <label for="media-source-${rowId}">Embed code or HTTPS media URL</label><textarea id="media-source-${rowId}" class="media-source" rows="3" maxlength="12000" required spellcheck="false"></textarea>
    <button type="button" class="text-button preview-button" aria-expanded="false" aria-controls="preview-${rowId}"><i data-lucide="eye" aria-hidden="true"></i>Preview media</button>
    <p class="notice media-row-error" role="alert" hidden></p><div id="preview-${rowId}" class="media-preview" hidden></div>`;
  if (media) {
    row.querySelector('.media-kind').value = media.kind;
    row.querySelector('.media-label').value = media.label;
    row.querySelector('.media-source').value = media.src;
  }
  row.querySelector('.remove-media').addEventListener('click', () => {
    if ($('#media-fields').children.length === 1) {
      report('#notice', 'An incident needs at least one media item.', true);
      return;
    }
    row.remove();
    numberRows();
    formDirty = true;
    updateState();
    $('#add-media').focus();
  });
  row.querySelector('.preview-button').addEventListener('click', () => {
    const preview = row.querySelector('.media-preview');
    const button = row.querySelector('.preview-button');
    if (!preview.hidden) {
      preview.replaceChildren();
      preview.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      return;
    }
    try {
      preview.replaceChildren(renderMedia(readMediaRow(row)));
      preview.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      row.querySelector('.media-row-error').hidden = true;
    } catch (error) {
      const message = row.querySelector('.media-row-error');
      message.textContent = error.message;
      message.classList.add('error');
      message.hidden = false;
    }
  });
  $('#media-fields').append(row);
  numberRows();
  refreshIcons();
  return row;
}

function readMediaRow(row) {
  return parseMedia(row.querySelector('.media-kind').value, row.querySelector('.media-label').value, row.querySelector('.media-source').value);
}

function numberRows() {
  $('#media-fields').querySelectorAll('.media-field').forEach((row, index) => {
    row.querySelector('legend').textContent = `Media ${String(index + 1).padStart(2, '0')}`;
    row.querySelector('.media-number').textContent = 'HOSTED MEDIA';
    row.querySelector('.remove-media').setAttribute('aria-label', `Remove media ${index + 1}`);
  });
}

function localDateValue(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fillForm(incident = null, moveFocus = false) {
  selectedId = incident?.id || null;
  $('#incident-form').reset();
  $('#form-title').textContent = incident ? 'Edit incident' : 'New incident';
  $('#incident-title').value = incident?.title || '';
  $('#incident-date').value = incident ? localDateValue(incident.occurredAt) : '';
  $('#incident-description').value = incident?.description || '';
  $('#delete-incident').hidden = !incident;
  $('#media-fields').replaceChildren();
  if (incident) incident.media.forEach(addMediaRow);
  else addMediaRow();
  formDirty = false;
  updateState();
  renderList();
  if (moveFocus) $('#incident-title').focus();
}

function renderList() {
  const list = $('#editor-list');
  list.replaceChildren();
  if (!catalogue.incidents.length) list.append(textElement('p', 'No incidents yet.', 'list-empty'));
  for (const incident of findIncidents(catalogue.incidents)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'incident-button';
    button.setAttribute('aria-current', String(incident.id === selectedId));
    button.append(textElement('span', formatDate(incident.occurredAt), 'incident-date'), textElement('span', incident.title, 'incident-name'));
    const count = textElement('span', `${incident.media.length} media item${incident.media.length === 1 ? '' : 's'}`, 'muted small');
    count.prepend(icon(mediaIcon(incident.media[0].kind)));
    button.append(count);
    button.addEventListener('click', () => { if (canDiscardForm()) fillForm(incident, true); });
    list.append(button);
  }
  refreshIcons();
}

function openEditor() {
  $('#gate').hidden = true;
  $('#editor').hidden = false;
  $('#lock').hidden = false;
  $('#setup-form').reset();
  $('#unlock-form').reset();
  $('#timezone').textContent = `Local timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;
  fillForm();
  $('#editor-title').tabIndex = -1;
  $('#editor-title').focus();
}

$('#unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  await busy(event.currentTarget, async () => {
    try {
      report('#gate-error', 'Unlocking...');
      const result = await unlockCatalogue(envelope, $('#password').value, 'editor');
      catalogue = validateCatalogue(result.data);
      contentKey = result.contentKey;
      openEditor();
    } catch (error) { report('#gate-error', error.message, true); }
  });
});

$('#setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  await busy(event.currentTarget, async () => {
    try {
      if ($('#editor-password').value !== $('#confirm-editor-password').value) throw new Error('The editor password confirmation does not match.');
      report('#gate-error', 'Creating encrypted register...');
      const data = { version: 1, incidents: [] };
      const result = await createCatalogue(data, $('#viewer-password').value, $('#editor-password').value);
      catalogue = data;
      envelope = result.envelope;
      contentKey = result.contentKey;
      needsExport = true;
      openEditor();
      report('#notice', 'Register created. Keep both passwords in a password manager; there is no password recovery.');
    } catch (error) { report('#gate-error', error.message, true); }
  });
});

$('#import-file').addEventListener('change', async event => {
  try {
    envelope = await readCatalogueFile(event.target.files[0]);
    $('#setup-form').hidden = true;
    $('#unlock-form').hidden = false;
    $('#gate-caption').textContent = 'Imported catalogue. Enter its editor password.';
    $('#gate-error').hidden = true;
    $('#password').value = '';
    $('#password').focus();
  } catch (error) { report('#gate-error', error.message, true); }
  event.target.value = '';
});

$('#incident-form').addEventListener('input', () => { formDirty = true; updateState(); });
$('#incident-form').addEventListener('change', () => { formDirty = true; updateState(); });
$('#add-media').addEventListener('click', () => {
  if ($('#media-fields').children.length >= 30) return report('#notice', 'An incident can have up to 30 media items.', true);
  const row = addMediaRow();
  formDirty = true;
  updateState();
  row.querySelector('.media-label').focus();
});
$('#incident-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const occurredAt = new Date($('#incident-date').value);
    if (!Number.isFinite(occurredAt.getTime())) throw new Error('Enter a valid date and time.');
    const incident = {
      id: selectedId || crypto.randomUUID(),
      title: $('#incident-title').value,
      description: $('#incident-description').value,
      occurredAt: occurredAt.toISOString(),
      media: [...$('#media-fields').children].map(readMediaRow),
    };
    const incidents = [...catalogue.incidents];
    const index = incidents.findIndex(item => item.id === incident.id);
    if (index === -1) incidents.push(incident);
    else incidents[index] = incident;
    catalogue = validateCatalogue({ version: 1, incidents });
    needsExport = true;
    fillForm(catalogue.incidents.find(item => item.id === incident.id));
    report('#notice', 'Incident saved in this session. Export the catalogue to keep your changes.');
  } catch (error) { report('#notice', error.message, true); }
});
$('#new-incident').addEventListener('click', () => { if (canDiscardForm()) fillForm(null, true); });
$('#discard').addEventListener('click', () => {
  if (canDiscardForm()) fillForm(catalogue.incidents.find(incident => incident.id === selectedId), true);
});
$('#delete-incident').addEventListener('click', () => {
  if (!selectedId || !window.confirm('Delete this incident and all its media references? Export and publish to apply the deletion.')) return;
  catalogue.incidents = catalogue.incidents.filter(incident => incident.id !== selectedId);
  needsExport = true;
  fillForm(null, true);
  report('#notice', 'Incident deleted in this session. Export and publish to update the register.');
});

$('#export').addEventListener('click', async () => {
  if (formDirty) return report('#notice', 'Save or discard the current form changes before exporting.', true);
  const button = $('#export');
  button.disabled = true;
  try {
    envelope = await saveCatalogue(envelope, contentKey, validateCatalogue(catalogue));
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'incidents.enc.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    needsExport = false;
    updateState();
    $('#save-state').textContent = 'Exported / publishing required';
    report('#notice', 'Encrypted catalogue downloaded. Replace public/data/incidents.enc.json in your GitHub repository, then wait for deployment.');
  } catch (error) { report('#notice', error.message, true); }
  finally { button.disabled = false; }
});

$('#rotate-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (formDirty) return report('#notice', 'Save or discard the incident form before changing passwords.', true);
  if (!window.confirm('Replace both passwords? Existing downloads and GitHub history will still open with the old passwords.')) return;
  await busy(event.currentTarget, async () => {
    try {
      const result = await createCatalogue(catalogue, $('#rotate-viewer').value, $('#rotate-editor').value);
      envelope = result.envelope;
      contentKey = result.contentKey;
      needsExport = true;
      $('#rotate-form').reset();
      updateState();
      report('#notice', 'New passwords set for the next export. Export and publish the catalogue to apply them.');
    } catch (error) { report('#notice', error.message, true); }
  });
});
$('#lock').addEventListener('click', () => {
  if ((formDirty || needsExport) && !window.confirm('Lock and discard all unexported changes?')) return;
  formDirty = false;
  needsExport = false;
  location.reload();
});
window.addEventListener('beforeunload', event => {
  if (formDirty || needsExport) { event.preventDefault(); event.returnValue = ''; }
});

try {
  envelope = await loadPublishedCatalogue();
  $('#unlock-form').hidden = !envelope;
  $('#setup-form').hidden = Boolean(envelope);
  $('#gate-caption').textContent = envelope ? 'Enter the editor password to continue.' : 'Create passwords for your new register.';
} catch (error) {
  $('#gate-caption').textContent = 'Published catalogue unavailable. You can import an encrypted backup below.';
  report('#gate-error', error.message, true);
}