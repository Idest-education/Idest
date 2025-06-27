export class ResponseDto<T = any> {
  status: boolean
  message: string
  data: T

  constructor(data: T, message: string, status: boolean) {
    this.data = data
    this.message = message
    this.status = status
  }

  static ok<T>(data: T, message = 'Success'): ResponseDto<T> {
    return new ResponseDto(data, message, true)
  }

static fail(message = 'Failed'): ResponseDto<null> {
    return new ResponseDto(null, message, false)
  }
}
