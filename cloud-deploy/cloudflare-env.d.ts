declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GOOGLE_API_KEY?: string;
    GOOGLE_GEMMA_MODEL?: string;
    BUCKET?: R2Bucket;
  }
}
