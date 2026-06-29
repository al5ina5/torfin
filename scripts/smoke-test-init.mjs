/**
 * Shared Playwright init: accept legal notice and enable Torrentio so download queue is visible.
 */
export function smokeTestInitScript() {
  const plugins = [
    {
      id: 'torrentio',
      name: 'Torrentio',
      enabled: true,
      streamUrlTemplate: 'https://torrentio.strem.fun/{torrentioConfig}/stream/movie/{imdbId}.json',
    },
    {
      id: 'comet',
      name: 'Comet',
      enabled: false,
      streamUrlTemplate: 'https://comet.elfhosted.com/{cometTorboxConfig}/stream/movie/{imdbId}.json',
    },
    { id: 'aiostreams', name: 'AIOStreams', enabled: false, streamUrlTemplate: '' },
    { id: 'mediafusion', name: 'MediaFusion', enabled: false, streamUrlTemplate: '' },
  ]

  localStorage.setItem('torfin:first-run-dismissed', '1')
  localStorage.setItem('torfin.legal-notice-accepted', '1')
  localStorage.setItem('torfin.plugins', JSON.stringify(plugins))
  localStorage.setItem('torfin.third-party-addon-acks', JSON.stringify(['torrentio']))
}
