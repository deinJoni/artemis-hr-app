import app from '../dist/index.js'
import { handle } from 'hono/vercel'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
