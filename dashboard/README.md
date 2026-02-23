# SparkSage Dashboard

This is the Next.js frontend application for the SparkSage bot. It provides a web interface to manage bot configurations, view analytics, and interact with various features.

## Getting Started

Follow these instructions to set up and run the dashboard locally.

### Prerequisites

-   Node.js (LTS version recommended)
-   npm or yarn (npm is used in the examples below)
-   Access to the SparkSage backend API (running and accessible)

### Installation

1.  Navigate to the `dashboard/` directory:
    ```bash
    cd dashboard
    ```
2.  Install the dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

### Configuration

The dashboard communicates with the SparkSage backend API. You need to configure the API URL.

1.  Create a `.env.local` file in the `dashboard/` directory (if it doesn't already exist):
    ```
    touch .env.local
    ```
2.  Add the following variable to `.env.local`, pointing to your running backend API:
    ```
    NEXT_PUBLIC_API_URL=http://localhost:8000 # Replace with your backend URL if different
    ```
    Make sure the backend is running and accessible at this URL.

### Running the Dashboard

To run the dashboard in development mode:

```bash
npm run dev
# or
yarn dev
```

The application will start on `http://localhost:3000` by default. Open this URL in your browser to access the dashboard.

### Building for Production

To build the application for production:

```bash
npm run build
# or
yarn build
```

After building, you can start the production server:

```bash
npm start
# or
yarn start
```

## Project Structure

-   `src/app`: Contains the Next.js application pages and routing.
    -   `(auth)`: Authentication related pages (e.g., login).
    -   `dashboard`: Main dashboard pages (e.g., analytics, settings, plugins).
-   `src/components`: Reusable UI components.
-   `src/lib`: Utility functions and API client.
    -   `api.ts`: API client for interacting with the SparkSage backend.
    -   `auth.ts`: NextAuth.js configuration.
    -   `utils.ts`: General utility functions.
-   `src/hooks`: Custom React hooks.
-   `src/stores`: Zustand stores for state management.
-   `src/types`: TypeScript type definitions.

## Key Features

-   **Authentication:** Secure login using NextAuth.js.
-   **Configuration Management:** Adjust bot settings via the web interface.
-   **Analytics:** View usage statistics and cost tracking for AI providers.
-   **Plugin Management:** Enable, disable, and reload community plugins.
-   **Conversation History:** Browse and manage bot conversations.
-   **FAQ Management:** Add, edit, and delete frequently asked questions.

## Development Notes

-   **UI Library:** Uses Shadcn UI components.
-   **State Management:** Uses Zustand for client-side state.
-   **API Integration:** The `src/lib/api.ts` file is the central place for all backend API calls.
-   **Styling:** Uses Tailwind CSS.

---

Feel free to contribute by submitting issues or pull requests!
