/**
 * Debe importarse antes que cualquier otro módulo del servidor para que
 * process.env esté listo al evaluar el resto de imports que lean variables.
 */
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })
