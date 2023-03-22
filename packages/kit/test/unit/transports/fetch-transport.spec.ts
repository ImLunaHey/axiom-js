/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { createLogger } from '../../../src/createLogger';
import { FetchTransport } from '../../../src/transports/fetch.transport';
// set axiom env vars before importing logger
process.env.AXIOM_INGEST_ENDPOINT = 'https://example.co/api/test';
// mock fetch response
jest.spyOn(global, 'fetch').mockImplementation(() => {
  return Promise.resolve(new Response('', { status: 204 }));
});

jest.useFakeTimers();
const mockedConsoleLog = jest.spyOn(global.console, 'log').mockImplementation(() => {});

describe('FetchTransport test', () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('FetchTransport should throttle logs & send using fetch', () => {
    (global.fetch as jest.Mock).mockClear();
    const transport = new FetchTransport();
    transport.log({ _time: Date.now().toString(), level: 'info', message: 'hello, world!', fields: {} });
    expect(mockedConsoleLog).toHaveBeenCalledTimes(0);
    expect(fetch).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sending logs from browser should be throttled', async () => {
    const log = createLogger();
    log.info('hello, world!');
    expect(log.config.transport instanceof FetchTransport).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    expect(fetch).toHaveBeenCalledTimes(1);

    log.info('hello, world!');
    expect(fetch).toHaveBeenCalledTimes(1);

    await log.flush();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('flushing parent logger should flush children', async () => {
    const log = createLogger();
    log.info('hello, world!');
    const logger1 = log.with({ foo: 'bar' });
    logger1.debug('logger1');
    const logger2 = logger1.with({ bar: 'foo' });
    logger2.debug('logger2');
    expect(fetch).toHaveBeenCalledTimes(0);
    await log.flush();

    expect(fetch).toHaveBeenCalledTimes(3);

    const payload = (fetch as jest.Mock).mock.calls[2][1] as any;
    const firstLog = JSON.parse(payload.body)[0];
    expect(Object.keys(firstLog.fields).length).toEqual(2);
    expect(firstLog.fields.foo).toEqual('bar');
    expect(firstLog.fields.bar).toEqual('foo');
    // ensure there is nothing was left un-flushed
    await log.flush();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
