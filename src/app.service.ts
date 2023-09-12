import { Logger, Injectable, BeforeApplicationShutdown } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class AppService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(AppService.name)
  constructor(private configService: ConfigService) {}
  beforeApplicationShutdown(signal: string) {
    this.logger.warn(signal)
  }
  getIdentifier(): string {
    return JSON.stringify(
      {
        service: this.configService.get<string>("SERVICE_NAME"),
        version: this.configService.get<string>("SERVICE_VERSION"),
      },
      null,
      2,
    )
  }
}
