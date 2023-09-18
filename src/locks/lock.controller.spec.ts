import { Test, TestingModule } from "@nestjs/testing"
import { LockController } from "./lock.controller"
import { LockService } from "./lock.service"
import { ConfigModule } from "@nestjs/config"

describe("LockController", () => {
  let lockController: LockController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [LockController],
      providers: [
        {
          provide: LockService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              key: "test",
              owner: "test",
              duration: 1000,
              createdAt: new Date(),
              expireAt: new Date(),
            }),
          },
        },
      ],
    }).compile()

    lockController = app.get<LockController>(LockController)
  })

  describe("create", () => {
    it("should return dummy lock object", () => {
      expect(
        lockController.create({
          key: "test",
          owner: "test",
          duration: "1000s",
        }),
      ).resolves.toMatchObject({ key: "test", owner: "test", duration: 1000 })
    })
  })
})
