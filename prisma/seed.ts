import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@taskflow.com' },
    update: {},
    create: {
      email: 'admin@taskflow.com',
      name: 'Admin User',
      passwordHash,
    },
  })

  console.log('Created user:', user.email)

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'taskflow-workspace' },
    update: {},
    create: {
      name: 'TaskFlow Workspace',
      slug: 'taskflow-workspace',
      ownerId: user.id,
    },
  })

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    },
  })

  console.log('Created workspace:', workspace.name)

  const project = await prisma.project.upsert({
    where: {
      workspaceId_key: {
        workspaceId: workspace.id,
        key: 'TF',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'TaskFlow Project',
      key: 'TF',
      description: 'Main project for TaskFlow',
    },
  })

  const backlogList = await prisma.list.upsert({
    where: {
      id: 'backlog',
    },
    update: {},
    create: {
      id: 'backlog',
      projectId: project.id,
      name: 'Backlog',
      sortOrder: 0,
    },
  })

  const todoList = await prisma.list.upsert({
    where: {
      id: 'todo',
    },
    update: {},
    create: {
      id: 'todo',
      projectId: project.id,
      name: 'To Do',
      sortOrder: 1,
    },
  })

  const inProgressList = await prisma.list.upsert({
    where: {
      id: 'in-progress',
    },
    update: {},
    create: {
      id: 'in-progress',
      projectId: project.id,
      name: 'In Progress',
      sortOrder: 2,
    },
  })

  const doneList = await prisma.list.upsert({
    where: {
      id: 'done',
    },
    update: {},
    create: {
      id: 'done',
      projectId: project.id,
      name: 'Done',
      sortOrder: 3,
    },
  })

  console.log('Created lists')

  await prisma.task.upsert({
    where: { id: 'task-1' },
    update: {},
    create: {
      id: 'task-1',
      projectId: project.id,
      listId: backlogList.id,
      title: 'Setup project structure',
      description: 'Initialize the project with proper folder structure and configurations',
      type: 'task',
      status: 'backlog',
      priority: 'high',
      reporterId: user.id,
    },
  })

  await prisma.task.upsert({
    where: { id: 'task-2' },
    update: {},
    create: {
      id: 'task-2',
      projectId: project.id,
      listId: todoList.id,
      title: 'Create user authentication',
      description: 'Implement login and registration functionality',
      type: 'story',
      status: 'todo',
      priority: 'urgent',
      assigneeId: user.id,
      reporterId: user.id,
    },
  })

  await prisma.task.upsert({
    where: { id: 'task-3' },
    update: {},
    create: {
      id: 'task-3',
      projectId: project.id,
      listId: inProgressList.id,
      title: 'Design dashboard UI',
      description: 'Create the main dashboard layout and components',
      type: 'task',
      status: 'in_progress',
      priority: 'medium',
      assigneeId: user.id,
      reporterId: user.id,
    },
  })

  await prisma.task.upsert({
    where: { id: 'task-4' },
    update: {},
    create: {
      id: 'task-4',
      projectId: project.id,
      listId: doneList.id,
      title: 'Setup database schema',
      description: 'Create all database models and relationships',
      type: 'task',
      status: 'done',
      priority: 'high',
      assigneeId: user.id,
      reporterId: user.id,
    },
  })

  await prisma.tag.upsert({
    where: { id: 'tag-backend' },
    update: {},
    create: {
      id: 'tag-backend',
      workspaceId: workspace.id,
      name: 'Backend',
      color: '#3B82F6',
    },
  })

  await prisma.tag.upsert({
    where: { id: 'tag-frontend' },
    update: {},
    create: {
      id: 'tag-frontend',
      workspaceId: workspace.id,
      name: 'Frontend',
      color: '#10B981',
    },
  })

  await prisma.tag.upsert({
    where: { id: 'tag-bug' },
    update: {},
    create: {
      id: 'tag-bug',
      workspaceId: workspace.id,
      name: 'Bug',
      color: '#EF4444',
    },
  })

  console.log('Created tasks and tags')

  await prisma.view.upsert({
    where: { id: 'view-board' },
    update: {},
    create: {
      id: 'view-board',
      projectId: project.id,
      name: 'Board',
      type: 'board',
      isDefault: true,
    },
  })

  await prisma.view.upsert({
    where: { id: 'view-list' },
    update: {},
    create: {
      id: 'view-list',
      projectId: project.id,
      name: 'List',
      type: 'list',
      isDefault: false,
    },
  })

  console.log('Created views')
  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
