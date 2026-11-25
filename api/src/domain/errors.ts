// Erro de domínio com status HTTP e código de aplicação, lançado pelos serviços.
// Fica no domínio e não importa nada (mantém a pureza da camada, invariante G11),
// para que os serviços possam sinalizar falhas sem depender da camada http.
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
