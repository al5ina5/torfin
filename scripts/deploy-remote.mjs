#!/usr/bin/env node
/**
 * CI-friendly deploy entrypoint (rsync + remote docker compose).
 * Local developers should use: npm run thinktower
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
    ...options,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

requireEnv('DEPLOY_HOST')
requireEnv('DEPLOY_USER')

const remoteDir = process.env.DEPLOY_REMOTE_DIR || '~/torfin'
const host = process.env.DEPLOY_HOST
const user = process.env.DEPLOY_USER
const password = process.env.DEPLOY_PASSWORD
const key = process.env.DEPLOY_SSH_KEY

function sshArgs(remoteCommand) {
  const args = ['-o', 'StrictHostKeyChecking=accept-new']
  if (key) args.push('-i', key)
  args.push(`${user}@${host}`, remoteCommand)
  return args
}

function ssh(remoteCommand) {
  if (password && !key) {
    run('sshpass', ['-e', 'ssh', ...sshArgs(remoteCommand)], {
      env: { ...process.env, SSHPASS: password },
    })
    return
  }
  run('ssh', sshArgs(remoteCommand))
}

const sshCommand = key
  ? `ssh -i ${key} -o StrictHostKeyChecking=accept-new`
  : 'ssh -o StrictHostKeyChecking=accept-new'

const rsyncArgs = [
  '-az',
  '--delete',
  '--exclude',
  'node_modules',
  '--exclude',
  'src-tauri/target',
  '--exclude',
  '.git',
  '--exclude',
  'dist-ssr',
  '--exclude',
  '.env',
  '--exclude',
  '.env.thinktower',
  '--exclude',
  '.env.deploy',
  '--exclude',
  'data',
  '-e',
  sshCommand,
  `${root}/`,
  `${user}@${host}:${remoteDir}/`,
]

console.log(`Syncing to ${user}@${host}:${remoteDir}...`)
ssh(`mkdir -p ${remoteDir}`)
if (password && !key) {
  run('sshpass', ['-e', 'rsync', ...rsyncArgs], {
    env: { ...process.env, SSHPASS: password },
  })
} else {
  run('rsync', rsyncArgs)
}

const legacyDataDir = process.env.DEPLOY_LEGACY_DATA_DIR || ''
const mediaPath = process.env.DEPLOY_MEDIA_PATH || ''
const legacyProject = process.env.DEPLOY_LEGACY_PROJECT || ''

if (legacyDataDir && mediaPath) {
  ssh(
    `set -e
cd ${remoteDir}
mkdir -p data
if [ ! -f data/jellyfin.env ] && [ -f ${legacyDataDir}/jellyfin.env ]; then
  cp ${legacyDataDir}/jellyfin.env data/jellyfin.env
fi
cat > .env.compose <<EOF
TORFIN_DATA_PATH=${legacyDataDir}
TORFIN_MEDIA_PATH=${mediaPath}
EOF
if [ -n "${legacyProject}" ]; then docker rm -f ${legacyProject} 2>/dev/null || true; fi
`,
  )
  ssh(
    `cd ${remoteDir} && docker compose --env-file .env.compose down && docker compose --env-file .env.compose build --pull && docker compose --env-file .env.compose up -d`,
  )
} else {
  ssh(`cd ${remoteDir} && docker compose down && docker compose build --pull && docker compose up -d`)
}

const healthUrl =
  process.env.DEPLOY_URL?.trim() ||
  `http://${host}:${process.env.DEPLOY_PORT || '3020'}/api/health`

console.log(`Waiting for ${healthUrl}...`)
let healthy = false
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const response = await fetch(healthUrl)
    if (response.ok) {
      healthy = true
      break
    }
  } catch {
    // retry
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000))
}

if (!healthy) {
  console.error(`Deploy finished but health check failed: ${healthUrl}`)
  process.exit(1)
}

console.log(`Deploy successful → ${healthUrl.replace('/api/health', '/')}`)
