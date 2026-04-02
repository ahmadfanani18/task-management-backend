import { Router } from 'express'
import { prisma } from '../prisma/client'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ notifications })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification) {
      return res.status(404).json({ error: 'Notification tidak ditemukan' })
    }

    if (notification.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    })
    res.json({ notification: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    })
    res.json({ message: 'Semua notifikasi sudah dibaca' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification) {
      return res.status(404).json({ error: 'Notification tidak ditemukan' })
    }

    if (notification.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.notification.delete({ where: { id: req.params.id } })
    res.json({ message: 'Notification berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router