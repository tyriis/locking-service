export interface ILock {
  key: string
  owner: string
  duration: number
  createdAt: Date | undefined
  expireAt: Date | undefined
}
