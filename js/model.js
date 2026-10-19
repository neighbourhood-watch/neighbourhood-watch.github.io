export const EMBED_HOSTS = {
  'player.vimeo.com': /^\/video\/\d+\/?$/,
  'www.youtube.com': /^\/embed\/[\w-]+\/?$/,
  'www.youtube-nocookie.com': /^\/embed\/[\w-]+\/?$/,
  'w.soundcloud.com': /^\/player\/?$/,
  'open.spotify.com': /^\/embed\/(track|episode|playlist|album|show)\/[\w]+\/?$/,
  'archive.org': /^\/embed\/[\w.-]+\/?$/,
  'drive.google.com': /^\/file\/d\/[\w-]+\/preview\/?$/,
};

export function safeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a complete HTTPS media URL or supported embed code.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Media must use an HTTPS URL without login credentials or a custom port.');
  }
  if (url.href.length > 6000) throw new Error('The media URL is too long.');
  return url;
}

export function embedUrl(value) {
  const url = safeUrl(value);
  const pattern = EMBED_HOSTS[url.hostname];
  if (!pattern || !pattern.test(url.pathname)) {
    throw new Error('Unsupported player. Use a Vimeo, YouTube, SoundCloud, Spotify, Internet Archive, or Google Drive embed, or a direct media URL.');
  }
  url.searchParams.delete('autoplay');
  return url.href;
}

export function validateMedia(media) {
  if (!media || !['video', 'image', 'audio'].includes(media.kind) || !['embed', 'direct'].includes(media.mode)) {
    throw new Error('Invalid media type.');
  }
  if (typeof media.label !== 'string' || !media.label.trim() || media.label.length > 200) {
    throw new Error('Each media item needs a label of 1 to 200 characters.');
  }
  if (media.kind === 'image' && media.mode !== 'direct') throw new Error('Images need a direct image URL.');
  if (media.mode === 'embed') embedUrl(media.src);
  else safeUrl(media.src);
  return { kind: media.kind, mode: media.mode, label: media.label.trim(), src: media.mode === 'embed' ? embedUrl(media.src) : safeUrl(media.src).href };
}

export function validateCatalogue(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.incidents) || data.incidents.length > 1000) {
    throw new Error('Invalid incident catalogue (maximum 1,000 incidents).');
  }
  const ids = new Set();
  const incidents = data.incidents.map(incident => {
    if (typeof incident.id !== 'string' || !/^[\w-]{1,80}$/.test(incident.id) || ids.has(incident.id)) {
      throw new Error('Incident identifiers must be unique.');
    }
    ids.add(incident.id);
    if (typeof incident.title !== 'string' || !incident.title.trim() || incident.title.length > 160) {
      throw new Error('Each incident needs a title of 1 to 160 characters.');
    }
    if (typeof incident.description !== 'string' || incident.description.length > 12000) {
      throw new Error('Descriptions must be 12,000 characters or fewer.');
    }
    if (incident.location !== undefined && (typeof incident.location !== 'string' || incident.location.length > 300)) {
      throw new Error('Locations must be 300 characters or fewer.');
    }
    if (typeof incident.occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(incident.occurredAt) || !Number.isFinite(Date.parse(incident.occurredAt))) {
      throw new Error('Enter a valid incident date and time.');
    }
    if (!Array.isArray(incident.media) || incident.media.length < 1 || incident.media.length > 30) {
      throw new Error('Each incident needs between 1 and 30 media items.');
    }
    return {
      id: incident.id,
      title: incident.title.trim(),
      description: incident.description.trim(),
      location: incident.location?.trim() || '',
      occurredAt: new Date(incident.occurredAt).toISOString(),
      media: incident.media.map(validateMedia),
    };
  });
  return { version: 1, incidents };
}

export function findIncidents(incidents, query = '', kind = 'all', order = 'newest') {
  const needle = query.trim().toLocaleLowerCase();
  return incidents.filter(incident =>
    `${incident.title} ${incident.description} ${incident.location || ''} ${new Date(incident.occurredAt).toLocaleDateString()}`.toLocaleLowerCase().includes(needle)
    && (kind === 'all' || incident.media.some(media => media.kind === kind)),
  ).sort((left, right) => (Date.parse(right.occurredAt) - Date.parse(left.occurredAt)) * (order === 'oldest' ? -1 : 1));
}