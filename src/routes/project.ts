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

    const projects = await prisma.project.findMany({
      where: { workspaceId: req.params.workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ projects })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/workspace/:workspaceId', async (req, res) => {
  try {
    const member = await checkWorkspaceAccess(req.params.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const schema = z.object({
      name: z.string().min(1),
      key: z.string().min(1).max(10),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    })

    const data = schema.parse(req.body)

    const existing = await prisma.project.findFirst({
      where: { workspaceId: req.params.workspaceId, key: data.key },
    })

    if (existing) {
      return res.status(400).json({ error: 'Key project sudah digunakan' })
    }

    const project = await prisma.project.create({
      data: { ...data, workspaceId: req.params.workspaceId },
    })
    res.status(201).json({ project })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: true,
        lists: { orderBy: { sortOrder: 'asc' } },
        views: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(project.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    res.json({ project })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(project.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ project: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(project.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.project.delete({ where: { id: req.params.id } })
    res.json({ message: 'Project berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.get('/:id/lists', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(project.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const lists = await prisma.list.findMany({
      where: { projectId: req.params.id },
      orderBy: { sortOrder: 'asc' },
    })
    res.json({ lists })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/:id/lists', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(project.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const maxOrder = await prisma.list.aggregate({
      where: { projectId: req.params.id },
      _max: { sortOrder: true },
    })

    const list = await prisma.list.create({
      data: {
        projectId: req.params.id,
        name: req.body.name,
        description: req.body.description,
        icon: req.body.icon,
        color: req.body.color,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })
    res.status(201).json({ list })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router
