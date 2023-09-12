import { ConfigModule } from "@nestjs/config"
import { DynamicModule } from "@nestjs/common"
import { configurationLoader } from "./configuration-loader"
import { envValidationSchema } from "./configuration.schema"

export const configurationModule: DynamicModule = ConfigModule.forRoot({
  cache: true,
  load: [configurationLoader],
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: true,
  },
})
