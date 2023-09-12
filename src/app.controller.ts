import { Controller, Get, Header, HttpCode, Logger } from "@nestjs/common"
import { AppService } from "./app.service"
import { ConfigService } from "@nestjs/config"

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(AppController.name)

  @Get()
  @Header("Content-Type", "application/json")
  getIdentifier(): string {
    return this.appService.getIdentifier()
  }

  @Get("/health")
  @Header("Content-Type", "text/plain;charset=utf-8")
  @HttpCode(200)
  getHealth(): string {
    return "Service operating normally."
  }
}
