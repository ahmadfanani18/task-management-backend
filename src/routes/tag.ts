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

    const tags = await prisma.tag.findMany({
      where: { workspaceId: req.params.workspaceId },
    })
    res.json({ tags })
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
      color: z.string().min(1),
    })

    const data = schema.parse(req.body)

    const tag = await prisma.tag.create({
      data: { ...data, workspaceId: req.params.workspaceId },
    })
    res.status(201).json({ tag })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } })
    if (!tag) {
      return res.status(404).json({ error: 'Tag tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(tag.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.tag.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ tag: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } })
    if (!tag) {
      return res.status(404).json({ error: 'Tag tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(tag.workspaceId, req.user!.id)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.tag.delete({ where: { id: req.params.id } })
    res.json({ message: 'Tag berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/task/:taskId/:tagId', async (req, res) => {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.tagId } })
    if (!tag) {
      return res.status(404).json({ error: 'Tag tidak ditemukan' })
    }

    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(tag.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.taskTag.create({
      data: { taskId: req.params.taskId, tagId: req.params.tagId },
    })
    res.status(201).json({ message: 'Tag berhasil ditambahkan ke task' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/task/:taskId/:tagId', async (req, res) => {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.tagId } })
    if (!tag) {
      return res.status(404).json({ error: 'Tag tidak ditemukan' })
    }

    const member = await checkWorkspaceAccess(tag.workspaceId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.taskTag.delete({
      where: { taskId_tagId: { taskId: req.params.taskId, tagId: req.params.tagId } },
    })
    res.json({ message: 'Tag berhasil dihapus dari task' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router