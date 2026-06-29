// Video.js custom components are registered at runtime without TypeScript definitions.
// @ts-nocheck
import videojs from 'video.js'

let registered = false

export function registerTrackMenuButton() {
  if (registered) return
  registered = true

  const MenuButton = videojs.getComponent('MenuButton')
  const MenuItem = videojs.getComponent('MenuItem')

  class TrackMenuItem extends MenuItem {
    constructor(player, options) {
      super(player, options)
      this.trackValue = options.trackValue
      this.trackKind = options.trackKind
      if (options.trackKind === 'header') {
        this.disable()
      } else {
        this.selected(this.isSelected())
      }
    }

    isSelected() {
      if (this.trackKind === 'header') return false
      if (this.trackKind === 'audio') {
        return String(this.player_.torfinSelectedAudio ?? '') === String(this.trackValue ?? '')
      }
      return String(this.player_.torfinSelectedSubtitle ?? '') === String(this.trackValue ?? '')
    }

    handleClick() {
      if (this.trackKind === 'header') return
      if (this.trackKind === 'audio') {
        this.player_.torfinOnSelectAudio?.(String(this.trackValue))
      } else {
        this.player_.torfinOnSelectSubtitle?.(this.trackValue === '' ? '' : String(this.trackValue))
      }
      this.player_.getChild('controlBar')?.getChild('TrackMenuButton')?.unpressButton()
    }
  }

  class TrackMenuButton extends MenuButton {
    constructor(player, options) {
      super(player, options)
      this.controlText('Audio & subtitles')
      this.addClass('vjs-track-menu')
      this.el().setAttribute('aria-label', 'Audio and subtitles')
    }

    buildCSSClass() {
      return `vjs-track-menu-control ${super.buildCSSClass()}`
    }

    createItems() {
      const mediaInfo = this.player_.torfinMediaInfo
      const items = []

      if (!mediaInfo?.audioTracks?.length && !mediaInfo?.subtitleTracks?.length) {
        items.push(new TrackMenuItem(this.player_, {
          label: 'No tracks detected',
          selectable: false,
          trackKind: 'header',
          trackValue: '',
        }))
        return items
      }

      if (mediaInfo?.audioTracks?.length) {
        items.push(new TrackMenuItem(this.player_, {
          label: 'Audio',
          selectable: false,
          trackKind: 'header',
          trackValue: '',
        }))
        for (const track of mediaInfo.audioTracks) {
          items.push(new TrackMenuItem(this.player_, {
            label: track.label,
            trackKind: 'audio',
            trackValue: track.index,
          }))
        }
      }

      if (mediaInfo?.subtitleTracks?.length) {
        items.push(new TrackMenuItem(this.player_, {
          label: 'Subtitles',
          selectable: false,
          trackKind: 'header',
          trackValue: '',
        }))
        items.push(new TrackMenuItem(this.player_, {
          label: 'Off',
          trackKind: 'subtitle',
          trackValue: '',
        }))
        for (const track of mediaInfo.subtitleTracks) {
          items.push(new TrackMenuItem(this.player_, {
            label: track.label,
            trackKind: 'subtitle',
            trackValue: track.index,
          }))
        }
      }

      return items
    }
  }

  videojs.registerComponent('TrackMenuItem', TrackMenuItem)
  videojs.registerComponent('TrackMenuButton', TrackMenuButton)
}

/** @param {ReturnType<typeof videojs>} player */
export function insertTrackMenuButton(player) {
  const controlBar = player.getChild('controlBar')
  if (!controlBar || controlBar.getChild('TrackMenuButton')) return

  const children = controlBar.children()
  const pipIndex = children.findIndex((child) => child.name?.() === 'PictureInPictureToggle')
  controlBar.addChild('trackMenuButton', {}, pipIndex >= 0 ? pipIndex : Math.max(children.length - 2, 0))
}

/** @param {ReturnType<typeof videojs>} player */
export function syncTrackMenu(player, mediaInfo, selectedAudioIndex, selectedSubtitleIndex) {
  player.torfinMediaInfo = mediaInfo
  player.torfinSelectedAudio = selectedAudioIndex
  player.torfinSelectedSubtitle = selectedSubtitleIndex

  insertTrackMenuButton(player)

  const button = player.getChild('controlBar')?.getChild('TrackMenuButton')
  if (!button) return

  button.update()
  for (const item of button.items || []) {
    if (typeof item.selected === 'function' && typeof item.isSelected === 'function') {
      item.selected(item.isSelected())
    }
  }
}
