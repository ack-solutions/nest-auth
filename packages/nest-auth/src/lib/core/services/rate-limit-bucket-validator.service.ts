import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { RATE_LIMIT_BUCKET_KEY } from '../../auth.constants';
import { RateLimitBucketName } from '../interfaces/rate-limit.interface';
import { RateLimitService } from './rate-limit.service';

/**
 * Boot-time check that every `@RateLimit('<bucket>')` in the app names a bucket
 * that exists — built-in, or declared in `security.rateLimit.buckets`. Without
 * it a typo resolved to no limit at all, so the route went unthrottled with no
 * error. Runs whether or not rate limiting is enabled, so a bucket missing from
 * config fails in development rather than when limits are switched on.
 */
@Injectable()
export class RateLimitBucketValidator implements OnModuleInit {
    constructor(
        private readonly discovery: DiscoveryService,
        private readonly scanner: MetadataScanner,
        private readonly reflector: Reflector,
        private readonly rateLimit: RateLimitService,
    ) { }

    onModuleInit(): void {
        this.rateLimit.assertBucketsDefined(this.collectBuckets());
    }

    private collectBuckets(): RateLimitBucketName[] {
        const buckets: RateLimitBucketName[] = [];
        for (const wrapper of this.discovery.getControllers()) {
            const { instance, metatype } = wrapper;
            if (!instance || !metatype) continue;

            const classBucket = this.reflector.get<RateLimitBucketName | undefined>(RATE_LIMIT_BUCKET_KEY, metatype);
            if (classBucket) buckets.push(classBucket);

            const prototype = Object.getPrototypeOf(instance);
            for (const name of this.scanner.getAllMethodNames(prototype)) {
                const bucket = this.reflector.get<RateLimitBucketName | undefined>(RATE_LIMIT_BUCKET_KEY, prototype[name]);
                if (bucket) buckets.push(bucket);
            }
        }
        return buckets;
    }
}
