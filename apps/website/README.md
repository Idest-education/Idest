![UIT](https://img.shields.io/badge/from-UIT%20VNUHCM-blue?style=for-the-badge&link=https%3A%2F%2Fwww.uit.edu.vn%2F)

# Idest - English Teaching Website

**Contributors**:

- Leader: Huỳnh Chí Hên - 23520455 - [Github](https://github.com/LuckiPhoenix)
- Member: Nguyễn Cao Vũ Phan - 23521137 - [Github](https://github.com/vuphan525)

**Supervisors**:

- ThS. Trần Thị Hồng Yến - yentth@uit.edu.vn

**Description**: Idest is an English Teaching assisting tool powered by WebRTC with AI grading functionality. It provides an interactive platform for English language learning with real-time communication capabilities and automated assessment features.

**How to use**:

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm
- [idest-server](https://github.com/LuckiPhoenix/idest-server) and [Idest-Assignment](https://github.com/LuckiPhoenix/Idest-Assignment) running (required if running locally)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vuphan525/Idest
   cd Idest
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the required values (Supabase URL/Key, LiveKit credentials, etc.)

   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev

   # OR use docker

   docker-compose up --build
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

**Additional information**:

**Code of conducting**:

- Be respectful and inclusive in all interactions
- Provide constructive feedback and accept it gracefully
- Maintain professional communication
- Follow academic integrity standards
- Contribute meaningfully to the project

**License**:

MIT License

Copyright (c) 2025 Vu Phan & Hen Huynh

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
