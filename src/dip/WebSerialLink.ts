// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.

import type { IDipLink } from './link';

// From TT-DIP `src/usb_config.h`: the pid.codes vendor ID and the "TT" product ID.
export const DIP_USB_VENDOR_ID = 0x1209;
export const DIP_USB_PRODUCT_ID = 0x5454;

export async function requestDipPort() {
  const port = await navigator.serial.requestPort({
    filters: [{ usbVendorId: DIP_USB_VENDOR_ID, usbProductId: DIP_USB_PRODUCT_ID }],
  });
  await port.open({ baudRate: 115200 }); // The rate doesn't matter for USB CDC.
  return port;
}

export class WebSerialLink implements IDipLink {
  readonly port: SerialPort;
  private dataListener: ((chunk: string) => void) | null = null;
  private closeListener: (() => void) | null = null;
  private readonly writer: WritableStreamDefaultWriter<string>;
  private readonly writableStreamClosed: Promise<void>;
  private reader?: ReadableStreamDefaultReader<string>;
  private readableStreamClosed?: Promise<void>;
  private closed = false;

  constructor(port: SerialPort) {
    this.port = port;
    const textEncoderStream = new TextEncoderStream();
    this.writer = textEncoderStream.writable.getWriter();
    this.writableStreamClosed = textEncoderStream.readable
      .pipeTo(port.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => {});
    void this.run();
  }

  get description() {
    const info = this.port.getInfo();
    const hex = (value?: number) => value?.toString(16).padStart(4, '0') ?? '????';
    return `USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}`;
  }

  onData(listener: (chunk: string) => void) {
    this.dataListener = listener;
  }

  onClose(listener: () => void) {
    this.closeListener = listener;
  }

  async write(data: string) {
    await this.writer.write(data);
  }

  private async run() {
    const { port } = this;
    while (port.readable && !this.closed) {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = (port.readable as unknown as ReadableStream<BufferSource>)
        .pipeTo(textDecoder.writable)
        .catch(() => {});
      this.reader = textDecoder.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            this.dataListener?.(value);
          }
        }
      } catch (error) {
        console.error('WebSerialLink read error:', error);
      } finally {
        this.reader.releaseLock();
      }
    }
    if (!this.closed) {
      this.closed = true;
      this.closeListener?.();
    }
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.reader?.cancel().catch(() => {});
    await this.readableStreamClosed;
    await this.writer.close().catch(() => {});
    await this.writableStreamClosed;
    await this.port.close().catch((error) => console.warn('Failed to close port:', error));
    this.closeListener?.();
  }
}
