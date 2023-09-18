import { Module } from "@nestjs/common"
import { AppController } from "src/app.controller"
import { AppService } from "src/app.service"
import { configurationModule } from "src/utils/configuration/configuration.module"
import { LockModule } from "src/locks/lock.module"

@Module({
  imports: [configurationModule, LockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
