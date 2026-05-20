#!/usr/bin/env node
/**
 * Arranca MySQL con Docker Compose si `docker` está disponible.
 * Si no, muestra cómo instalar Docker o usar MySQL del sistema (ver SETUP.md).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function dockerComposeWorks() {
  const r = spawnSync('docker', ['compose', 'version'], {
    encoding: 'utf8',
    shell: false,
  })
  return r.status === 0
}

if (!dockerComposeWorks()) {
  console.error('')
  console.error('❌ No se encuentra Docker (comando "docker compose").')
  console.error('')
  console.error('── Opción A · Instalar Docker en Ubuntu / Debian ──')
  console.error('  sudo apt update')
  console.error('  sudo apt install -y docker.io docker-compose-v2')
  console.error('  sudo usermod -aG docker "$USER"')
  console.error('  # Cierra sesión y vuelve a entrar (o ejecuta: newgrp docker)')
  console.error('  npm run db:up')
  console.error('')
  console.error('── Opción B · Sin Docker: MySQL ya instalado ──')
  console.error('  Lee SETUP.md → sección «MySQL sin Docker (Ubuntu)».')
  console.error('')
  process.exit(1)
}

const result = spawnSync('docker', ['compose', 'up', '-d'], {
  cwd: root,
  stdio: 'inherit',
})

process.exit(result.status === null ? 1 : result.status)
