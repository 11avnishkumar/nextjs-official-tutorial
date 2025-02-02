const { query } = require('../../db');
import { unstable_noStore as noStore } from 'next/cache';

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // await connect();

    const data = await query(`SELECT * FROM revenue`);
    console.log('Data fetch completed after 3 seconds.');

    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();

  try {
    // await connect();
    const data = await query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`);

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    // console.log(latestInvoices);
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();

  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    // await connect();
    const invoiceCountPromise = query(`SELECT COUNT(*) FROM invoices`);
    const customerCountPromise = query(`SELECT COUNT(*) FROM customers`);
    const invoiceStatusPromise = query(`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`);

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(quer: string, currentPage: number) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // await connect();
    const invoices = await query(
      `
  SELECT
    invoices.id,
    invoices.amount,
    invoices.date,
    invoices.status,
    customers.name,
    customers.email,
    customers.image_url
  FROM invoices
  JOIN customers ON invoices.customer_id = customers.id
  WHERE
    customers.name ILIKE $1 OR
    customers.email ILIKE $2 OR
    invoices.amount::text ILIKE $3 OR
    invoices.date::text ILIKE $4 OR
    invoices.status ILIKE $5
  ORDER BY invoices.date DESC
  LIMIT $6 OFFSET $7
  `,
      [
        `%${quer}%`,
        `%${quer}%`,
        `%${quer}%`,
        `%${quer}%`,
        `%${quer}%`,
        ITEMS_PER_PAGE,
        offset,
      ],
    );

    return invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(quer: string) {
  noStore();
  try {
    // await connect();
    const count = await query(
      `
  SELECT COUNT(*)
  FROM invoices
  JOIN customers ON invoices.customer_id = customers.id
  WHERE
    customers.name ILIKE $1 OR
    customers.email ILIKE $2 OR
    invoices.amount::text ILIKE $3 OR
    invoices.date::text ILIKE $4 OR
    invoices.status ILIKE $5
`,
      [`%${quer}%`, `%${quer}%`, `%${quer}%`, `%${quer}%`, `%${quer}%`],
    );

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();

  try {
    // await connect();
    const data = await query(
      `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1;
    `,
      [id],
    );

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();

  try {
    // await connect();
    const data = await query(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(quer: string) {
  noStore();

  try {
    // await connect();
    const sql = `
  SELECT
    customers.id,
    customers.name,
    customers.email,
    customers.image_url,
    COUNT(invoices.id) AS total_invoices,
    SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
    SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
  FROM customers
  LEFT JOIN invoices ON customers.id = invoices.customer_id
  WHERE
    customers.name ILIKE $1 OR
    customers.email ILIKE $2
  GROUP BY customers.id, customers.name, customers.email, customers.image_url
  ORDER BY customers.name ASC
`;

    const params = [`%${quer}%`, `%${quer}%`]; // Bind parameters for sanitization

    const data = await query(sql, params);

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  noStore();

  try {
    // await connect();
    const user = await query(`SELECT * FROM users WHERE email=${email}`);
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
