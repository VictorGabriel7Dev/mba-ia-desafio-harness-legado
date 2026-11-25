import { CurrentUser } from '../domain/ticket'

// Augmentação do Express: o middleware de autenticação grava o usuário atual em req.user,
// então declaramos esse campo no Request para tipá-lo de verdade (sem "any").
declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser
    }
  }
}

export {}
