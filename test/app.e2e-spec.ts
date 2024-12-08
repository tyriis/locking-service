import { Test, TestingModule } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import * as request from "supertest"
import { AppModule } from "../src/app.module"

describe("API (e2e)", () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe("Health Check", () => {
    it("GET /health should return ok", () => {
      return request(app.getHttpServer()).get("/health").expect(200).expect({ status: "ok" })
    })
  })

  describe("API Documentation", () => {
    it("GET /api should return OpenAPI docs", () => {
      return request(app.getHttpServer()).get("/api").expect(200)
    })
  })
})
