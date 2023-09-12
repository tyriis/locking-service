import * as Joi from "joi"

export const envValidationSchema: Joi.ObjectSchema = Joi.object({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  NODE_ENV: Joi.string().valid("development", "production", "test").required(),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  CONFIG_PATH: Joi.string().optional(),
})

export const configValidationSchema: Joi.ObjectSchema = Joi.object().keys({
  app: Joi.object({
    host: Joi.string()
      .ip({
        version: ["ipv4"],
        cidr: "forbidden",
      })
      .default("127.0.0.1"),
    port: Joi.number().port().default(3000),
    pretty: Joi.boolean().default(false),
  }).unknown(false),
  redis: Joi.object({
    host: Joi.string()
      .ip({
        version: ["ipv4"],
        cidr: "forbidden",
      })
      .default("127.0.0.1"),
    port: Joi.number().port().default(6379),
    keyPrefix: Joi.string().optional(),
  }),
})
