import { NextFunction, Request, RequestHandler, Response } from 'express'
import { HttpError } from '../domain/errors'

// Reexporta a classe de erro do domínio para as rotas continuarem lançando HttpError
// a partir da camada http (os serviços lançam direto de domain/errors).
export { HttpError }

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found', message: 'Rota não encontrada' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  // Se a resposta já começou, delega ao tratador padrão do Express (boa prática do framework).
  if (res.headersSent) return next(err)
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  const e = err as { name?: string; type?: string; message?: string }
  if (e?.name === 'MulterError') {
    return res.status(422).json({ error: 'validation_error', message: e.message })
  }
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: 'JSON inválido' })
  }
  console.log('erro inesperado', err)
  res.status(500).json({ error: 'internal_error', message: 'Erro interno' })
}
