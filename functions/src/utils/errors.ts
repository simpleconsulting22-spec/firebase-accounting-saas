export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "app/error",
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}
