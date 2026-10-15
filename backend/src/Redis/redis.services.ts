import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'RedisClient';

/** Domain error so callers don't depend on ioredis internals. */
export class RedisServiceError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'RedisServiceError';
  }
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Enqueue an item at the tail of the queue.
   * Returns the new queue length. Throws RedisServiceError on failure.
   */
  async enqueue<T>(queueName: string, data: T): Promise<number> {
    return this.execute('enqueue', queueName, () =>
      this.redis.rpush(queueName, JSON.stringify(data)),
    );
  }

  /**
   * Read all items without removing them.
   * Fallback: returns [] if Redis is unavailable.
   */
  async getAll<T>(queueName: string): Promise<T[]> {
    return this.withFallback<T[]>(
      'getAll',
      queueName,
      async () => {
        const items = await this.redis.lrange(queueName, 0, -1);
        return items
          .map((item) => this.safeParse<T>(item, queueName))
          .filter((item): item is T => item !== undefined);
      },
      [],
    );
  }

  /**
   * Pop the oldest item.
   * Fallback: returns null if the queue is empty or Redis is unavailable.
   */
  async dequeue<T>(queueName: string): Promise<T | null> {
    return this.withFallback<T | null>(
      'dequeue',
      queueName,
      async () => {
        const item = await this.redis.lpop(queueName);
        if (item === null) return null; // empty queue is normal, not an error
        return this.safeParse<T>(item, queueName) ?? null;
      },
      null,
    );
  }

  /**
   * Remove all items matching the given data (atomic LREM).
   * Returns how many were removed. Throws RedisServiceError on failure.
   */
  async remove<T>(queueName: string, data: T): Promise<number> {
    return this.execute('remove', queueName, () =>
      this.redis.lrem(queueName, 0, JSON.stringify(data)),
    );
  }

  async getOne<T>(queueName: string, data: string): Promise<[] | null> {
    const item = await this.execute('getOne', queueName, async (data) => {
      const items = await this.redis.lrange(data, 0, -1);
      const parsed = items.map((i) => JSON.parse(i));
      return parsed.find((i) => i[data] === data);
    });
    return item;
  }

  /** For writes: log, then wrap and rethrow so the caller knows it failed. */
  private async execute<R>(
    operation: string,
    queueName: string,
    action: (args?: any) => Promise<R>,
  ): Promise<R> {
    try {
      return await action();
    } catch (error) {
      this.logger.error(
        `${operation} failed for "${queueName}": ${this.errorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new RedisServiceError(
        `Redis ${operation} failed for "${queueName}"`,
        error,
      );
    }
  }

  /** For reads: log, then return the fallback value instead of throwing. */
  private async withFallback<R>(
    operation: string,
    queueName: string,
    action: () => Promise<R>,
    fallback: R,
  ): Promise<R> {
    try {
      return await action();
    } catch (error) {
      this.logger.warn(
        `${operation} failed for "${queueName}", using fallback: ${this.errorMessage(error)}`,
      );
      return fallback;
    }
  }

  /** Skip corrupt entries instead of crashing the whole read. */
  private safeParse<T>(raw: string, queueName: string): T | undefined {
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Skipping invalid JSON in "${queueName}": ${raw}`);
      return undefined;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
