const { Client } = require('pg');

async function connect() {
  const client = new Client({
    user: 'postgres',
    host: '172.17.0.2',
    database: 'nextjs-dashboard',
    password: 'mysecretpassword',
    port: 5432,
  });

  try {
    console.log('Connecting to the database...');
    await client.connect();
    console.log('Connected to the database');
    return client;
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  }
}

async function end(client) {
  try {
    await client.end();
    console.log('Disconnected from the database');
  } catch (error) {
    console.error('Error disconnecting from the database:', error);
    throw error;
  }
}

async function query(text, params) {
  const client = await connect();
  try {
    console.log('Executing query:', text);
    const result = await client.query(text, params);
    console.log('Query executed successfully:', result.rows);
    return result;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Error executing query');
  } finally {
    await end(client);
  }
}

module.exports = {
  query,
};
