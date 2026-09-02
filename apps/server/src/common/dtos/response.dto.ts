export class ResponseDto<T = any> {
  status: boolean
  message: string
  data: T
  statusCode: number

  constructor(data: T, message: string, status: boolean, statusCode: number) {
    this.data = data
    this.message = message
    this.status = status
    this.statusCode = statusCode
  }

  static ok<T>(data: T, message = 'Success', statusCode: number = 200): ResponseDto<T> {
    return new ResponseDto(data, message, true, statusCode)
  }

static fail(message = 'Failed', statusCode: number = 500): ResponseDto<null> {
    return new ResponseDto(null, message, false, statusCode)
  }
}
