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

    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        list: { select: { id: true, name: true, color: true } },
        tags: { include: { tag: true } },
        _count: { select: { subtasks: true, comments: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    res.json({ tasks })
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
      title: z.string().min(1),
      listId: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['task', 'story', 'epic', 'bug']).optional(),
      priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
      assigneeId: z.string().optional(),
      dueDate: z.string().optional(),
    })

    const data = schema.parse(req.body)

    const maxOrder = await prisma.task.aggregate({
      where: { projectId: req.params.projectId },
      _max: { sortOrder: true },
    })

    const task = await prisma.task.create({
      data: {
        projectId: req.params.projectId,
        listId: data.listId,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reporterId: req.user!.id,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        list: { select: { id: true, name: true, color: true } },
      },
    })

    res.status(201).json({ task })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        list: true,
        sprint: true,
        tags: { include: { tag: true } },
        checklist: { orderBy: { sortOrder: 'asc' } },
        comments: {
          include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        dependencies: { include: { dependsOn: { select: { id: true, title: true } } } },
        history: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkProjectAccess(task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    res.json({ task })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkProjectAccess(task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const { title, description, listId, sprintId, priority, dueDate, estimate, ...rest } = req.body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (listId !== undefined) updateData.listId = listId
    if (sprintId !== undefined) updateData.sprintId = sprintId
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (estimate !== undefined) updateData.estimate = estimate

    if (Object.keys(updateData).length > 0) {
      await prisma.taskHistory.create({
        data: {
          taskId: task.id,
          field: 'updated',
          oldValue: JSON.stringify(task),
          newValue: JSON.stringify(updateData),
        },
      })
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        list: { select: { id: true, name: true, color: true } },
      },
    })

    res.json({ task: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkProjectAccess(task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.task.delete({ where: { id: req.params.id } })
    res.json({ message: 'Task berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/:id/comments', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkProjectAccess(task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.id,
        authorId: req.user!.id,
        content: req.body.content,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    res.status(201).json({ comment })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/comments/:id', async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { task: true },
    })
    if (!comment) {
      return res.status(404).json({ error: 'Comment tidak ditemukan' })
    }

    if (comment.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Hanya автор yang dapat menghapus comment' })
    }

    await prisma.comment.delete({ where: { id: req.params.id } })
    res.json({ message: 'Comment berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/:id/checklist', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!task) {
      return res.status(404).json({ error: 'Task tidak ditemukan' })
    }

    const member = await checkProjectAccess(task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const maxOrder = await prisma.checklistItem.aggregate({
      where: { taskId: req.params.id },
      _max: { sortOrder: true },
    })

    const item = await prisma.checklistItem.create({
      data: {
        taskId: req.params.id,
        content: req.body.content,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })

    res.status(201).json({ item })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.patch('/checklist/:id', async (req, res) => {
  try {
    const item = await prisma.checklistItem.findUnique({
      where: { id: req.params.id },
      include: { task: true },
    })
    if (!item) {
      return res.status(404).json({ error: 'Checklist item tidak ditemukan' })
    }

    const member = await checkProjectAccess(item.task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    const updated = await prisma.checklistItem.update({
      where: { id: req.params.id },
      data: {
        content: req.body.content,
        completed: req.body.completed,
      },
    })

    res.json({ item: updated })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.delete('/checklist/:id', async (req, res) => {
  try {
    const item = await prisma.checklistItem.findUnique({
      where: { id: req.params.id },
      include: { task: true },
    })
    if (!item) {
      return res.status(404).json({ error: 'Checklist item tidak ditemukan' })
    }

    const member = await checkProjectAccess(item.task.projectId, req.user!.id)
    if (!member) {
      return res.status(403).json({ error: 'Tidak memiliki akses' })
    }

    await prisma.checklistItem.delete({ where: { id: req.params.id } })
    res.json({ message: 'Checklist item berhasil dihapus' })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router
