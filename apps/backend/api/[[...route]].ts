import app from '../src/index'
import { handle } from 'hono/vercel'

export const config = {
  runtime: 'nodejs20.x',
}

export default handle(app)
