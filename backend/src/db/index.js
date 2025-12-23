import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

/**
 * Database connection configuration
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('⚠️  DATABASE_URL not set. Database features will be disabled.');
}

/**
 * PostgreSQL connection pool
 */
export const pool = connectionString ? new Pool({
    connectionString,
    max: 20, // Maximum number of clients
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
}) : null;

/**
 * Drizzle ORM instance
 */
export const db = pool ? drizzle(pool, { schema }) : null;

/**
 * Test database connection
 */
export async function testConnection() {
    if (!db) {
        console.log('❌ Database not configured');
        return false;
    }

    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

/**
 * Close database connection
 */
export async function closeConnection() {
    if (pool) {
        await pool.end();
        console.log('Database connection closed');
    }
}
