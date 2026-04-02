import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import authRoutes from './routes/auth'
import workspaceRoutes from './routes/workspace'
import projectRoutes from './routes/project'
import taskRoutes from './routes/task'
import tagRoutes from './routes/tag'
import sprintRoutes from './routes/sprint'
import goalRoutes from './routes/goal'
import timeEntryRoutes from './routes/timeEntry'
import notificationRoutes from './routes/notification'
import viewRoutes from './routes/view'
import dependencyRoutes from './routes/dependency'
import swaggerDocument from './swagger.json'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use('/api/auth', authRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/sprints', sprintRoutes)
app.use('/api/goals', goalRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/views', viewRoutes)
app.use('/api/dependencies', dependencyRoutes)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log(`Server on port ${PORT}`))

export { io }
