import { Logger, Injectable } from "@nestjs/common"
import { RedisOptionsFactory, RedisModuleOptions } from "@liaoliaots/nestjs-redis"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class RedisConfigService implements RedisOptionsFactory {
  private readonly logger = new Logger(RedisConfigService.name)

  constructor(private readonly configService: ConfigService) {}

  async createRedisOptions(): Promise<RedisModuleOptions> {
    const config = this.configService.get("redis")
    this.logger.debug(`${JSON.stringify(config)}`)
    return { config, readyLog: true }
  }
}
