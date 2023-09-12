import { Test, TestingModule } from "@nestjs/testing"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ConfigModule } from "@nestjs/config"

describe("AppController", () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe("root", () => {
    it('should return "{}"', () => {
      expect(appController.getIdentifier()).toBe("{}")
    })
  })
  describe("health", () => {
    it('should return "Service operating normally."', () => {
      expect(appController.getHealth()).toBe("Service operating normally.")
    })
  })
})
