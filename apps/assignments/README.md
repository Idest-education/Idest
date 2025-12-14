![UIT](https://img.shields.io/badge/from-UIT%20VNUHCM-blue?style=for-the-badge&link=https%3A%2F%2Fwww.uit.edu.vn%2F)

# Idest Assignment Microservice

**Contributors**:

- Leader: Huỳnh Chí Hên - 23520455 - [Github](https://github.com/LuckiPhoenix)
- Member: Nguyễn Cao Vũ Phan - 23521137 - [Github](https://github.com/vuphan525)

**Supervisors**:

- ThS. Trần Thị Hồng Yến - yentth@uit.edu.vn

**Description**: Idest Assignment Microservice is a NestJS service that manages assignments (reading, listening, speaking, writing) and grading functionality for the Idest platform. It depends on MongoDB for data storage, RabbitMQ for message queuing, and optional integrations with Supabase for storage and OpenAI for AI-powered grading capabilities.

**How to use**:

## Requirements

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- MongoDB instance
- RabbitMQ instance (defaults to `amqp://localhost:5672`)

## Quick Start

```bash
pnpm install
cp .env.example .env   # fill in your values
```

## Run project

```bash
pnpm run start:dev
```

The API defaults to `http://localhost:8008`.

## Environment Variables

Create `.env` using `.env.example` as a guide. Key variables used by the service:

- `PORT` (default `8008`) — HTTP port.
- `API_URL` — Base URL of this service (used in HTML landing).
- `FRONTEND_URL` — Allowed CORS origin.
- `MONGODB_URI` — MongoDB connection string (required).
- `JWT_SECRET` — Secret for signing tokens (defaults to `default-secret-key`).
- `RABBITMQ_URL` — RabbitMQ connection string (defaults to `amqp://localhost:5672`).
- `OPENAI_API_KEY` — Needed for grading with OpenAI.
- `SUPABASE_URL` / `SUPABASE_KEY` — Needed for Supabase storage access.

## Scripts

- `pnpm run start:dev` — Start in watch mode.
- `pnpm run start` — Start once (development).
- `pnpm run start:prod` — Run compiled app (`dist/`).
- `pnpm run build` — Compile TypeScript to `dist/`.
- `pnpm run test` — Unit tests.
- `pnpm run test:e2e` — E2E tests.
- `pnpm run lint` — Lint and auto-fix.

**Additional information**:

- Swagger is exposed at `/api` when the server is running.
- [Main service](https://github.com/LuckiPhoenix/idest-server) is required to run this

**Code of conducting**:

- Be respectful and inclusive in all interactions
- Provide constructive feedback and accept it gracefully
- Maintain professional communication
- Follow academic integrity standards
- Contribute meaningfully to the project

**License**:

MIT License

Copyright (c) 2025 Hen Huynh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
