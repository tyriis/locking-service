import { IsNotEmpty, IsString, MinLength, IsNumber, Min, IsDateString } from "class-validator"

export class LockDto {
  /**
   * The lock key/identifier
   * @example "some-fancy-lock.name"
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  key!: string

  /**
   * The owner of the lock
   * @example "Jane Doe"
   */
  @IsString()
  @IsNotEmpty()
  owner!: string

  /**
   * The lock duration in seconds
   * @example 4200
   */
  @IsNumber()
  @Min(1)
  duration!: number

  /**
   * The lock creation as Date string
   * @example "2023-09-12T22:46:59.167Z"
   */
  @IsDateString()
  createdAt!: Date

  /**
   * The lock expire as Date string
   * @example "2023-09-13T00:06:59.167Z"
   */
  @IsDateString()
  expireAt!: Date
}
