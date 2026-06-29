import { useEffect, useState } from 'react'

import { getSecret, setSecret } from '../lib/secrets'
import { loadStoredJson, saveStoredJson } from '../lib/storage'

type SecretState = {
  torboxApiKey: string
  jellyfinApiKey: string
  sshPassword: string
  loaded: boolean
}

const JELLYFIN_WEB_KEY = 'torfin.web-jellyfin-api-key'

export function useSecrets() {
  const [state, setState] = useState<SecretState>({
    torboxApiKey: '',
    jellyfinApiKey: '',
    sshPassword: '',
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [torboxApiKey, jellyfinApiKey, sshPassword] = await Promise.all([
        getSecret('torbox_api_key'),
        getSecret('jellyfin_api_key'),
        getSecret('ssh_password'),
      ])
      if (cancelled) return
      setState({
        torboxApiKey: torboxApiKey || '',
        jellyfinApiKey: jellyfinApiKey || loadStoredJson<string>(JELLYFIN_WEB_KEY, ''),
        sshPassword: sshPassword || '',
        loaded: true,
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const setTorboxApiKey = (value: string) => {
    setState((current) => ({ ...current, torboxApiKey: value }))
    void setSecret('torbox_api_key', value)
  }

  const setJellyfinApiKey = (value: string) => {
    setState((current) => ({ ...current, jellyfinApiKey: value }))
    void setSecret('jellyfin_api_key', value)
    saveStoredJson(JELLYFIN_WEB_KEY, value)
  }

  const setSshPassword = (value: string) => {
    setState((current) => ({ ...current, sshPassword: value }))
    void setSecret('ssh_password', value)
  }

  return {
    ...state,
    setTorboxApiKey,
    setJellyfinApiKey,
    setSshPassword,
  }
}
