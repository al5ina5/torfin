// Video.js custom components are registered at runtime without TypeScript definitions.
// @ts-nocheck
import videojs from 'video.js'

let registered = false

function getVideoElement(player) {
  const el = player.el().querySelector('video')
  return el instanceof HTMLVideoElement ? el : null
}

export function registerAirPlayButton() {
  if (registered) return
  registered = true

  const Button = videojs.getComponent('Button')

  class AirPlayButton extends Button {
    constructor(player, options) {
      super(player, options)
      this.controlText('AirPlay')
      this.addClass('vjs-hidden')

      player.on('loadedmetadata', () => {
        this.syncAvailability()
        this.syncActiveState()
        this.bindVideoEvents()
      })
    }

    buildCSSClass() {
      return `vjs-airplay-control ${super.buildCSSClass()}`
    }

    bindVideoEvents() {
      const video = getVideoElement(this.player_)
      if (!video || video.dataset.airplayBound === 'true') return
      video.dataset.airplayBound = 'true'

      video.addEventListener('webkitplaybacktargetavailabilitychanged', () => {
        this.syncAvailability()
      })
      video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', () => {
        this.syncActiveState()
      })
    }

    syncAvailability() {
      const video = getVideoElement(this.player_)
      if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
        this.show()
        return
      }
      this.hide()
    }

    syncActiveState() {
      const video = getVideoElement(this.player_)
      if (video?.webkitCurrentPlaybackTargetIsWireless) {
        this.addClass('vjs-airplay-active')
      } else {
        this.removeClass('vjs-airplay-active')
      }
    }

    handleClick() {
      getVideoElement(this.player_)?.webkitShowPlaybackTargetPicker?.()
    }

    show() {
      if (typeof getVideoElement(this.player_)?.webkitShowPlaybackTargetPicker !== 'function') {
        this.hide()
        return
      }
      super.show()
    }
  }

  AirPlayButton.prototype.controlText_ = 'AirPlay'
  videojs.registerComponent('AirPlayButton', AirPlayButton)
}

/** @param {ReturnType<typeof videojs>} player */
export function insertAirPlayButton(player) {
  const controlBar = player.getChild('controlBar')
  if (!controlBar || controlBar.getChild('AirPlayButton')) return

  const children = controlBar.children()
  const pipIndex = children.findIndex((child) => child.name?.() === 'PictureInPictureToggle')
  controlBar.addChild('airPlayButton', {}, pipIndex >= 0 ? pipIndex : Math.max(children.length - 1, 0))
}
