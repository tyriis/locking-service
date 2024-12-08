import * as fs from "fs"
import * as YAML from "yaml"
import { Logger } from "@nestjs/common"
import { configValidationSchema } from "./configuration.schema"
import { homedir } from "os"

const logger: Logger = new Logger("ConfigurationLoader")
const xdgConfig: string = process.env.XDG_CONFIG_HOME ?? `${homedir()}/.config`
const CONFIG_PATH: string = process.env.CONFIG_PATH ?? `${xdgConfig}/locking-service/configuration.yaml`

const validate = (config: Record<string, unknown>): Record<string, unknown> => {
  const { error } = configValidationSchema.validate(config)
  if (error) {
    throw new Error(`Config validation error: ${error.message}`)
  }
  return config
}

const replaceEnvVars = (value: any): any => {
  if (typeof value === "string") {
    const envRegex = /\${env\.(.*?)}/g
    return value.replace(envRegex, (_, envVar): string => {
      const env = process.env[envVar]
      if (!env) {
        throw new Error(`Environment variable ${envVar} is not set!`)
      }
      return env
    })
  } else if (typeof value === "object" && value !== null) {
    for (const key in value) {
      value[key] = replaceEnvVars(value[key])
    }
  }
  return value
}

export const configurationLoader = () => {
  // check if file exists
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`${CONFIG_PATH} is not a file!`)
  }
  logger.log(`loading configuration: ${CONFIG_PATH}`)
  const config = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>
  // replace all matches of ${env} with the actual environment variable
  replaceEnvVars(config)
  // as we can not validate our config over the build in config validator, we need to do it here
  const validatedConfig = validate(config)
  // inject npm values
  validatedConfig.SERVICE_NAME = process.env.npm_package_name
  validatedConfig.SERVICE_VERSION = process.env.npm_package_version
  validatedConfig.SERVICE_IDENTIFIER = `${validatedConfig.SERVICE_NAME} ${validatedConfig.SERVICE_VERSION}`
  return validatedConfig
}
