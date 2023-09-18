import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { LockController, LockService } from "src/locks"
import { redisModule } from "src/utils/redis/redis.module"

@Module({
  imports: [ConfigModule, redisModule],
  controllers: [LockController],
  providers: [LockService],
  exports: [],
})
export class LockModule {}
