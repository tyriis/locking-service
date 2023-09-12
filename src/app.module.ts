import { Module } from "@nestjs/common"
import { AppController } from "src/app.controller"
import { AppService } from "src/app.service"
import { configurationModule } from "src/utils/configuration/configuration.module"
import { redisModule } from "src/utils/redis/redis.module"
import { LockModule } from "src/locks/lock.module"

@Module({
  imports: [configurationModule, redisModule, LockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
