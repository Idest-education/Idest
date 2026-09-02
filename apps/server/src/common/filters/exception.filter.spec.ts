import { ArgumentsHost, HttpException } from '@nestjs/common';
import { AllExceptionFilter } from './exception.filter';

function host(): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const h = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  return { host: h, json, status };
}

describe('AllExceptionFilter', () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });

  it('omits details for 500s in production', () => {
    process.env = { ...OLD, NODE_ENV: 'production' };
    const { host: h, json } = host();
    new AllExceptionFilter().catch(new Error('secret db string'), h);
    expect(json).toHaveBeenCalledWith(expect.not.objectContaining({ details: expect.anything() }));
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
  });

  it('keeps details for 500s outside production', () => {
    process.env = { ...OLD, NODE_ENV: 'development' };
    const { host: h, json } = host();
    new AllExceptionFilter().catch(new Error('boom'), h);
    expect(json.mock.calls[0][0].details).toContain('boom');
  });

  it('passes through HttpException status + message', () => {
    const { host: h, json, status } = host();
    new AllExceptionFilter().catch(new HttpException('nope', 403), h);
    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].message).toBe('nope');
  });
});
