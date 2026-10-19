import { EMBED_HOSTS, embedUrl, safeUrl, validateMedia } from './model.js';

export function parseMedia(kind, label, input) {
  const value = input.trim();
  let src = value;
  let mode = 'direct';
  if (value.startsWith('<')) {
    const document = new DOMParser().parseFromString(value, 'text/html');
    const candidates = document.querySelectorAll('iframe, img, video, audio');
    if (candidates.length !== 1) throw new Error('Paste one media embed per item.');
    const element = candidates[0];
    const tag = element.tagName.toLowerCase();
    if (tag === 'iframe') {
      if (kind === 'image') throw new Error('Use an image URL or an img embed for images.');
      src = element.getAttribute('src');
      mode = 'embed';
    } else {
      if (tag !== (kind === 'image' ? 'img' : kind)) throw new Error('The embed does not match the selected media type.');
      src = element.getAttribute('src') || element.querySelector('source')?.getAttribute('src');
    }
    if (!src) throw new Error('The embed is missing its media URL.');
  } else {
    const url = safeUrl(value);
    if (kind !== 'image') {
      if (['youtu.be', 'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
        const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
        src = id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : value;
        mode = 'embed';
      } else if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
        const match = url.pathname.match(/^\/(\d+)(?:\/([\w]+))?\/?$/);
        if (!match) throw new Error('Use the Vimeo player embed or a video URL.');
        const hash = match[2] || url.searchParams.get('h');
        src = `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${encodeURIComponent(hash)}` : ''}`;
        mode = 'embed';
      } else if (Object.hasOwn(EMBED_HOSTS, url.hostname) && EMBED_HOSTS[url.hostname].test(url.pathname)) {
        mode = 'embed';
      }
    }
  }
  return validateMedia({ kind, label, src: mode === 'embed' ? embedUrl(src) : src, mode });
}

export function renderMedia(media) {
  const figure = document.createElement('figure');
  figure.className = `media-frame media-${media.kind}`;
  let element;
  if (media.mode === 'embed') {
    element = document.createElement('iframe');
    element.title = media.label;
    element.src = embedUrl(media.src);
    element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    element.allow = 'fullscreen; picture-in-picture; encrypted-media';
    element.allowFullscreen = true;
    element.referrerPolicy = 'no-referrer';
  } else if (media.kind === 'image') {
    element = document.createElement('img');
    element.alt = media.label;
    element.src = safeUrl(media.src).href;
    element.referrerPolicy = 'no-referrer';
  } else {
    element = document.createElement(media.kind);
    element.controls = true;
    element.preload = 'metadata';
    element.src = safeUrl(media.src).href;
  }
  element.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'media-error';
    message.textContent = 'Media unavailable. Check its hosting permissions or try the source link.';
    figure.append(message);
  }, { once: true });
  figure.append(element);
  const caption = document.createElement('figcaption');
  const text = document.createElement('span');
  text.textContent = media.label;
  const link = document.createElement('a');
  link.textContent = 'Open source (new tab)';
  link.href = safeUrl(media.src).href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  caption.append(text, link);
  figure.append(caption);
  return figure;
}