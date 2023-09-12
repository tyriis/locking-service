import { Test, TestingModule } from "@nestjs/testing"
import { LockController } from "./lock.controller"
import { LockService } from "./lock.service"
import { ConfigModule } from "@nestjs/config"
import { RedisModule } from "@liaoliaots/nestjs-redis"

describe("LockController", () => {
  let lockController: LockController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), RedisModule.forRoot()],
      controllers: [LockController],
      providers: [LockService],
    }).compile()

    lockController = app.get<LockController>(LockController)
  })

  describe("create", () => {
    it('should return "{}"', () => {
      expect(
        lockController.create({
          key: "test",
          owner: "me",
          duration: "1h",
        }),
      ).toBe("{}")
    })
  })
})
