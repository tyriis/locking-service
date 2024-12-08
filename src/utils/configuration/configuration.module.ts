import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { configurationLoader } from "./configuration-loader"
import { envValidationSchema } from "./configuration.schema"

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      load: [configurationLoader],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
      isGlobal: true, // Make configuration globally available
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService], // Export ConfigService to make it available to other modules
})
export class ConfigurationModule {}
