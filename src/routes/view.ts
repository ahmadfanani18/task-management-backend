import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
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

    const views = await prisma.view.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ views })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/project/:projectId', async (req, res) => {
  try {
    const member = await checkProjectAccess(req.params.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(['list', 'board', 'calendar', 'gantt']),
      config: z.record(z.unknown()).optional(),
      filters: z.record(z.unknown()).optional(),
      sortBy: z.array(z.unknown()).optional(),
      isDefault: z.boolean().optional(),
    })

    const data = schema.parse(req.body)

    const view = await prisma.view.create({
      data: {
        projectId: req.params.projectId,
        name: data.name,
        type: data.type,
        config: (data.config || {}) as Prisma.InputJsonValue,
        filters: (data.filters || {}) as Prisma.InputJsonValue,
        sortBy: (data.sortBy || []) as Prisma.InputJsonValue,
        isDefault: data.isDefault || false,
      },
    })
    res.status(201).json({ view })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const view = await prisma.view.findUnique({ where: { id: req.params.id } })
    if (!view) {
      return res.status(404).json({ error: 'View tidak ditemukan' })
    }

    const member = await checkProjectAccess(view.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.view.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ view: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const view = await prisma.view.findUnique({ where: { id: req.params.id } })
    if (!view) {
      return res.status(404).json({ error: 'View tidak ditemukan' })
    }

    const member = await checkProjectAccess(view.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.view.delete({ where: { id: req.params.id } })
    res.json({ message: 'View berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router