import helmet from "helmet";

// Security headers (XSS, clickjacking, etc). Default config is API ke liye kaafi hai.
export const helmetConfig = helmet();
