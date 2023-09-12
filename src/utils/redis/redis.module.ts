import { RedisModule } from "@liaoliaots/nestjs-redis"
import { DynamicModule } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { RedisConfigService } from "./redis-config.service"

export const redisModule: DynamicModule = RedisModule.forRootAsync({
  imports: [ConfigModule],
  useClass: RedisConfigService,
  inject: [ConfigService],
})
