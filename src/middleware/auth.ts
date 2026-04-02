import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client'

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Autentikasi diperlukan' })
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string }
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Token tidak valid' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan' })
    }
    next()
  }
}
