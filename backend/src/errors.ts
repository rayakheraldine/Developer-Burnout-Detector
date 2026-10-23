// An error that carries an HTTP status, so handlers can just `throw` it
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}