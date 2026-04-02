import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

router.get('/', async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: req.user!.id } },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { projects: true, members: true } },
      },
    })
    res.json({ workspaces })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = createWorkspaceSchema.parse(req.body)

    const existing = await prisma.workspace.findUnique({ where: { slug: data.slug } })
    if (existing) {
      return res.status(400).json({ error: 'Slug workspace sudah digunakan' })
    }

    const workspace = await prisma.workspace.create({
      data: {
        ...data,
        ownerId: req.user!.id,
        members: {
          create: { userId: req.user!.id, role: 'owner' },
        },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    })
    res.status(201).json({ workspace })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        members: { some: { userId: req.user!.id } },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    })

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace tidak ditemukan' })
    }

    res.json({ workspace })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.user!.id, role: { in: ['owner', 'admin'] } },
    })

    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ workspace })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    })

    if (!workspace) {
      return res.status(403).json({ error: 'Hanya owner yang dapat menghapus workspace' })
    }

    await prisma.workspace.delete({ where: { id: req.params.id } })
    res.json({ message: 'Workspace berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/:id/members', async (req, res) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.user!.id, role: { in: ['owner', 'admin'] } },
    })

    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const { email, role = 'member' } = req.body
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' })
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: user.id },
    })

    if (existing) {
      return res.status(400).json({ error: 'User sudah menjadi member' })
    }

    const newMember = await prisma.workspaceMember.create({
      data: { workspaceId: req.params.id, userId: user.id, role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    res.status(201).json({ member: newMember })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.user!.id, role: { in: ['owner', 'admin'] } },
    })

    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.params.userId },
    })

    if (!targetMember) {
      return res.status(404).json({ error: 'Member tidak ditemukan' })
    }

    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Tidak dapat menghapus owner' })
    }

    await prisma.workspaceMember.delete({ where: { id: targetMember.id } })
    res.json({ message: 'Member berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.user!.id, role: { in: ['owner', 'admin'] } },
    })

    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: req.params.id, userId: req.params.userId },
    })

    if (!targetMember) {
      return res.status(404).json({ error: 'Member tidak ditemukan' })
    }

    if (targetMember.role === 'owner' && req.body.role !== 'owner') {
      return res.status(400).json({ error: 'Tidak dapat mengubah role owner' })
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: targetMember.id },
      data: { role: req.body.role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    res.json({ member: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router
