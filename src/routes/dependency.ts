import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.post('/', async (req, res) => {
  try {
    const schema = z.object({
      taskId: z.string(),
      dependsOnId: z.string(),
      type: z.enum(['blocks', 'blocked_by', 'relates_to']),
    })

    const data = schema.parse(req.body)

    const task = await prisma.task.findUnique({ where: { id: data.taskId } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        taskId: data.taskId,
        dependsOnId: data.dependsOnId,
        type: data.type,
      },
      include: {
        dependsOn: { select: { id: true, title: true } },
      },
    })
    res.status(201).json({ dependency })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const dependency = await prisma.taskDependency.findUnique({ where: { id: req.params.id } })
    if (!dependency) {
      return res.status(404).json({ error: 'Dependency tidak ditemukan' })
    }

    await prisma.taskDependency.delete({ where: { id: req.params.id } })
    res.json({ message: 'Dependency berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router