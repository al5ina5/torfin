export const LEGAL_NOTICE_SHORT =
  'Torfin is client software only. It does not host content. You connect your own Torbox account and optional third-party addons, and you are responsible for complying with applicable law and each service’s terms.'

export const LEGAL_NOTICE_ACK_LABEL =
  'I understand Torfin does not provide or host media. I am responsible for how I use it and for the third-party services I connect.'

export const THIRD_PARTY_STREAM_SOURCES_HINT =
  'Stream addons are third-party services not operated by Torfin. Enable only sources you are authorized to use. Torfin does not index or host torrents.'

export const DEBRID_SERVICE_HINT =
  'Torbox is a third-party debrid service. Torfin sends torrent references from your chosen addons to your Torbox account for resolution. You must comply with Torbox’s terms of service.'

export const THIRD_PARTY_ADDON_ENABLE_TITLE = 'Enable third-party addon?'

export function thirdPartyAddonEnableMessage(addonName: string) {
  return `${addonName} is a third-party service not operated by Torfin. Torfin only forwards metadata requests to URLs you configure. You are responsible for complying with applicable law and ${addonName}’s terms. Enable only if you are authorized to use this source.`
}

export const LEGAL_NOTICE_SECTIONS = [
  {
    title: 'Not legal advice',
    body:
      'Laws on copyright, streaming, and downloading vary by country. You are responsible for how you use Torfin and for complying with applicable law and the terms of every service you connect.',
  },
  {
    title: 'What Torfin is',
    body:
      'Torfin is open-source client software (MIT license). It browses public metadata, queries Stremio-compatible addons you choose, resolves torrent references through your own Torbox account, and imports files into your own Jellyfin library or storage. Torfin does not host, store, index, or distribute movies, TV shows, or other copyrighted works.',
  },
  {
    title: 'Third-party services',
    body:
      'Torbox, Torrentio, Comet, Cinemeta, Jellyfin, and other integrations are operated by third parties or by you. Torfin contributors are not affiliated with, endorsed by, or responsible for these services. Default URL templates are provided for convenience only.',
  },
  {
    title: 'Your responsibilities',
    bullets: [
      'You choose what to download; addons and your accounts decide what is available.',
      'You must have the right to access content you download or import.',
      'Copyright infringement is your risk, regardless of which software you use.',
      'You supply and secure your own API keys, servers, and addon URLs.',
    ],
  },
  {
    title: 'Lawful uses',
    bullets: [
      'Managing a personal Jellyfin library with media you own or are licensed to use.',
      'Downloading public-domain or Creative Commons works.',
      'Using addons that point only to legally distributable content.',
      'Homelab automation on infrastructure you control and are authorized to use.',
    ],
  },
  {
    title: 'No warranty',
    body:
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. See the MIT License in this repository.',
  },
] as const

export const LEGAL_NOTICE_REPO_URL = 'https://github.com/al5ina5/torfin/blob/main/docs/legal.md'
