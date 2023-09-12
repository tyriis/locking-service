import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { LockController, LockService } from "src/locks"

@Module({
  imports: [ConfigModule],
  controllers: [LockController],
  providers: [LockService],
  exports: [],
})
export class LockModule {}
