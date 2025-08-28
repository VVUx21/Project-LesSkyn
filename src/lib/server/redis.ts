import Redis from "ioredis"

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined");
  }
  return process.env.REDIS_URL;
};
const client = new Redis(getRedisUrl());

export { client };