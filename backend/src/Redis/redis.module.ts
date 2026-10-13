import { Module } from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "RedisClient";

@Module({
    exports: [],
    imports:[ConfigModule] , 
    providers:[{
        provide:REDIS_CLIENT , 
        inject:[ConfigService] ,
        useFactory:async(configService:ConfigService)=>{
            const redis_url = configService.get<string>("REDIS_URL");
            if (!redis_url) {
                throw new Error("REDIS_URL is not defined in the environment variables");
            }
            const redis = new Redis(redis_url);
            redis.on("connect" , ()=>{
                console.log("Redis connected successfully");
            })
            return redis;
        }
    }] , 
})
export class RedisModule {}