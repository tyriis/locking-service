import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { ValidationPipe } from "@nestjs/common"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { LockDto } from "./locks/dto/lock.dto"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService: ConfigService = app.get(ConfigService)

  // Enable global validation pipes
  // https://www.prisma.io/blog/nestjs-prisma-validation-7D056s1kOla1
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

  // Enable JSON pretty print REST
  // https://stackoverflow.com/questions/60624042/make-a-nestjs-route-send-in-response-a-pretty-formatted-json
  if (configService.get<boolean>("app.pretty")) {
    app.getHttpAdapter().getInstance().set("json spaces", 2)
  }

  // Enable swagger spec entrypoint
  const config = new DocumentBuilder()
    .setTitle("locking-service")
    .setDescription("Locking Service API documentation.")
    .setVersion(configService.get<string>("SERVICE_VERSION") ?? "0.0.0")
    .build()
  const document = SwaggerModule.createDocument(app, config, { extraModels: [LockDto] })
  SwaggerModule.setup("api", app, document)

  const port: number = configService.get<number>("app.port") ?? 3000
  const host: string = configService.get<string>("app.host") ?? "127.0.0.1"

  await app.listen(port, host)
}

bootstrap()
