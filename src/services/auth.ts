import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
const JWT_EXPIRES_IN = '15m'
const JWT_REFRESH_EXPIRES_IN = '7d'

export async function register(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error('Email sudah terdaftar')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  })

  return user
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    throw new Error('Email atau password salah')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new Error('Email atau password salah')
  }

  const token = jwt.sign({ userId: user.id, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN })

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
    refreshToken,
  }
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string; type: string }
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    const token = jwt.sign({ userId: decoded.userId, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    return { token }
  } catch {
    throw new Error('Refresh token tidak valid atau sudah kedaluwarsa')
  }
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, avatarUrl: true },
  })
}
