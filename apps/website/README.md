# Idest - English Teaching Website

An English Teaching assisting tool powered by WebRTC with AI grading functionality

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm
- [idest-server](https://github.com/LuckiPhoenix/idest-server) and  [Idest-Assignment](https://github.com/LuckiPhoenix/Idest-Assignment) running (required if running locally)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/vuphan525/Idest
    cd Idest
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    -   Copy `.env.example` to `.env`
    -   Fill in the required values (Supabase URL/Key, LiveKit credentials, etc.)

    ```bash
    cp .env.example .env
    ```

4.  Run the development server:
    ```bash
    npm run dev

    # OR use docker

    docker-compose up --build
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.



