import { IsNotEmpty, IsString, MinLength } from "class-validator"

export class CreateLockDto {
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
   * The lock duration as timestring
   * @example "1h20m"
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  duration?: string
}
