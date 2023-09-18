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
  redis: Joi.object()
    .keys({
      host: Joi.string().hostname(),
      port: Joi.number().port(),
      keyPrefix: Joi.string().optional(),
      sentinels: Joi.array().items(
        Joi.object().keys({
          host: Joi.string().hostname(),
          port: Joi.number().port().default(26379),
        }),
      ),
      name: Joi.string(),
    })
    .xor("host", "sentinels")
    .xor("port", "sentinels")
    .xor("host", "name")
    .xor("port", "name")
    .and("sentinels", "name"),
})
