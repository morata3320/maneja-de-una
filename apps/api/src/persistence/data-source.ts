import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config';
config({ quiet: true });
export default new DataSource(databaseOptions());
