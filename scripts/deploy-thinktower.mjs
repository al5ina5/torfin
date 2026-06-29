#!/usr/bin/env node
/**
 * Deploy Torfin to a remote Docker host (e.g. thinktower.local:3020).
 *
 * Configure via environment variables or a local file (gitignored):
 *   .env.thinktower  — personal shortcut for `npm run thinktower`
 *   .env.deploy      — generic deploy config
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(join(root, '.env.deploy'))
loadEnvFile(join(root, '.env.thinktower'))

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
    ...options,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function sshArgs(remoteCommand) {
  const host = process.env.DEPLOY_HOST
  const user = process.env.DEPLOY_USER
  const key = process.env.DEPLOY_SSH_KEY
  const args = ['-o', 'StrictHostKeyChecking=accept-new']
  if (key) args.push('-i', key)
  args.push(`${user}@${host}`, remoteCommand)
  return args
}

function sshCapture(remoteCommand) {
  const password = process.env.DEPLOY_PASSWORD
  const args = sshArgs(remoteCommand)
  const result =
    password && !process.env.DEPLOY_SSH_KEY
      ? spawnSync('sshpass', ['-e', 'ssh', ...args], {
          cwd: root,
          env: { ...process.env, SSHPASS: password },
          encoding: 'utf8',
        })
      : spawnSync('ssh', args, { cwd: root, env: process.env, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
  return String(result.stdout || '').trim()
}

function ssh(remoteCommand) {
  const password = process.env.DEPLOY_PASSWORD
  if (password && !process.env.DEPLOY_SSH_KEY) {
    run('sshpass', ['-e', 'ssh', ...sshArgs(remoteCommand)], {
      env: { ...process.env, SSHPASS: password },
    })
    return
  }
  run('ssh', sshArgs(remoteCommand))
}

function rsync(remoteDir) {
  const host = process.env.DEPLOY_HOST
  const user = process.env.DEPLOY_USER
  const password = process.env.DEPLOY_PASSWORD
  const key = process.env.DEPLOY_SSH_KEY
  const sshCommand = key
    ? `ssh -i ${key} -o StrictHostKeyChecking=accept-new`
    : 'ssh -o StrictHostKeyChecking=accept-new'
  const args = [
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
  if (password && !key) {
    run('sshpass', ['-e', 'rsync', ...args], {
      env: { ...process.env, SSHPASS: password },
    })
    return
  }
  run('rsync', args)
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    console.error('Copy .env.deploy.example to .env.thinktower or .env.deploy and fill in your values.')
    process.exit(1)
  }
  return value
}

const sudoPrefix =
  process.env.DEPLOY_SUDO_PASSWORD?.trim() || process.env.DEPLOY_PASSWORD?.trim() || ''
const sudoShell = sudoPrefix
  ? `echo '${sudoPrefix.replace(/'/g, `'\\''`)}' | sudo -S`
  : 'sudo -n'
requireEnv('DEPLOY_HOST')
requireEnv('DEPLOY_USER')
if (!process.env.DEPLOY_PASSWORD?.trim() && !process.env.DEPLOY_SSH_KEY?.trim()) {
  console.error('Set DEPLOY_PASSWORD or DEPLOY_SSH_KEY for SSH authentication.')
  process.exit(1)
}

const remoteDir = process.env.DEPLOY_REMOTE_DIR || '~/torfin'
const legacyDataDir = process.env.DEPLOY_LEGACY_DATA_DIR || `${remoteDir}/data`
const mediaPath = process.env.DEPLOY_MEDIA_PATH || '/media/movies'
const legacyProject = process.env.DEPLOY_LEGACY_PROJECT || ''
const envFile = process.env.DEPLOY_ENV_FILE || `${legacyDataDir}/jellyfin.env`
const healthUrl =
  process.env.DEPLOY_URL?.trim() ||
  `http://${process.env.DEPLOY_HOST}:${process.env.DEPLOY_PORT || '3020'}/api/health`

console.log('Preparing remote runtime config...')
ssh(`mkdir -p ${remoteDir} ${legacyDataDir}`)
ssh(
  `set -e
if [ ! -f ${envFile} ] && [ -f ${legacyDataDir}/jellyfin.env ]; then
  cp ${legacyDataDir}/jellyfin.env ${envFile}
fi
if [ ! -f ${envFile} ]; then
  echo "Missing ${envFile}. Copy data/jellyfin.env.example and configure it on the server."
  exit 1
fi
if ! grep -q '^TORBOX_SERVER_API_KEY=' ${envFile}; then
  if [ -w ${envFile} ]; then
    echo "TORBOX_SERVER_API_KEY=$(openssl rand -hex 24)" >> ${envFile}
  else
    ${sudoShell} bash -c 'echo "TORBOX_SERVER_API_KEY=$(openssl rand -hex 24)" >> ${envFile}'
  fi
  echo "Added TORBOX_SERVER_API_KEY to ${envFile}"
fi
`,
)

const serverApiKey =
  process.env.VITE_SERVER_API_KEY?.trim() ||
  sshCapture(`grep '^TORBOX_SERVER_API_KEY=' ${envFile} | head -1 | cut -d= -f2-`)

console.log('Building Torfin...')
run('npm', ['run', 'build'], {
  env: { ...process.env, VITE_SERVER_API_KEY: serverApiKey },
})

console.log(`Syncing to ${process.env.DEPLOY_USER}@${process.env.DEPLOY_HOST}:${remoteDir}...`)
rsync(remoteDir)

ssh(
  `set -e
cat > ${remoteDir}/.env.compose <<EOF
TORFIN_DATA_PATH=${legacyDataDir}
TORFIN_MEDIA_PATH=${mediaPath}
TORFIN_ENV_FILE=${envFile}
TORFIN_USER=${process.env.DEPLOY_DOCKER_USER || '1000:1000'}
VITE_SERVER_API_KEY=${serverApiKey}
EOF
${legacyProject ? `docker rm -f ${legacyProject} 2>/dev/null || true` : 'true'}
`,
)

console.log('Rebuilding and restarting Docker on remote host...')
ssh(
  `cd ${remoteDir} && docker compose --env-file .env.compose down && docker compose --env-file .env.compose build --pull && docker compose --env-file .env.compose up -d`,
)

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

console.log(`Torfin deployed successfully → ${healthUrl.replace('/api/health', '/')}`)
