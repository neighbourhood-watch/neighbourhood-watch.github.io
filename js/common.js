import { createIcons, ShieldCheck, Pencil, LockKeyhole, UnlockKeyhole, FolderLock, Eye, EyeOff, ArrowRight, ArrowLeft, Search, Files, KeyRound, FileUp, Plus, Download, Check, RotateCcw, Trash2, Video, Image, AudioLines, ChevronRight } from 'lucide';
import { MAX_CATALOGUE_BYTES, parseEnvelope } from './crypto.js';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import '../src/register.css';

const icons = { ShieldCheck, Pencil, LockKeyhole, UnlockKeyhole, FolderLock, Eye, EyeOff, ArrowRight, ArrowLeft, Search, Files, KeyRound, FileUp, Plus, Download, Check, RotateCcw, Trash2, Video, Image, AudioLines, ChevronRight };
export const $ = selector => document.querySelector(selector);
export function refreshIcons() { createIcons({ icons }); }
export function icon(name) {
  const element = document.createElement('i');
  element.dataset.lucide = name;
  element.setAttribute('aria-hidden', 'true');
  return element;
}
export function textElement(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}
export function report(selector, message, error = false) {
  const element = $(selector);
  element.hidden = false;
  element.textContent = message;
  element.classList.toggle('error', error);
  if (error) element.focus();
}
export async function busy(form, action) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try { await action(); } finally {
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
}
export async function loadPublishedCatalogue() {
  const response = await fetch('./data/incidents.enc.json', { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The published catalogue could not be loaded. Try again later.');
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('The published catalogue is not valid JSON.'); }
  if (value?.format === 'incident-register-unconfigured' && value.version === 1) return null;
  return parseEnvelope(text);
}
export async function readCatalogueFile(file) {
  if (!file) throw new Error('Choose an encrypted catalogue.');
  if (file.size > MAX_CATALOGUE_BYTES) throw new Error('Catalogue exceeds the 8 MB limit.');
  return parseEnvelope(await file.text());
}
export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...options }).format(new Date(value));
}
export function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
export function mediaIcon(kind) { return { video: 'video', image: 'image', audio: 'audio-lines' }[kind]; }

document.querySelectorAll('.password-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.password);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    button.title = show ? 'Hide password' : 'Show password';
    button.setAttribute('aria-pressed', String(show));
    button.replaceChildren(icon(show ? 'eye-off' : 'eye'));
    refreshIcons();
  });
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
refreshIcons();