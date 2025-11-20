import app from '../src/index'
import { handle } from 'hono/vercel'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
