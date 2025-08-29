import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import getMyRoutine from './getmyroutine';
import getRoutine from './get-routine';

const app = new Hono().basePath('/api');

app.route('/', getMyRoutine);
app.route('/', getRoutine);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);