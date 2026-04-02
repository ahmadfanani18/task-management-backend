import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

async function checkProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  })
  if (!project) return null

  return prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  })
}

router.get('/project/:projectId', async (req, res) => {
  try {
    const member = await checkProjectAccess(req.params.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const sprints = await prisma.sprint.findMany({
      where: { projectId: req.params.projectId },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { startDate: 'desc' },
    })
    res.json({ sprints })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/project/:projectId', async (req, res) => {
  try {
    const member = await checkProjectAccess(req.params.projectId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const schema = z.object({
      name: z.string().min(1),
      goal: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    })

    const data = schema.parse(req.body)

    const sprint = await prisma.sprint.create({
      data: {
        projectId: req.params.projectId,
        name: data.name,
        goal: data.goal,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    })
    res.status(201).json({ sprint })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } })
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint tidak ditemukan' })
    }

    const member = await checkProjectAccess(sprint.projectId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updateData: Record<string, unknown> = { ...req.body }
    if (req.body.startDate) updateData.startDate = new Date(req.body.startDate)
    if (req.body.endDate) updateData.endDate = new Date(req.body.endDate)

    const updated = await prisma.sprint.update({
      where: { id: req.params.id },
      data: updateData,
    })
    res.json({ sprint: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } })
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint tidak ditemukan' })
    }

    const member = await checkProjectAccess(sprint.projectId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.sprint.delete({ where: { id: req.params.id } })
    res.json({ message: 'Sprint berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router