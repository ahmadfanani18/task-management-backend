import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  })
}

router.get('/workspace/:workspaceId', async (req, res) => {
  try {
    const member = await checkWorkspaceAccess(req.params.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const goals = await prisma.goal.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ goals })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/workspace/:workspaceId', async (req, res) => {
  try {
    const member = await checkWorkspaceAccess(req.params.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().min(1),
      startDate: z.string().optional(),
      targetDate: z.string().optional(),
    })

    const data = schema.parse(req.body)

    const goal = await prisma.goal.create({
      data: {
        workspaceId: req.params.workspaceId,
        name: data.name,
        description: data.description,
        color: data.color,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      },
    })
    res.status(201).json({ goal })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!goal) {
      return res.status(404).json({ error: 'Goal tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(goal.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updateData: Record<string, unknown> = { ...req.body }
    if (req.body.startDate) updateData.startDate = new Date(req.body.startDate)
    if (req.body.targetDate) updateData.targetDate = new Date(req.body.targetDate)

    const updated = await prisma.goal.update({
      where: { id: req.params.id },
      data: updateData,
    })
    res.json({ goal: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!goal) {
      return res.status(404).json({ error: 'Goal tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(goal.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.goal.delete({ where: { id: req.params.id } })
    res.json({ message: 'Goal berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/:id/tasks', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!goal) {
      return res.status(404).json({ error: 'Goal tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(goal.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const goalTask = await prisma.goalTask.create({
      data: {
        goalId: req.params.id,
        taskId: req.body.taskId,
      },
    })
    res.status(201).json({ goalTask })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!goal) {
      return res.status(404).json({ error: 'Goal tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(goal.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.goalTask.delete({
      where: {
        goalId_taskId: {
          goalId: req.params.id,
          taskId: req.params.taskId,
        },
      },
    })
    res.json({ message: 'Task berhasil dihapus dari goal' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router