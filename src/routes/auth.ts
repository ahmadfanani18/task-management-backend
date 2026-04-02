import { Router } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth'
import { authenticate } from '../middleware/auth'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const user = await authService.register(data.email, data.password, data.name)
    res.status(201).json({ user })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body)
    const result = await authService.login(data.email, data.password)
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    })
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Data tidak valid', details: err.errors })
    }
    if (err instanceof Error) {
      return res.status(401).json({ error: err.message })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token diperlukan' })
    }
    const result = await authService.refreshAccessToken(refreshToken)
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    })
    res.json(result)
  } catch (err) {
    if (err instanceof Error) {
      return res.status(401).json({ error: err.message })
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.clearCookie('refreshToken')
  res.json({ message: 'Berhasil logout' })
})

router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan' })
    }
    const user = await authService.getUserById(req.user.id)
    res.json({ user })
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  }
})

export default router
