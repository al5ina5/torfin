export const LEGAL_NOTICE_SHORT =
  'Torfin is client software only. It does not host content. You connect your own accounts and optional third-party addons in Settings, and you are responsible for complying with applicable law and each service’s terms.'

export const FIRST_RUN_INTRO =
  'Torfin helps you browse catalogs and organize downloads into your own Jellyfin library. Connect accounts and addons in Settings when you are ready.'

export const FIRST_RUN_DISCLAIMER_BULLETS = [
  'Torfin does not host, store, index, or distribute movies, TV shows, or other media.',
  'All stream sources and accounts are third-party services you choose and configure yourself.',
  'You must have the right to access anything you download or import, under the laws that apply to you.',
  'Copyright infringement is your responsibility, regardless of which software you use.',
] as const

export const LEGAL_NOTICE_ACK_LABEL =
  'I understand Torfin does not provide or host media. I am responsible for how I use it and for the third-party services I connect.'

export const CONNECTED_SERVICES_HINT =
  'Optional accounts for debrid and library management. Torfin does not host content — you are responsible for complying with each service\'s terms.'

export const INDEXER_SOURCES_HINT =
  'Optional Stremio-compatible metadata endpoints. Toggle sources on or off — Torfin forwards title lookups only; it does not host or index content.'

export const THIRD_PARTY_STREAM_SOURCES_HINT = INDEXER_SOURCES_HINT

export const DEBRID_SERVICE_HINT =
  'Torbox is a third-party debrid service. Torfin sends torrent references from your chosen addons to your Torbox account for resolution. You must comply with Torbox’s terms of service.'

export const THIRD_PARTY_ADDON_ENABLE_TITLE = 'Enable this index source?'

export function thirdPartyAddonEnableMessage(indexLabel: string) {
  return `${indexLabel} is a third-party metadata endpoint not operated by Torfin. Torfin only forwards lookup requests to URLs you configure. You are responsible for complying with applicable law and the endpoint operator's terms. Enable only if you are authorized to use this source.`
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
