import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/task/:taskId', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: { taskId: req.params.taskId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'desc' },
    })
    res.json({ timeEntries })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/', async (req, res) => {
  try {
    const schema = z.object({
      taskId: z.string(),
      description: z.string().optional(),
      duration: z.number().min(1),
      date: z.string(),
    })

    const data = schema.parse(req.body)

    const task = await prisma.task.findUnique({ where: { id: data.taskId } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId: data.taskId,
        userId: req.user!.id,
        description: data.description,
        duration: data.duration,
        date: new Date(data.date),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })
    res.status(201).json({ timeEntry })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } })
    if (!timeEntry) {
      return res.status(404).json({ error: 'Time entry tidak ditemukan' })
    }

    if (timeEntry.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
      },
    })
    res.json({ timeEntry: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } })
    if (!timeEntry) {
      return res.status(404).json({ error: 'Time entry tidak ditemukan' })
    }

    if (timeEntry.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.timeEntry.delete({ where: { id: req.params.id } })
    res.json({ message: 'Time entry berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router