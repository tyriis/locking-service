import { Body, Controller, Delete, Get, Injectable, Logger, Param, Post } from "@nestjs/common"
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger"
import { CreateLockDto, LockService, ILock } from "."
import { LockDto } from "./dto/lock.dto"

@Injectable()
@ApiTags("locks")
@Controller("locks")
export class LockController {
  private readonly logger = new Logger(LockController.name)
  constructor(private readonly lockService: LockService) {}

  /**
   * Create a new lock
   * @param {CreateLockDto} lock The new lock definition
   * @returns {Promise<ILock>} The lock object
   */
  @ApiCreatedResponse({
    description: "The lock has been successfully created.",
    type: CreateLockDto,
    schema: { $ref: getSchemaPath(LockDto) },
  })
  @ApiBadRequestResponse({
    description: "Input validation failed",
  })
  @ApiConflictResponse({
    description: "A lock with given `key` already exists.",
    schema: {
      example: {
        statusCode: 409,
        message: "lock 'some-fancy-lock.name' already aquired!",
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @Post()
  async create(@Body() lock: CreateLockDto): Promise<ILock> {
    this.logger.debug(`create(${JSON.stringify(lock)}) call`)
    const result = await this.lockService.create(lock)
    this.logger.debug(`create(${JSON.stringify(lock)}) return`)
    return result
  }

  /**
   * Retrieve all active locks
   * @returns {Promise<ILock[]>} A list of all active locks
   */
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @ApiOkResponse({
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(LockDto) },
    },
  })
  @Get()
  async findAll(): Promise<ILock[]> {
    this.logger.debug("findAll() call")
    const result = this.lockService.findAll()
    this.logger.debug("findAll() return")
    return result
  }

  /**
   * Retrieve an active lock by its `key`
   * @param {string} key The lock key to search for
   * @returns {ILock | null} Either the coresponding lock or null if not found
   */
  @ApiOkResponse({
    schema: { $ref: getSchemaPath(LockDto) },
  })
  @ApiBadRequestResponse({
    description: "Input validation failed",
    schema: {
      example: {
        message: ["key must be longer than or equal to 3 characters"],
        error: "Bad Request",
        statusCode: 400,
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @ApiNotFoundResponse({
    description: "Lock with given key not found",
    schema: {
      example: {
        statusCode: 404,
        error: "Not Found",
        message: "lock 'some-fancy-lock.name' not found",
      },
    },
  })
  @Get(":key")
  async findOne(@Param("key") key: string): Promise<ILock> {
    this.logger.debug(`findAll({key: ${key}}) call`)
    const result = await this.lockService.findOne(key)
    this.logger.debug(`findAll({key: ${key}}) return`)
    return result
  }

  /**
   * Remove an existing lock by its `key`
   * @param {string} key The lock key to search for
   * @returns {Promise<null>} No matter if lock has existed or not it will return `null`
   */
  @ApiBadRequestResponse({
    description: "Input validation failed",
  })
  @ApiInternalServerErrorResponse({
    description: "Internal server error",
  })
  @ApiOkResponse({
    description: "Lock with given `key` has been deleted",
  })
  @Delete(":key")
  async remove(@Param("key") key: string): Promise<null> {
    this.logger.debug(`remove({key: ${key}}) call`)
    const result = await this.lockService.remove(key)
    this.logger.debug(`remove({key: ${key}}) return`)
    return result
  }
}
