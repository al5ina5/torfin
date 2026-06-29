import { STORAGE_KEYS, loadStoredJson, saveStoredJson } from './storage'

export function loadThirdPartyAddonAcks() {
  return new Set(loadStoredJson<string[]>(STORAGE_KEYS.thirdPartyAddonAcks, []))
}

export function hasThirdPartyAddonAck(pluginId: string) {
  return loadThirdPartyAddonAcks().has(pluginId)
}

export function markThirdPartyAddonAck(pluginId: string) {
  const acks = loadThirdPartyAddonAcks()
  acks.add(pluginId)
  saveStoredJson(STORAGE_KEYS.thirdPartyAddonAcks, [...acks])
}
