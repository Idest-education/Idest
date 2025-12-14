![UIT](https://img.shields.io/badge/from-UIT%20VNUHCM-blue?style=for-the-badge&link=https%3A%2F%2Fwww.uit.edu.vn%2F)

# Idest Server

**Contributors**:

- Leader: Huỳnh Chí Hên - 23520455 - [Github](https://github.com/LuckiPhoenix)
- Member: Nguyễn Cao Vũ Phan - 23521137 - [Github](https://github.com/vuphan525)

**Supervisors**:

- ThS. Trần Thị Hồng Yến - yentth@uit.edu.vn

**Description**: Idest Server is a NestJS-based backend service that provides the core API for the Idest English teaching platform. It uses Prisma ORM with PostgreSQL for data persistence and provides RESTful APIs with Swagger documentation. The server handles user management, class management, sessions, conversations, and integrates with external services for assignment processing.

**How to use**:

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm (recommended package manager)
- A running PostgreSQL database for Prisma

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Copy env template and fill values

```bash
cp .env.example .env
```

3. Generate Prisma client and run migrations (requires a configured database URL)

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

## Run the app

- Development (watch mode)

```bash
pnpm start:dev
```

- Production build & run

```bash
pnpm build
pnpm start:prod
```

## Tests

```bash
pnpm test
```

## API docs

Swagger UI is served at `/api` when the server is running

**Additional information**:

For the assignment module to function, you also need to run [Idest-Assignment Service](https://github.com/LuckiPhoenix/Idest-Assignment).

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
