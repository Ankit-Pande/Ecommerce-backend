import { TokenPayload } from "../utils/Token"

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}