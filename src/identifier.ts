import fs from "node:fs"

interface PackageJson {
  name?: string
  version?: string
}

let packageJson: PackageJson | undefined

const readPackageJson = (): PackageJson => {
  try {
    const url = new URL("../package.json", import.meta.url)
    return JSON.parse(fs.readFileSync(url, "utf8")) as PackageJson
  } catch {
    return {}
  }
}

export const serviceIdentity = (): { service: string; version: string } => {
  packageJson ??= readPackageJson()
  return {
    service: process.env.npm_package_name ?? packageJson.name ?? "locking-service",
    version: process.env.npm_package_version ?? packageJson.version ?? "0.0.0",
  }
}

/**
 * Pretty printed identifier document. The previous implementation returned an
 * already serialized string (never pretty printed by Express `json spaces`).
 */
export const serviceIdentifier = (): string => JSON.stringify(serviceIdentity(), null, 2)
